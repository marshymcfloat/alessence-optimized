import { z } from "zod";
import { focusModes } from "./focus";

export const questionTypeSchema = z.enum([
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "IDENTIFICATION",
  "NUMERIC",
]);
export const calculationModeSchema = z.enum(["AUTO", "ONLY"]);
export const groundingModeSchema = z.enum(["SOURCES", "MODEL_KNOWLEDGE"]);
export const focusModeSchema = z.enum(focusModes);

export const createExamJsonSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  description: z.string().trim().max(2_000).optional().default(""),
  focusMode: focusModeSchema.default("BALANCED"),
  calculationMode: calculationModeSchema.default("AUTO"),
  requestedItems: z.coerce.number().int().min(1).max(100),
  subjectId: z.coerce.number().int().positive(),
  questionTypes: z.array(questionTypeSchema).min(1).max(3),
  existingFileIds: z.array(z.coerce.number().int().positive()).max(25).default([]),
  isPracticeMode: z.boolean().default(false),
  emphasizeWeakTopics: z.boolean().default(false),
  timeLimit: z.number().int().min(1).max(600).nullable().default(null),
  allowModelKnowledge: z.boolean().default(false),
});

export const mockExamSchema = z.object({
  subjectId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(200).optional(),
  existingFileIds: z.array(z.coerce.number().int().positive()).max(25).default([]),
  allowModelKnowledge: z.boolean().default(false),
  emphasizeWeakTopics: z.boolean().default(false),
});

export const submitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        userAnswer: z.string().max(10_000),
      }),
    )
    .max(100),
});

export type CreateExamInput = z.infer<typeof createExamJsonSchema>;
