import { z } from "zod";

export const PROMPT_VERSION = "exam-v3-hybrid-rag";

export const blueprintSlotSchema = z.object({
  slot: z.number().int().positive(),
  type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "IDENTIFICATION", "NUMERIC"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  topic: z.string().min(1).max(160),
  objective: z.string().min(1).max(240),
  sourceFileId: z.number().int().positive().nullable().default(null),
  style: z.enum(["STANDARD", "COMPUTATIONAL"]).default("STANDARD"),
});

export const blueprintSchema = z.object({
  slots: z.array(blueprintSlotSchema).min(1).max(100),
});

export const citationSchema = z.object({
  chunkId: z.number().int().positive(),
  quote: z.string().min(1).max(300),
});

export const calculationMetadataSchema = z.object({
  expression: z.string().trim().min(1).max(500),
  expectedValue: z.number().finite(),
  toleranceType: z.enum(["ABSOLUTE", "PERCENT"]),
  tolerance: z.number().positive(),
  unit: z.string().trim().max(40).nullable(),
  roundingInstruction: z.string().trim().min(1).max(200),
  steps: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
});

export const generatedQuestionSchema = z.object({
  slot: z.number().int().positive(),
  text: z.string().trim().min(10).max(4_000),
  type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "IDENTIFICATION", "NUMERIC"]),
  options: z.array(z.string().trim().min(1).max(1_000)).max(6),
  correctAnswer: z.string().trim().min(1).max(2_000),
  acceptedAnswers: z.array(z.string().trim().min(1).max(500)).max(10).default([]),
  explanation: z.string().trim().min(1).max(4_000),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  topicLabel: z.string().trim().min(1).max(160),
  objective: z.string().trim().min(1).max(240),
  citations: z.array(citationSchema).max(5),
  isComputational: z.boolean().default(false),
  calculationMetadata: calculationMetadataSchema.nullable().default(null),
});

export const generatedBatchSchema = z.object({
  questions: z.array(generatedQuestionSchema).max(10),
});

export const supportEvaluationSchema = z.object({
  results: z.array(z.object({
    slot: z.number().int().positive(),
    supported: z.boolean(),
    answerEntailed: z.boolean(),
    explanationAccurate: z.boolean(),
    unambiguous: z.boolean(),
    distractorsValid: z.boolean(),
    calculationValid: z.boolean(),
    reason: z.string().trim().min(1).max(500),
  })).max(10),
});

export type Blueprint = z.infer<typeof blueprintSchema>;
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
