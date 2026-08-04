import { inngest } from "./client";
import {
  failGeneration,
  generateAndValidate,
  loadGeneration,
  planGeneration,
  publishGeneration,
} from "@/features/exams/generation-service";

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
    const generated = await generateAndValidate(
      generationId,
      blueprint,
      (name, task) => step.run(name, task) as unknown as ReturnType<typeof task>,
    );
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
