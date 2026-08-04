import "server-only";
import { AttemptStatusEnum } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { evaluateFreeText } from "@/lib/ai";
import { inngest } from "@/inngest/client";
import { normalizeAnswer } from "./validation";

export async function startAttempt(examId: number, userId: string) {
  const exam = await db.exam.findFirst({
    where: { id: examId, userId },
    include: {
      questions: {
        where: { published: true },
        orderBy: { slot: "asc" },
        select: { id: true, slot: true, text: true, type: true, options: true },
      },
    },
  });
  if (!exam) throw new ApiError(404, "Exam not found.", "EXAM_NOT_FOUND");
  if (exam.status !== "READY") {
    throw new ApiError(409, "Exam is not ready.", "EXAM_NOT_READY");
  }
  const existing = await db.examAttempt.findFirst({
    where: { examId, userId, status: "IN_PROGRESS" },
  });
  if (existing) {
    return {
      attemptId: existing.id,
      examId,
      startedAt: existing.startedAt,
      timeLimit: exam.timeLimit,
      questions: exam.questions,
    };
  }
  if (!exam.isPracticeMode) {
    const completed = await db.examAttempt.count({
      where: { examId, userId, status: "COMPLETED" },
    });
    if (completed) {
      throw new ApiError(409, "This exam has already been completed.", "RETAKE_DISABLED");
    }
  }
  const attempt = await db.examAttempt.create({ data: { examId, userId } });
  return {
    attemptId: attempt.id,
    examId,
    startedAt: attempt.startedAt,
    timeLimit: exam.timeLimit,
    questions: exam.questions,
  };
}

async function completedResult(attemptId: number, userId: string) {
  const attempt = await db.examAttempt.findFirst({
    where: { id: attemptId, userId, status: "COMPLETED" },
    include: {
      answers: { include: { question: true }, orderBy: { question: { slot: "asc" } } },
    },
  });
  if (!attempt) return null;
  return {
    attemptId,
    score: attempt.score ?? 0,
    correctAnswers: attempt.answers.filter((answer) => answer.isCorrect).length,
    totalQuestions: attempt.answers.length,
    timeTaken: attempt.completedAt
      ? Math.floor((attempt.completedAt.getTime() - attempt.startedAt.getTime()) / 1000)
      : 0,
    results: attempt.answers.map((answer) => ({
      questionId: answer.questionId,
      isCorrect: answer.isCorrect,
      userAnswer: answer.selectedAnswer,
      correctAnswer: answer.question.correctAnswer,
      explanation: answer.question.explanation,
      feedback: answer.feedback,
    })),
  };
}

export async function submitAttempt(
  examId: number,
  attemptId: number,
  userId: string,
  suppliedAnswers: Array<{ questionId: number; userAnswer: string }>,
) {
  const prior = await completedResult(attemptId, userId);
  if (prior) return prior;
  const ids = suppliedAnswers.map((answer) => answer.questionId);
  if (new Set(ids).size !== ids.length) {
    throw new ApiError(400, "Duplicate question answers are not allowed.");
  }
  const attempt = await db.examAttempt.findFirst({
    where: { id: attemptId, examId, userId, status: "IN_PROGRESS" },
    include: {
      exam: {
        include: {
          questions: { where: { published: true }, orderBy: { slot: "asc" } },
        },
      },
    },
  });
  if (!attempt) throw new ApiError(404, "Attempt not found.", "ATTEMPT_NOT_FOUND");
  const allowed = new Set(attempt.exam.questions.map((question) => question.id));
  if (ids.some((id) => !allowed.has(id))) {
    throw new ApiError(400, "An answer does not belong to this exam.");
  }
  const completedAt = new Date();
  const timeTaken = Math.floor((completedAt.getTime() - attempt.startedAt.getTime()) / 1000);
  if (attempt.exam.timeLimit && timeTaken > attempt.exam.timeLimit * 60 + 10) {
    throw new ApiError(409, "The time limit has been exceeded.", "TIME_LIMIT_EXCEEDED");
  }
  const answerMap = new Map(
    suppliedAnswers.map((answer) => [answer.questionId, answer.userAnswer]),
  );
  const evaluated: Array<{
    question: (typeof attempt.exam.questions)[number];
    userAnswer: string;
    isCorrect: boolean;
    feedback?: string;
  }> = [];
  for (const question of attempt.exam.questions) {
    const userAnswer = answerMap.get(question.id) ?? "";
    const normalized = normalizeAnswer(userAnswer);
    const accepted = [question.correctAnswer, ...question.acceptedAnswers].map(normalizeAnswer);
    let isCorrect = Boolean(normalized) && accepted.includes(normalized);
    let feedback: string | undefined;
    if (question.type === "IDENTIFICATION" && normalized && !isCorrect) {
      const result = await evaluateFreeText({
        question: question.text,
        correctAnswer: question.correctAnswer,
        userAnswer,
      });
      isCorrect = result.isCorrect;
      feedback = result.feedback;
    }
    evaluated.push({ question, userAnswer, isCorrect, feedback });
  }
  const correctAnswers = evaluated.filter((answer) => answer.isCorrect).length;
  const score = evaluated.length ? (correctAnswers / evaluated.length) * 100 : 0;
  await db.$transaction(async (tx) => {
    await tx.userAnswer.createMany({
      data: evaluated.map((answer) => ({
        examAttemptId: attemptId,
        questionId: answer.question.id,
        selectedAnswer: answer.userAnswer,
        isCorrect: answer.isCorrect,
        feedback: answer.feedback,
      })),
      skipDuplicates: true,
    });
    await tx.examAttempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: { status: "COMPLETED", completedAt, score },
    });
  });
  await inngest.send({
    id: `attempt-${attemptId}`,
    name: "exam/attempt.completed",
    data: { attemptId, examId, userId, score },
  }).catch(() => undefined);
  return {
    attemptId,
    score,
    correctAnswers,
    totalQuestions: evaluated.length,
    timeTaken,
    results: evaluated.map((answer) => ({
      questionId: answer.question.id,
      isCorrect: answer.isCorrect,
      userAnswer: answer.userAnswer,
      correctAnswer: answer.question.correctAnswer,
      explanation: answer.question.explanation,
      feedback: answer.feedback,
    })),
  };
}

export async function abandonAttempt(attemptId: number, userId: string) {
  const result = await db.examAttempt.updateMany({
    where: { id: attemptId, userId, status: AttemptStatusEnum.IN_PROGRESS },
    data: { status: AttemptStatusEnum.ABANDONED, completedAt: new Date() },
  });
  if (!result.count) throw new ApiError(404, "Active attempt not found.");
}

export async function getAttemptForTaking(attemptId: number, userId: string) {
  const attempt = await db.examAttempt.findFirst({
    where: { id: attemptId, userId, status: "IN_PROGRESS" },
    include: {
      exam: {
        include: {
          questions: {
            where: { published: true },
            orderBy: { slot: "asc" },
            select: { id: true, slot: true, text: true, type: true, options: true },
          },
        },
      },
    },
  });
  if (!attempt) throw new ApiError(404, "Active attempt not found.");
  return {
    id: attempt.id,
    startedAt: attempt.startedAt,
    exam: {
      id: attempt.exam.id,
      description: attempt.exam.description,
      timeLimit: attempt.exam.timeLimit,
      questions: attempt.exam.questions,
    },
  };
}
