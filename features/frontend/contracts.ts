import { z } from "zod";

export const subjectInputSchema = z.object({
  title: z.string().trim().min(2).max(80),
});

export const subjectSummarySchema = z.object({
  id: z.number(),
  title: z.string(),
  archived: z.boolean(),
  materialCount: z.number(),
  examCount: z.number(),
});

export const materialSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  size: z.number(),
  type: z.enum(["PDF", "DOCX", "TEXT"]),
  ingestionStatus: z.enum(["PROCESSING", "READY", "FAILED"]),
  ingestionError: z.string().nullable(),
  indexedAt: z.string().nullable(),
  createdAt: z.string(),
  subject: z.object({ id: z.number(), title: z.string() }).nullable(),
  examCount: z.number(),
});

export const progressSummarySchema = z.object({
  examCount: z.number(),
  completedAttempts: z.number(),
  averageScore: z.number(),
  readyExams: z.number(),
  materialCount: z.number(),
  recentAttempts: z.array(
    z.object({
      id: z.number(),
      examId: z.number(),
      examTitle: z.string(),
      subjectTitle: z.string(),
      score: z.number(),
      completedAt: z.string(),
    }),
  ),
  weakTopics: z.array(
    z.object({
      topic: z.string(),
      misses: z.number(),
    }),
  ),
});

export type SubjectSummary = z.infer<typeof subjectSummarySchema>;
export type MaterialSummary = z.infer<typeof materialSummarySchema>;
export type ProgressSummary = z.infer<typeof progressSummarySchema>;
