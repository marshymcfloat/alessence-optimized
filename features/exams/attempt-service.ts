import "server-only";
import { AttemptStatusEnum } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { evaluateFreeText } from "@/lib/ai";
import { inngest } from "@/inngest/client";
import { normalizeAnswer } from "./validation";
import { numericAnswerIsCorrect, type CalculationMetadata } from "./computation";

export async function startAttempt(examId: number, userId: string) {
  const exam = await db.exam.findFirst({
    where: { id: examId, userId },
    include: {
      questions: {
        where: { published: true },
        orderBy: { slot: "asc" },
        select: { id: true, slot: true, text: true, type: true, options: true, calculationMetadata: true },
      },
    },
  });
  if (!exam) throw new ApiError(404, "Exam not found.", "EXAM_NOT_FOUND");
  if (exam.status !== "READY") {
    throw new ApiError(409, "Exam is not ready.", "EXAM_NOT_READY");
  }
  const existing = await db.examAttempt.findFirst({
    where: { examId, userId, status: { in: ["IN_PROGRESS", "SUBMITTING", "SUBMISSION_FAILED"] } },
  });
  if (existing) {
    if (existing.status !== "IN_PROGRESS") {
      throw new ApiError(409, "Your previous attempt is still being reviewed.", "ATTEMPT_REVIEW_PENDING");
    }
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
      where: { examId, userId, status: { in: ["SUBMITTING", "SUBMISSION_FAILED", "COMPLETED"] } },
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
  if (prior) return { attemptId, status: "COMPLETED" as const };
  const pendingAttempt = await db.examAttempt.findFirst({
    where: { id: attemptId, examId, userId, status: "SUBMITTING" },
    select: { id: true },
  });
  if (pendingAttempt) return { attemptId, status: "SUBMITTING" as const };
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
  const submittedAt = new Date();
  const timeTaken = Math.floor((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000);
  if (attempt.exam.timeLimit && timeTaken > attempt.exam.timeLimit * 60 + 10) {
    throw new ApiError(409, "The time limit has been exceeded.", "TIME_LIMIT_EXCEEDED");
  }
  const answerMap = new Map(
    suppliedAnswers.map((answer) => [answer.questionId, answer.userAnswer]),
  );
  const initialAnswers = attempt.exam.questions.map((question) => {
    const userAnswer = answerMap.get(question.id) ?? "";
    const normalized = normalizeAnswer(userAnswer);
    const accepted = [question.correctAnswer, ...question.acceptedAnswers].map(normalizeAnswer);
    const calculation = question.calculationMetadata as CalculationMetadata | null;
    const isCorrect = question.type === "NUMERIC" && calculation
      ? numericAnswerIsCorrect(userAnswer, calculation)
      : Boolean(normalized) && accepted.includes(normalized);
    return { question, userAnswer, isCorrect };
  });
  await db.$transaction(async (tx) => {
    await tx.userAnswer.createMany({
      data: initialAnswers.map((answer) => ({
        examAttemptId: attemptId,
        questionId: answer.question.id,
        selectedAnswer: answer.userAnswer,
        isCorrect: answer.isCorrect,
      })),
      skipDuplicates: true,
    });
    const updated = await tx.examAttempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: { status: "SUBMITTING", submittedAt },
    });
    if (!updated.count) throw new ApiError(409, "This attempt has already been submitted.", "ATTEMPT_ALREADY_SUBMITTED");
  });
  try {
    await inngest.send({
      id: `attempt-review-${attemptId}`,
      name: "exam/attempt.submitted",
      data: { attemptId },
    });
  } catch (error) {
    await db.examAttempt.updateMany({ where: { id: attemptId, status: "SUBMITTING" }, data: { status: "SUBMISSION_FAILED" } });
    throw error;
  }
  return { attemptId, status: "SUBMITTING" as const, timeTaken };
}

type StepRunner = <T>(name: string, task: () => Promise<T>) => Promise<T>;

export async function gradeSubmittedAttempt(
  attemptId: number,
  runStep: StepRunner = async (_name, task) => task(),
) {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      examId: true,
      userId: true,
      status: true,
      score: true,
      answers: {
        orderBy: { question: { slot: "asc" } },
        select: {
          id: true,
          selectedAnswer: true,
          isCorrect: true,
          feedback: true,
          question: {
            select: { type: true, text: true, correctAnswer: true },
          },
        },
      },
    },
  });
  if (!attempt) throw new Error("ATTEMPT_NOT_FOUND");
  if (attempt.status === "COMPLETED") return { attemptId, examId: attempt.examId, userId: attempt.userId, score: attempt.score ?? 0, alreadyComplete: true };
  if (attempt.status !== "SUBMITTING") throw new Error(`INVALID_ATTEMPT_STATUS: ${attempt.status}`);

  const graded = attempt.answers.map((answer) => ({
    id: answer.id,
    isCorrect: answer.isCorrect,
    feedback: answer.feedback as string | null,
    needsReview: answer.question.type === "IDENTIFICATION"
      && Boolean(normalizeAnswer(answer.selectedAnswer))
      && !answer.isCorrect
      && !answer.feedback,
    question: answer.question.text,
    correctAnswer: answer.question.correctAnswer,
    userAnswer: answer.selectedAnswer,
  }));
  const pending = graded.filter((answer) => answer.needsReview);
  for (let index = 0; index < pending.length; index += 2) {
    await Promise.all(pending.slice(index, index + 2).map(async (answer) => {
      const result = await runStep(`grade-answer-${answer.id}`, () => evaluateFreeText({
        question: answer.question,
        correctAnswer: answer.correctAnswer,
        userAnswer: answer.userAnswer,
      }));
      answer.isCorrect = result.isCorrect;
      answer.feedback = result.feedback;
    }));
  }
  const correctAnswers = graded.filter((answer) => answer.isCorrect).length;
  const score = graded.length ? (correctAnswers / graded.length) * 100 : 0;
  const completedAt = new Date();
  const reviewed = graded.filter((answer) => answer.needsReview);
  if (reviewed.length) {
    await db.$transaction(reviewed.map((answer) => db.userAnswer.update({
      where: { id: answer.id },
      data: { isCorrect: answer.isCorrect, feedback: answer.feedback },
    })));
  }
  await db.examAttempt.updateMany({
    where: { id: attemptId, status: "SUBMITTING" },
    data: { status: "COMPLETED", score, completedAt },
  });
  return { attemptId, examId: attempt.examId, userId: attempt.userId, score, correctAnswers, totalQuestions: graded.length };
}

export async function failAttemptReview(attemptId: number) {
  await db.examAttempt.updateMany({
    where: { id: attemptId, status: "SUBMITTING" },
    data: { status: "SUBMISSION_FAILED" },
  });
}

export async function retryAttemptReview(attemptId: number, userId: string) {
  const updated = await db.examAttempt.updateMany({
    where: { id: attemptId, userId, status: "SUBMISSION_FAILED" },
    data: { status: "SUBMITTING" },
  });
  if (!updated.count) throw new ApiError(409, "This attempt is not waiting for a review retry.", "INVALID_STATE");
  try {
    await inngest.send({ id: `attempt-review-retry-${attemptId}-${Date.now()}`, name: "exam/attempt.submitted", data: { attemptId } });
  } catch (error) {
    await db.examAttempt.update({ where: { id: attemptId }, data: { status: "SUBMISSION_FAILED" } });
    throw error;
  }
  return { attemptId, status: "SUBMITTING" as const };
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
            select: { id: true, slot: true, text: true, type: true, options: true, calculationMetadata: true },
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
      title: attempt.exam.title,
      description: attempt.exam.description,
      timeLimit: attempt.exam.timeLimit,
      questions: attempt.exam.questions,
    },
  };
}
