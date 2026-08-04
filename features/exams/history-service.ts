import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { evaluateFreeText } from "@/lib/ai";
import { normalizeAnswer } from "./validation";

async function ownExam(examId: number, userId: string) {
  const exam = await db.exam.findFirst({
    where: { id: examId, userId },
    select: { id: true },
  });
  if (!exam) throw new ApiError(404, "Exam not found.", "EXAM_NOT_FOUND");
}

export async function examHistory(examId: number, userId: string) {
  await ownExam(examId, userId);
  const attempts = await db.examAttempt.findMany({
    where: { examId, userId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    include: {
      exam: { include: { subject: { select: { id: true, title: true } } } },
      answers: { select: { isCorrect: true } },
    },
  });
  return attempts.map((attempt) => ({
    id: attempt.id,
    score: attempt.score,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    totalQuestions: attempt.answers.length,
    correctAnswers: attempt.answers.filter((answer) => answer.isCorrect).length,
    examId,
    examDescription: attempt.exam.description,
    subject: attempt.exam.subject,
  }));
}

export async function comparison(examId: number, userId: string) {
  const history = (await examHistory(examId, userId)).reverse();
  return history.map((attempt, index) => ({
    attemptNumber: index + 1,
    date: attempt.completedAt?.toISOString().slice(0, 10),
    score: attempt.score,
    correctAnswers: attempt.correctAnswers,
    totalQuestions: attempt.totalQuestions,
    duration:
      attempt.completedAt &&
      Math.floor((attempt.completedAt.getTime() - attempt.startedAt.getTime()) / 1000),
  }));
}

export async function wrongAnswers(examId: number, userId: string) {
  await ownExam(examId, userId);
  const rows = await db.userAnswer.findMany({
    where: { isCorrect: false, attempt: { examId, userId, status: "COMPLETED" } },
    include: {
      question: {
        select: {
          id: true,
          text: true,
          type: true,
          options: true,
          correctAnswer: true,
          explanation: true,
          topicLabel: true,
        },
      },
      attempt: { select: { id: true, completedAt: true } },
    },
    orderBy: { attempt: { completedAt: "desc" } },
  });
  const grouped = new Map<number, { question: (typeof rows)[number]["question"]; misses: unknown[] }>();
  for (const row of rows) {
    const entry = grouped.get(row.questionId) ?? { question: row.question, misses: [] };
    entry.misses.push({
      attemptId: row.attempt.id,
      userAnswer: row.selectedAnswer,
      completedAt: row.attempt.completedAt,
    });
    grouped.set(row.questionId, entry);
  }
  return [...grouped.values()]
    .map((entry) => ({ ...entry, totalWrongAttempts: entry.misses.length }))
    .sort((a, b) => b.totalWrongAttempts - a.totalWrongAttempts);
}

export async function attemptDetails(attemptId: number, userId: string) {
  const attempt = await db.examAttempt.findFirst({
    where: { id: attemptId, userId },
    include: {
      exam: { include: { subject: { select: { id: true, title: true } } } },
      answers: {
        orderBy: { question: { slot: "asc" } },
        include: {
          question: {
            select: {
              id: true,
              slot: true,
              text: true,
              type: true,
              options: true,
              correctAnswer: true,
              explanation: true,
              topicLabel: true,
              sourceCitations: true,
            },
          },
        },
      },
    },
  });
  if (!attempt) throw new ApiError(404, "Attempt not found.", "ATTEMPT_NOT_FOUND");
  if (attempt.status !== "COMPLETED") {
    throw new ApiError(409, "Attempt details are available after submission.");
  }
  return {
    id: attempt.id,
    score: attempt.score,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    exam: {
      id: attempt.exam.id,
      description: attempt.exam.description,
      subject: attempt.exam.subject,
    },
    questions: attempt.answers.map((answer) => ({
      ...answer.question,
      userAnswer: answer.selectedAnswer,
      isCorrect: answer.isCorrect,
      feedback: answer.feedback,
    })),
  };
}

export async function adaptiveQuiz(userId: string, subjectId?: number, count = 5) {
  const bounded = Math.max(1, Math.min(count, 25));
  const exams = await db.exam.findMany({
    where: { userId, status: "READY", ...(subjectId ? { subjectId } : {}) },
    select: { id: true },
  });
  const examIds = exams.map((exam) => exam.id);
  if (!examIds.length) return { questions: [], weakCount: 0, totalAvailable: 0 };
  const totalAvailable = await db.question.count({
    where: { examId: { in: examIds }, published: true },
  });
  const missed = await db.userAnswer.groupBy({
    by: ["questionId"],
    where: {
      isCorrect: false,
      attempt: { userId },
      question: { examId: { in: examIds }, published: true },
    },
    _count: { questionId: true },
    orderBy: { _count: { questionId: "desc" } },
    take: Math.ceil(bounded * 0.6),
  });
  const weakIds = missed.map((item) => item.questionId);
  const fill = await db.question.findMany({
    where: {
      examId: { in: examIds },
      published: true,
      id: { notIn: weakIds },
    },
    take: bounded - weakIds.length,
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const questions = await db.question.findMany({
    where: { id: { in: [...weakIds, ...fill.map((item) => item.id)] } },
    select: {
      id: true,
      text: true,
      type: true,
      options: true,
      difficulty: true,
      topicLabel: true,
    },
  });
  return { questions, weakCount: weakIds.length, totalAvailable };
}

export async function gradeAdaptiveQuiz(
  userId: string,
  answers: Array<{ questionId: number; userAnswer: string }>,
) {
  if (new Set(answers.map((answer) => answer.questionId)).size !== answers.length) {
    throw new ApiError(400, "Duplicate answers are not allowed.");
  }
  const questions = await db.question.findMany({
    where: {
      id: { in: answers.map((answer) => answer.questionId) },
      published: true,
      exam: { userId },
    },
    select: {
      id: true,
      text: true,
      type: true,
      correctAnswer: true,
      acceptedAnswers: true,
      explanation: true,
    },
  });
  if (questions.length !== answers.length) throw new ApiError(400, "A question is invalid.");
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer.userAnswer]));
  const results = [];
  for (const question of questions) {
    const userAnswer = answerMap.get(question.id) ?? "";
    const normalized = normalizeAnswer(userAnswer);
    let isCorrect = [question.correctAnswer, ...question.acceptedAnswers]
      .map(normalizeAnswer)
      .includes(normalized);
    let feedback: string | undefined;
    if (question.type === "IDENTIFICATION" && normalized && !isCorrect) {
      const evaluation = await evaluateFreeText({
        question: question.text,
        correctAnswer: question.correctAnswer,
        userAnswer,
      });
      isCorrect = evaluation.isCorrect;
      feedback = evaluation.feedback;
    }
    results.push({
      questionId: question.id,
      userAnswer,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      feedback,
      isCorrect,
    });
  }
  return {
    score: results.length
      ? (results.filter((result) => result.isCorrect).length / results.length) * 100
      : 0,
    results,
  };
}
