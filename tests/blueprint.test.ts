import { describe, expect, it } from "vitest";
import { buildBlueprint, distributeTypes, missingBlueprintSlots } from "@/features/exams/blueprint";

describe("exam blueprint", () => {
  it("distributes every requested slot", () => {
    const distribution = distributeTypes(10, [
      "MULTIPLE_CHOICE",
      "TRUE_FALSE",
      "IDENTIFICATION",
    ]);
    expect([...distribution.values()].reduce((sum, count) => sum + count, 0)).toBe(10);
  });

  it("caps weak-topic targeting at forty percent", () => {
    const blueprint = buildBlueprint({
      count: 10,
      types: ["MULTIPLE_CHOICE"],
      description: "Taxation",
      weakTopics: ["VAT"],
    });
    expect(blueprint.slots).toHaveLength(10);
    expect(blueprint.slots.filter((slot) => slot.topic === "VAT")).toHaveLength(4);
    expect(blueprint.slots.map((slot) => slot.slot)).toEqual([1,2,3,4,5,6,7,8,9,10]);
  });

  it("interleaves types and keeps the 20/40/40 difficulty mix", () => {
    const blueprint = buildBlueprint({
      count: 10,
      types: ["MULTIPLE_CHOICE", "TRUE_FALSE", "IDENTIFICATION"],
      description: "Audit",
      weakTopics: [],
    });
    expect(blueprint.slots.slice(0, 6).map((slot) => slot.type)).toEqual([
      "MULTIPLE_CHOICE", "TRUE_FALSE", "IDENTIFICATION",
      "MULTIPLE_CHOICE", "TRUE_FALSE", "IDENTIFICATION",
    ]);
    expect(blueprint.slots.filter((slot) => slot.difficulty === "EASY")).toHaveLength(2);
    expect(blueprint.slots.filter((slot) => slot.difficulty === "MEDIUM")).toHaveLength(4);
    expect(blueprint.slots.filter((slot) => slot.difficulty === "HARD")).toHaveLength(4);
  });

  it("assigns one guaranteed slot to every ranked file when possible", () => {
    const blueprint = buildBlueprint({
      count: 5,
      types: ["MULTIPLE_CHOICE"],
      description: "Tax",
      weakTopics: [],
      rankedFileIds: [30, 10, 20],
    });
    expect(blueprint.slots.map((slot) => slot.sourceFileId)).toEqual([30, 10, 20, null, null]);
  });

  it("uses reviewer names for assigned slots and subject coverage for global slots", () => {
    const blueprint = buildBlueprint({
      count: 3,
      types: ["MULTIPLE_CHOICE"],
      description: "Automatic focus",
      subjectTitle: "Auditing",
      weakTopics: [],
      rankedFileIds: [10],
      sourceFileNames: { 10: "Chapter_01-Audit-Evidence.pdf" },
    });
    expect(blueprint.slots[0]?.topic).toBe("Chapter 01 Audit Evidence");
    expect(blueprint.slots[1]?.topic).toBe("Comprehensive Auditing coverage");
  });

  it("finds missing slots by unique slot ID instead of question count", () => {
    const blueprint = buildBlueprint({ count: 2, types: ["MULTIPLE_CHOICE"], description: "Tax", weakTopics: [] });
    const duplicate = {
      slot: 1, text: "A sufficiently long question?", type: "MULTIPLE_CHOICE" as const,
      options: ["A", "B", "C", "D"], correctAnswer: "A", acceptedAnswers: [], explanation: "Reason",
      difficulty: "EASY" as const, topicLabel: "Tax", objective: "Test", citations: [],
      isComputational: false, calculationMetadata: null,
    };
    expect(missingBlueprintSlots(blueprint, [duplicate, { ...duplicate, text: "Another long question?" }]).map((slot) => slot.slot)).toEqual([2]);
  });

  it("allocates computational slots only to compatible formats", () => {
    const blueprint = buildBlueprint({ count: 10, types: ["TRUE_FALSE", "MULTIPLE_CHOICE", "NUMERIC"], description: "Tax", weakTopics: [], computationalCount: 3 });
    expect(blueprint.slots.filter((slot) => slot.style === "COMPUTATIONAL")).toHaveLength(3);
    expect(blueprint.slots.filter((slot) => slot.style === "COMPUTATIONAL").every((slot) => slot.type === "MULTIPLE_CHOICE" || slot.type === "NUMERIC")).toBe(true);
  });

  it("does not force computation when selected formats are incompatible", () => {
    const blueprint = buildBlueprint({ count: 5, types: ["TRUE_FALSE", "IDENTIFICATION"], description: "Law", weakTopics: [], computationalCount: 2 });
    expect(blueprint.slots.every((slot) => slot.style === "STANDARD")).toBe(true);
  });

  it("always marks numeric-answer slots as computational", () => {
    const blueprint = buildBlueprint({ count: 6, types: ["MULTIPLE_CHOICE", "NUMERIC"], description: "Accounting", weakTopics: [], computationalCount: 1 });
    expect(blueprint.slots.filter((slot) => slot.type === "NUMERIC").every((slot) => slot.style === "COMPUTATIONAL")).toBe(true);
  });
});
