import { describe, expect, it } from "vitest";
import { createExamJsonSchema, mockExamSchema } from "@/features/exams/contracts";

describe("exam contracts", () => {
  const base = {
    description: "Audit evidence",
    requestedItems: 10,
    subjectId: 1,
    questionTypes: ["MULTIPLE_CHOICE"] as const,
    existingFileIds: [1],
  };

  it("defaults weak-topic emphasis off", () => {
    expect(createExamJsonSchema.parse(base).emphasizeWeakTopics).toBe(false);
    expect(mockExamSchema.parse({ subjectId: 1 }).emphasizeWeakTopics).toBe(false);
  });

  it("accepts explicit weak-topic emphasis", () => {
    expect(createExamJsonSchema.parse({ ...base, emphasizeWeakTopics: true }).emphasizeWeakTopics).toBe(true);
  });
});
