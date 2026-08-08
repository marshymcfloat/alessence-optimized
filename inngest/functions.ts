import { inngest } from "./client";
import {
  failGeneration,
  generateAndValidate,
  loadGeneration,
  planGeneration,
  publishGeneration,
} from "@/features/exams/generation-service";
import { failAttemptReview, gradeSubmittedAttempt } from "@/features/exams/attempt-service";
import { backfillComputationScores, failMaterialIngestion, filesNeedingBackfill, processMaterial } from "@/features/materials/service";
import { CURRENT_INDEX_VERSION } from "@/features/materials/chunking";
import { NonRetriableError } from "inngest";

export const ingestMaterial = inngest.createFunction(
  {
    id: "ingest-material-v2",
    retries: 3,
    concurrency: { limit: 2 },
    onFailure: async ({ event }) => {
      const original = event.data.event as { data?: { fileId?: number } };
      if (original.data?.fileId) await failMaterialIngestion(Number(original.data.fileId), event.data.error);
    },
  },
  { event: "material/ingestion.requested" },
  async ({ event, step }) => {
    const fileId = Number(event.data.fileId);
    return step.run("extract-chunk-and-embed", () => processMaterial(fileId, false));
  },
);

export const reindexMaterial = inngest.createFunction(
  {
    id: "reindex-material-v2",
    retries: 3,
    concurrency: { limit: 1 },
    onFailure: async ({ event }) => {
      const original = event.data.event as { data?: { fileId?: number } };
      if (original.data?.fileId) await failMaterialIngestion(Number(original.data.fileId), event.data.error, true);
    },
  },
  { event: "material/reindex.requested" },
  async ({ event, step }) => {
    const fileId = Number(event.data.fileId);
    return step.run("re-extract-chunk-and-embed", () => processMaterial(fileId, true));
  },
);

export const backfillMaterialIndexes = inngest.createFunction(
  { id: "backfill-material-indexes-v2", retries: 2 },
  { cron: "17 * * * *" },
  async ({ step }) => {
    const files = await step.run("find-stale-materials", () => filesNeedingBackfill(10));
    if (!files.length) return { queued: 0, indexVersion: CURRENT_INDEX_VERSION };
    await step.run("queue-reindex", () => inngest.send(files.map((file) => ({
      id: `material-reindex-${file.id}-v${CURRENT_INDEX_VERSION}`,
      name: "material/reindex.requested",
      data: { fileId: file.id },
    }))));
    return { queued: files.length, indexVersion: CURRENT_INDEX_VERSION };
  },
);

export const backfillComputationEvidence = inngest.createFunction(
  { id: "backfill-computation-evidence-v1", retries: 2 },
  { cron: "37 * * * *" },
  async ({ step }) => ({ updated: await step.run("score-unclassified-chunks", () => backfillComputationScores(100)) }),
);

export const generateExam = inngest.createFunction(
  {
    id: "generate-exam-v1",
    retries: 3,
    concurrency: { limit: 1 },
    onFailure: async ({ event }) => {
      const original = event.data.event as { data?: { generationId?: string } };
      const generationId = original.data?.generationId;
      if (generationId) {
        await failGeneration(generationId, new Error(event.data.error.message));
      }
    },
  },
  { event: "exam/generation.requested" },
  async ({ event, step }) => {
    const generationId = event.data.generationId as string;
    const existing = await step.run("load", () => loadGeneration(generationId));
    if (!existing) return { alreadyComplete: true };
    const startedAt = await step.run("start-timer", () => Date.now());
    const blueprint = await step.run("plan", () => planGeneration(generationId));
    if (!blueprint) return { alreadyComplete: true };
    let generated;
    try {
      generated = await generateAndValidate(
        generationId,
        blueprint,
        (name, task) => step.run(name, task) as unknown as ReturnType<typeof task>,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/INSUFFICIENT_(?:VALID_QUESTIONS|COMPUTATION_EVIDENCE)/.test(message)) {
        throw new NonRetriableError(message, { cause: error });
      }
      throw error;
    }
    await step.run("publish", () =>
      publishGeneration(generationId, generated.questions, startedAt, generated.metrics),
    );
    return { generationId, questions: generated.questions.length };
  },
);

export const updateMastery = inngest.createFunction(
  { id: "update-exam-mastery-v1", retries: 2 },
  { event: "exam/attempt.completed" },
  async ({ event }) => {
    // Reserved durable boundary for the next mastery model. Scoring never depends on it.
    return { accepted: true, attemptId: event.data.attemptId };
  },
);

export const reviewAttempt = inngest.createFunction(
  {
    id: "review-exam-attempt-v1",
    retries: 3,
    concurrency: { limit: 2 },
    onFailure: async ({ event }) => {
      const original = event.data.event as { data?: { attemptId?: number } };
      const attemptId = original.data?.attemptId;
      if (attemptId) await failAttemptReview(attemptId);
    },
  },
  { event: "exam/attempt.submitted" },
  async ({ event, step }) => {
    const attemptId = Number(event.data.attemptId);
    const result = await gradeSubmittedAttempt(
      attemptId,
      (name, task) => step.run(name, task) as unknown as ReturnType<typeof task>,
    );
    await step.run("notify-attempt-completed", () => inngest.send({
      id: `attempt-completed-${attemptId}`,
      name: "exam/attempt.completed",
      data: { attemptId, examId: result.examId, userId: result.userId, score: result.score },
    }));
    return result;
  },
);
