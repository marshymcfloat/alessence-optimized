import "server-only";
import { GenerationFailureCode, GenerationStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { evaluateQuestionSupport, generateStructured } from "@/lib/ai";
import { buildBlueprint, missingBlueprintSlots } from "./blueprint";
import { generatedBatchSchema, type Blueprint, type GeneratedQuestion } from "./generation-schemas";
import { generationPrompt } from "./prompts";
import { rankFilesByRelevance, retrieveChunksForBatch, type RetrievedChunk } from "./retrieval";
import { applySupportVerdicts, normalizedQuestion, validateQuestionDetailed } from "./validation";

type StepRunner = <T>(name: string, task: () => Promise<T>) => Promise<T>;
type Rejection = { slot: number; reason: string };
type BatchResult = {
  questions: GeneratedQuestion[];
  rejections: Rejection[];
  chunks: number;
  fileIds: number[];
  validationCalls: number;
  questionFileCoverage: Record<string, number>;
};

async function setState(generationId: string, status: GenerationStatus, progress: number) {
  await db.examGeneration.update({
    where: { id: generationId },
    data: { status, progress, startedAt: status === "PLANNING" ? new Date() : undefined },
  });
}

export async function loadGeneration(generationId: string) {
  const generation = await db.examGeneration.findUnique({
    where: { id: generationId },
    include: {
      exam: {
        include: {
          sourceFiles: { select: { id: true } },
          subject: { select: { title: true } },
        },
      },
    },
  });
  if (!generation) throw new Error("Generation not found.");
  if (generation.status === "READY") return null;
  return generation;
}

function normalizeTopic(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
}

export async function planGeneration(generationId: string) {
  await setState(generationId, "PLANNING", 10);
  const generation = await loadGeneration(generationId);
  if (!generation) return null;
  let weakTopics: string[] = [];
  if (generation.exam.emphasizeWeakTopics) {
    const misses = await db.userAnswer.findMany({
      where: {
        isCorrect: false,
        attempt: { userId: generation.exam.userId ?? "" },
        question: { topicLabel: { not: null }, exam: { subjectId: generation.exam.subjectId } },
      },
      select: { question: { select: { topicLabel: true } } },
    });
    const counts = new Map<string, { label: string; count: number }>();
    for (const miss of misses) {
      const label = miss.question.topicLabel;
      if (!label) continue;
      const key = normalizeTopic(label);
      const current = counts.get(key);
      counts.set(key, { label: current?.label ?? label.trim(), count: (current?.count ?? 0) + 1 });
    }
    weakTopics = [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 10).map((item) => item.label);
  }
  const fileIds = generation.exam.sourceFiles.map((file) => file.id);
  const rankedFileIds = generation.groundingMode === "SOURCES"
    ? await rankFilesByRelevance(fileIds, `${generation.exam.subject.title}\n${generation.exam.description}`)
    : [];
  const blueprint = buildBlueprint({
    count: generation.exam.requestedItems,
    types: generation.exam.questionTypes,
    description: generation.exam.description,
    weakTopics,
    rankedFileIds: rankedFileIds.slice(0, Math.min(generation.exam.requestedItems, rankedFileIds.length)),
  });
  await db.examGeneration.update({
    where: { id: generationId },
    data: { blueprint: blueprint as unknown as Prisma.InputJsonValue },
  });
  return blueprint;
}

async function contextForBatch(
  generation: NonNullable<Awaited<ReturnType<typeof loadGeneration>>>,
  slots: Blueprint["slots"],
) {
  if (generation.groundingMode === "MODEL_KNOWLEDGE") return [];
  const fileIds = generation.exam.sourceFiles.map((file) => file.id);
  const chunks = await retrieveChunksForBatch(
    fileIds,
    generation.exam.description,
    generation.exam.subject.title,
    slots,
  );
  if (!chunks.length) throw new Error("SOURCES_UNAVAILABLE: No chunks retrieved.");
  return chunks;
}

async function generateBatch(
  generation: NonNullable<Awaited<ReturnType<typeof loadGeneration>>>,
  blueprint: Blueprint,
  chunks: RetrievedChunk[],
  rejectionReasons: string[] = [],
) {
  return (await generateStructured(generationPrompt({
    description: generation.exam.description,
    blueprint,
    chunks,
    knowledgeFallback: generation.groundingMode === "MODEL_KNOWLEDGE",
    rejectionReasons,
  }), generatedBatchSchema)).questions;
}

async function produceBatch(
  generationId: string,
  blueprint: Blueprint,
  rejectionReasons: string[] = [],
): Promise<BatchResult> {
  const generation = await loadGeneration(generationId);
  if (!generation) return { questions: [], rejections: [], chunks: 0, fileIds: [], validationCalls: 0, questionFileCoverage: {} };
  const chunks = await contextForBatch(generation, blueprint.slots);
  const grounded = generation.groundingMode === "SOURCES";
  const raw = await generateBatch(generation, blueprint, chunks, rejectionReasons);
  const structurallyValid: GeneratedQuestion[] = [];
  const rejections: Rejection[] = [];
  const seenSlots = new Set<number>();
  const seenText = new Set<string>();
  for (const question of raw) {
    const key = normalizedQuestion(question.text);
    if (seenSlots.has(question.slot)) {
      rejections.push({ slot: question.slot, reason: `Slot ${question.slot} was generated more than once.` });
      continue;
    }
    if (seenText.has(key)) {
      rejections.push({ slot: question.slot, reason: `Slot ${question.slot} duplicates another question.` });
      continue;
    }
    const result = validateQuestionDetailed(question, blueprint, chunks, grounded);
    if (!result.valid) {
      rejections.push({ slot: question.slot, reason: result.reason });
      continue;
    }
    seenSlots.add(question.slot);
    seenText.add(key);
    structurallyValid.push(result.question);
  }
  const support = structurallyValid.length
    ? await evaluateQuestionSupport({ questions: structurallyValid, chunks, grounded })
    : { results: [] };
  const supported = applySupportVerdicts(structurallyValid, support.results);
  rejections.push(...supported.rejected);
  const questions = supported.accepted;
  const chunkMap = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const questionFileCoverage: Record<string, number> = {};
  for (const question of questions) {
    for (const fileId of new Set(question.citations.map((citation) => chunkMap.get(citation.chunkId)?.fileId).filter((id): id is number => Boolean(id)))) {
      questionFileCoverage[fileId] = (questionFileCoverage[fileId] ?? 0) + 1;
    }
  }
  return {
    questions,
    rejections,
    chunks: chunks.length,
    fileIds: [...new Set(chunks.map((chunk) => chunk.fileId))],
    validationCalls: structurallyValid.length ? 1 : 0,
    questionFileCoverage,
  };
}

function groups<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function mergeUniqueQuestions(
  target: GeneratedQuestion[],
  candidates: GeneratedQuestion[],
  rejections: Rejection[],
) {
  const occupied = new Set(target.map((question) => question.slot));
  const texts = new Set(target.map((question) => normalizedQuestion(question.text)));
  for (const question of candidates) {
    const key = normalizedQuestion(question.text);
    if (occupied.has(question.slot)) {
      rejections.push({ slot: question.slot, reason: `Slot ${question.slot} was generated more than once across batches.` });
    } else if (texts.has(key)) {
      rejections.push({ slot: question.slot, reason: `Slot ${question.slot} duplicates a question from another batch.` });
    } else {
      target.push(question);
      occupied.add(question.slot);
      texts.add(key);
    }
  }
}

export async function generateAndValidate(
  generationId: string,
  blueprint: Blueprint,
  runStep: StepRunner = async (_name, task) => task(),
) {
  await setState(generationId, "GENERATING", 30);
  const allResults: BatchResult[] = [];
  const initial = groups(blueprint.slots, 10);
  for (let index = 0; index < initial.length; index += 2) {
    allResults.push(...await Promise.all(initial.slice(index, index + 2).map((slots, offset) =>
      runStep(`generate-batch-${index + offset + 1}`, () => produceBatch(generationId, { slots })),
    )));
  }
  await setState(generationId, "VALIDATING", 75);
  const questions: GeneratedQuestion[] = [];
  const rejectionReasons = allResults.flatMap((result) => result.rejections);
  mergeUniqueQuestions(questions, allResults.flatMap((result) => result.questions), rejectionReasons);
  for (let repair = 0; repair < 2; repair++) {
    const missing = missingBlueprintSlots(blueprint, questions);
    if (!missing.length) break;
    await setState(generationId, "REPAIRING", 80 + repair * 5);
    const repairGroups = groups(missing, 10);
    for (let index = 0; index < repairGroups.length; index += 2) {
      const repaired = await Promise.all(repairGroups.slice(index, index + 2).map((slots, offset) => {
        const slotSet = new Set(slots.map((slot) => slot.slot));
        const reasons = rejectionReasons.filter((item) => slotSet.has(item.slot)).map((item) => item.reason);
        return runStep(`repair-${repair + 1}-batch-${index + offset + 1}`, () => produceBatch(generationId, { slots }, reasons));
      }));
      allResults.push(...repaired);
      rejectionReasons.push(...repaired.flatMap((result) => result.rejections));
      mergeUniqueQuestions(questions, repaired.flatMap((result) => result.questions), rejectionReasons);
    }
  }
  questions.sort((a, b) => a.slot - b.slot);
  const expected = new Set(blueprint.slots.map((slot) => slot.slot));
  const actual = new Set(questions.map((question) => question.slot));
  if (actual.size !== expected.size || [...expected].some((slot) => !actual.has(slot))) {
    throw new Error(`INSUFFICIENT_VALID_QUESTIONS: expected ${expected.size}, got ${actual.size}`);
  }
  const coverage: Record<string, number> = {};
  for (const result of allResults) for (const fileId of result.fileIds) coverage[fileId] = (coverage[fileId] ?? 0) + 1;
  const questionCoverage: Record<string, number> = {};
  for (const result of allResults) for (const [fileId, count] of Object.entries(result.questionFileCoverage)) {
    questionCoverage[fileId] = (questionCoverage[fileId] ?? 0) + count;
  }
  return {
    questions,
    metrics: {
      generationCalls: allResults.length,
      validationCalls: allResults.reduce((sum, result) => sum + result.validationCalls, 0),
      repairRounds: allResults.length > initial.length ? Math.min(2, Math.ceil((allResults.length - initial.length) / Math.max(1, initial.length))) : 0,
      rejectionReasons: rejectionReasons.map((item) => item.reason).slice(0, 100),
      retrievedChunkCount: allResults.reduce((sum, result) => sum + result.chunks, 0),
      retrievedFileCount: Object.keys(coverage).length,
      perFileBatchCoverage: coverage,
      perFileQuestionCoverage: questionCoverage,
    },
  };
}

export async function publishGeneration(
  generationId: string,
  questions: GeneratedQuestion[],
  startedAt: number,
  generationMetrics: Record<string, unknown> = {},
) {
  await db.$transaction(async (tx) => {
    const generation = await tx.examGeneration.findUniqueOrThrow({ where: { id: generationId } });
    if (generation.status === "READY") return;
    const newer = await tx.examGeneration.count({ where: { examId: generation.examId, version: { gt: generation.version } } });
    if (newer) throw new Error("OBSOLETE_GENERATION: A newer generation exists.");
    await tx.question.deleteMany({ where: { generationId, published: false } });
    await tx.question.createMany({
      data: questions.map((question) => ({
        examId: generation.examId, generationId, slot: question.slot, text: question.text,
        type: question.type, options: question.options, correctAnswer: question.correctAnswer,
        acceptedAnswers: question.acceptedAnswers, explanation: question.explanation,
        difficulty: question.difficulty, topicLabel: question.topicLabel, objective: question.objective,
        sourceCitations: question.citations, published: true,
      })),
      skipDuplicates: true,
    });
    await tx.examGeneration.update({
      where: { id: generationId },
      data: { status: "READY", progress: 100, completedAt: new Date(), metrics: {
        ...generationMetrics, durationMs: Date.now() - startedAt,
        generatedCount: questions.length, model: env().GEMINI_MODEL,
      } as Prisma.InputJsonValue },
    });
    await tx.exam.update({ where: { id: generation.examId }, data: { status: "READY" } });
  });
}

function failureCode(error: unknown): GenerationFailureCode {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("SOURCES_UNAVAILABLE")) return "SOURCES_UNAVAILABLE";
  if (message.includes("INSUFFICIENT_VALID_QUESTIONS")) return "INSUFFICIENT_VALID_QUESTIONS";
  if (/\b(429|500|503|timeout|overloaded)\b/i.test(message)) return "AI_TRANSIENT";
  if (/JSON|Zod|validation/i.test(message)) return "AI_INVALID_OUTPUT";
  return "INTERNAL";
}

export async function failGeneration(generationId: string, error: unknown) {
  const generation = await db.examGeneration.findUnique({ where: { id: generationId } });
  if (!generation || generation.status === "READY") return;
  const code = failureCode(error);
  await db.$transaction(async (tx) => {
    const newer = await tx.examGeneration.count({
      where: { examId: generation.examId, version: { gt: generation.version } },
    });
    await tx.examGeneration.update({ where: { id: generationId }, data: {
      status: "FAILED", failureCode: code,
      failureMessage: code === "INTERNAL" ? "Generation failed unexpectedly." : code,
      completedAt: new Date(),
    } });
    if (!newer) {
      await tx.exam.update({ where: { id: generation.examId }, data: { status: "FAILED" } });
    }
  });
}
