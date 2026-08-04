import "server-only";
import {
  ExamStatusEnum,
  GroundingMode,
  QuestionTypeEnum,
} from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";
import { inngest } from "@/inngest/client";
import { ingestFiles, assertReadyFiles } from "@/features/materials/service";
import type { CreateExamInput } from "./contracts";
import { PROMPT_VERSION } from "./generation-schemas";

export async function createExam(
  input: CreateExamInput,
  userId: string,
  newFiles: File[] = [],
) {
  const subject = await db.subject.findFirst({
    where: { id: input.subjectId, userId },
    select: { id: true },
  });
  if (!subject) throw new ApiError(404, "Subject not found.", "SUBJECT_NOT_FOUND");
  const uploaded = newFiles.length
    ? await ingestFiles(newFiles, userId, input.subjectId)
    : [];
  const fileIds = await assertReadyFiles(
    [...input.existingFileIds, ...uploaded.map((file) => file.id)],
    userId,
    input.subjectId,
  );
  if (!fileIds.length && !input.allowModelKnowledge) {
    throw new ApiError(
      400,
      "Select ready source materials or explicitly allow model knowledge.",
      "SOURCES_REQUIRED",
    );
  }
  const groundingMode: GroundingMode = fileIds.length
    ? "SOURCES"
    : "MODEL_KNOWLEDGE";
  const result = await db.$transaction(async (tx) => {
    const exam = await tx.exam.create({
      data: {
        description: input.description,
        requestedItems: input.requestedItems,
        status: ExamStatusEnum.GENERATING,
        subjectId: input.subjectId,
        questionTypes: input.questionTypes as QuestionTypeEnum[],
        isPracticeMode: input.isPracticeMode,
        emphasizeWeakTopics: input.emphasizeWeakTopics,
        timeLimit: input.timeLimit,
        userId,
        sourceFiles: { connect: fileIds.map((id) => ({ id })) },
      },
    });
    const generation = await tx.examGeneration.create({
      data: {
        examId: exam.id,
        version: 1,
        model: env().GEMINI_MODEL,
        promptVersion: PROMPT_VERSION,
        groundingMode,
      },
    });
    return { exam, generation };
  });
  try {
    await inngest.send({
      id: result.generation.id,
      name: "exam/generation.requested",
      data: { generationId: result.generation.id },
    });
  } catch (error) {
    await db.$transaction([
      db.examGeneration.update({
        where: { id: result.generation.id },
        data: {
          status: "FAILED",
          failureCode: "CONFIGURATION",
          failureMessage: "The background job could not be queued.",
          completedAt: new Date(),
        },
      }),
      db.exam.update({ where: { id: result.exam.id }, data: { status: "FAILED" } }),
    ]);
    throw error;
  }
  return {
    id: result.exam.id,
    status: result.exam.status,
    generationId: result.generation.id,
  };
}

export async function retryGeneration(examId: number, userId: string) {
  const exam = await db.exam.findFirst({
    where: { id: examId, userId },
    include: {
      sourceFiles: { select: { id: true } },
      generations: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!exam) throw new ApiError(404, "Exam not found.", "EXAM_NOT_FOUND");
  if (exam.status !== "FAILED") {
    throw new ApiError(409, "Only failed exams can be retried.", "INVALID_STATE");
  }
  const prior = exam.generations[0];
  const groundingMode = prior?.groundingMode ??
    (exam.sourceFiles.length ? GroundingMode.SOURCES : GroundingMode.MODEL_KNOWLEDGE);
  if (groundingMode === GroundingMode.SOURCES) {
    if (!exam.sourceFiles.length) {
      throw new ApiError(400, "The source materials are no longer available.", "SOURCES_UNAVAILABLE");
    }
    await assertReadyFiles(exam.sourceFiles.map((file) => file.id), userId, exam.subjectId);
  }
  const result = await db.$transaction(async (tx) => {
    const generation = await tx.examGeneration.create({
      data: {
        examId,
        version: (prior?.version ?? 0) + 1,
        model: env().GEMINI_MODEL,
        promptVersion: PROMPT_VERSION,
        groundingMode,
      },
    });
    await tx.exam.update({ where: { id: examId }, data: { status: "GENERATING" } });
    return generation;
  });
  try {
    await inngest.send({
      id: result.id,
      name: "exam/generation.requested",
      data: { generationId: result.id },
    });
  } catch (error) {
    await db.$transaction([
      db.examGeneration.update({ where: { id: result.id }, data: {
        status: "FAILED", failureCode: "CONFIGURATION",
        failureMessage: "The background job could not be queued.", completedAt: new Date(),
      } }),
      db.exam.update({ where: { id: examId }, data: { status: "FAILED" } }),
    ]);
    throw error;
  }
  return { examId, generationId: result.id, status: "GENERATING" as const };
}

export async function listExams(userId: string, subjectId?: number) {
  return db.exam.findMany({
    where: { userId, ...(subjectId ? { subjectId } : {}) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      description: true,
      requestedItems: true,
      status: true,
      questionTypes: true,
      isPracticeMode: true,
      isMock: true,
      timeLimit: true,
      subject: { select: { id: true, title: true } },
      createdAt: true,
      _count: { select: { questions: { where: { published: true } }, attempts: true } },
      generations: {
        orderBy: { version: "desc" },
        take: 1,
        select: { id: true, status: true, progress: true, failureCode: true },
      },
    },
  });
}

export async function getExam(examId: number, userId: string) {
  const exam = await db.exam.findFirst({
    where: { id: examId, userId },
    select: {
      id: true,
      description: true,
      requestedItems: true,
      status: true,
      questionTypes: true,
      isPracticeMode: true,
      isMock: true,
      timeLimit: true,
      createdAt: true,
      subject: { select: { id: true, title: true } },
      sourceFiles: { select: { id: true, name: true } },
      questions: {
        where: { published: true },
        orderBy: { slot: "asc" },
        select: {
          id: true,
          slot: true,
          text: true,
          type: true,
          options: true,
          difficulty: true,
          topicLabel: true,
          objective: true,
        },
      },
    },
  });
  if (!exam) throw new ApiError(404, "Exam not found.", "EXAM_NOT_FOUND");
  return exam;
}

export async function deleteExam(examId: number, userId: string) {
  const deleted = await db.exam.deleteMany({
    where: { id: examId, userId, status: { not: "GENERATING" } },
  });
  if (deleted.count) return;
  const exists = await db.exam.count({ where: { id: examId, userId } });
  if (!exists) throw new ApiError(404, "Exam not found.", "EXAM_NOT_FOUND");
  throw new ApiError(409, "Wait for generation to finish before removing this exam.", "EXAM_GENERATING");
}

export function parseCreateExamForm(form: FormData) {
  const questionTypes = form.getAll("questionTypes").map(String);
  const existingFileIds = form.getAll("existingFileIds").map(Number);
  return {
    description: String(form.get("description") ?? ""),
    requestedItems: Number(form.get("requestedItems")),
    subjectId: Number(form.get("subjectId")),
    questionTypes,
    existingFileIds,
    isPracticeMode: String(form.get("isPracticeMode")) === "true",
    emphasizeWeakTopics: String(form.get("emphasizeWeakTopics")) === "true",
    timeLimit: form.get("timeLimit") ? Number(form.get("timeLimit")) : null,
    allowModelKnowledge: String(form.get("allowModelKnowledge")) === "true",
  };
}
