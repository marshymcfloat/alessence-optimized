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
import { assertReadyFiles } from "@/features/materials/service";
import type { CreateExamInput } from "./contracts";
import { resolveExamFocus, resolveExamTitle } from "./focus";
import { PROMPT_VERSION } from "./generation-schemas";
import { academicYearForPeriod, type StudyPeriod } from "@/lib/study-period";
import { scoreComputationalEvidence, STRONG_COMPUTATION_SCORE } from "./computation";

async function ensureComputationScores(fileIds: number[]) {
  if (!fileIds.length) return;
  const chunks = await db.documentChunk.findMany({
    where: { fileId: { in: fileIds }, computationScored: false },
    select: { id: true, text: true },
  });
  for (let index = 0; index < chunks.length; index += 100) {
    await db.$transaction(chunks.slice(index, index + 100).map((chunk) => db.documentChunk.update({
      where: { id: chunk.id },
      data: { computationScore: scoreComputationalEvidence(chunk.text), computationScored: true },
    })));
  }
}

export async function createExam(
  input: CreateExamInput,
  userId: string,
  newFiles: File[] = [],
) {
  const subject = await db.subject.findFirst({
    where: { id: input.subjectId, userId },
    select: { id: true, title: true },
  });
  if (!subject) throw new ApiError(404, "Subject not found.", "SUBJECT_NOT_FOUND");
  if (newFiles.length) {
    throw new ApiError(400, "Upload new source files from Materials and wait for indexing before creating an exam.", "SOURCES_PROCESSING");
  }
  const fileIds = await assertReadyFiles(
    input.existingFileIds,
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
  const compatibleTypes = input.questionTypes.filter((type) => type === "MULTIPLE_CHOICE" || type === "NUMERIC");
  await ensureComputationScores(fileIds);
  if (input.calculationMode === "ONLY") {
    if (!fileIds.length) throw new ApiError(400, "Computation-only exams require ready source materials.", "SOURCES_REQUIRED");
    if (!compatibleTypes.length || compatibleTypes.length !== input.questionTypes.length) {
      throw new ApiError(400, "Computation-only exams support multiple-choice and numeric-answer questions only.", "VALIDATION_ERROR");
    }
    const strongChunks = await db.documentChunk.count({ where: { fileId: { in: fileIds }, computationScore: { gte: STRONG_COMPUTATION_SCORE } } });
    if (strongChunks * 2 < input.requestedItems) {
      throw new ApiError(422, "The selected reviewers do not contain enough formulas or worked examples for this many computation questions. Select more suitable reviewers or request fewer items.", "INSUFFICIENT_COMPUTATION_EVIDENCE");
    }
  }
  const groundingMode: GroundingMode = fileIds.length
    ? "SOURCES"
    : "MODEL_KNOWLEDGE";
  const focus = resolveExamFocus({
    description: input.description,
    focusMode: input.focusMode,
    subjectTitle: subject.title,
    hasSources: fileIds.length > 0,
  });
  const title = resolveExamTitle({ title: input.title, subjectTitle: subject.title, focusMode: input.focusMode });
  const result = await db.$transaction(async (tx) => {
    const exam = await tx.exam.create({
      data: {
        title,
        description: focus.value,
        requestedItems: input.requestedItems,
        status: ExamStatusEnum.GENERATING,
        subjectId: input.subjectId,
        questionTypes: input.questionTypes as QuestionTypeEnum[],
        isPracticeMode: input.isPracticeMode,
        emphasizeWeakTopics: input.emphasizeWeakTopics,
        calculationMode: input.calculationMode,
        timeLimit: input.timeLimit,
        userId,
        sourceFiles: { connect: fileIds.map((id) => ({ id })) },
      },
    });
    const generation = await tx.examGeneration.create({
      data: {
        examId: exam.id,
        version: 1,
        model: env().OPENAI_MODEL,
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
        model: env().OPENAI_MODEL,
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

export async function listExams(userId: string, subjectId?: number, period: StudyPeriod = "current") {
  const academicYear = academicYearForPeriod(period);
  return db.exam.findMany({
    where: { userId, ...(subjectId ? { subjectId } : {}), ...(academicYear ? { academicYear } : {}) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
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
      title: true,
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
    title: String(form.get("title") ?? ""),
    focusMode: String(form.get("focusMode") ?? "BALANCED"),
    calculationMode: String(form.get("calculationMode") ?? "AUTO"),
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
