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
    const parsed = createExamJsonSchema.parse(base);
    expect(parsed.emphasizeWeakTopics).toBe(false);
    expect(parsed.title).toBe("");
    expect(mockExamSchema.parse({ subjectId: 1 }).emphasizeWeakTopics).toBe(false);
    expect(createExamJsonSchema.parse(base).calculationMode).toBe("AUTO");
  });

  it("accepts a short optional title and rejects an oversized one", () => {
    expect(createExamJsonSchema.parse({ ...base, title: "  Finals Review  " }).title).toBe("Finals Review");
    expect(() => createExamJsonSchema.parse({ ...base, title: "x".repeat(121) })).toThrow();
  });

  it("accepts computation-only mode and numeric questions", () => {
    const parsed = createExamJsonSchema.parse({ ...base, calculationMode: "ONLY", questionTypes: ["NUMERIC"] });
    expect(parsed.calculationMode).toBe("ONLY");
    expect(parsed.questionTypes).toEqual(["NUMERIC"]);
  });

  it("accepts explicit weak-topic emphasis", () => {
    expect(createExamJsonSchema.parse({ ...base, emphasizeWeakTopics: true }).emphasizeWeakTopics).toBe(true);
  });

  it("accepts blank focus and defaults to balanced mode", () => {
    const parsed = createExamJsonSchema.parse({ ...base, description: "   " });
    expect(parsed.description).toBe("");
    expect(parsed.focusMode).toBe("BALANCED");
  });

  it("accepts every focus preset and rejects oversized custom focus", () => {
    for (const focusMode of ["BALANCED", "CONCEPTS", "APPLICATIONS", "CUSTOM"] as const) {
      expect(createExamJsonSchema.parse({ ...base, focusMode }).focusMode).toBe(focusMode);
    }
    expect(() => createExamJsonSchema.parse({ ...base, description: "x".repeat(2_001) })).toThrow();
  });
});
