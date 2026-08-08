import { describe, expect, it } from "vitest";
import { applySupportVerdicts, normalizeAnswer, uniqueValidQuestions, validateQuestionDetailed } from "@/features/exams/validation";
import type { Blueprint, GeneratedQuestion } from "@/features/exams/generation-schemas";

const blueprint: Blueprint = {
  slots: [
    {
      slot: 1,
      type: "MULTIPLE_CHOICE",
      difficulty: "MEDIUM",
      topic: "Tax",
      objective: "Apply VAT",
      sourceFileId: null,
      style: "STANDARD",
    },
  ],
};

const valid: GeneratedQuestion = {
  slot: 1,
  text: "Which transaction is subject to value-added tax?",
  type: "MULTIPLE_CHOICE",
  options: ["Sale A", "Sale B", "Sale C", "Sale D"],
  correctAnswer: "Sale B",
  acceptedAnswers: [],
  explanation: "The source identifies Sale B.",
  difficulty: "MEDIUM",
  topicLabel: "Tax",
  objective: "Apply VAT",
  citations: [{ chunkId: 7, quote: "Sale B is subject to VAT." }],
  isComputational: false,
  calculationMetadata: null,
};

describe("question validation", () => {
  it("normalizes objective answers without case or punctuation", () => {
    expect(normalizeAnswer("  TRUE. ")).toBe("true");
  });

  it("accepts a grounded valid question", () => {
    expect(
      uniqueValidQuestions([valid], [], blueprint, new Set([7]), true),
    ).toHaveLength(1);
  });

  it("rejects missing or unauthorized citations", () => {
    expect(
      uniqueValidQuestions([valid], [], blueprint, new Set([9]), true),
    ).toHaveLength(0);
  });

  it("rejects duplicate option values", () => {
    const invalid = { ...valid, options: ["A", "A", "B", "C"], correctAnswer: "A" };
    expect(
      uniqueValidQuestions([invalid], [], blueprint, new Set([7]), true),
    ).toHaveLength(0);
  });

  it("rejects a fabricated quote even when the chunk ID is valid", () => {
    const result = validateQuestionDetailed(valid, blueprint, [{
      id: 7, fileId: 4, ordinal: 0, fileName: "Tax.pdf", locator: null, pageStart: null, pageEnd: null, sectionTitle: null, computationScore: 0, text: "The reviewer discusses percentage tax only.",
    }], true);
    expect(result.valid).toBe(false);
  });

  it("accepts an exact normalized quote and replaces AI topic metadata", () => {
    const result = validateQuestionDetailed(
      { ...valid, topicLabel: "Invented label", objective: "Invented objective" },
      blueprint,
      [{ id: 7, fileId: 4, ordinal: 0, fileName: "Tax.pdf", locator: null, pageStart: null, pageEnd: null, sectionTitle: null, computationScore: 0, text: "Under the rule, Sale B is subject to VAT." }],
      true,
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.question.topicLabel).toBe("Tax");
      expect(result.question.objective).toBe("Apply VAT");
    }
  });

  it("requires a citation from the slot's assigned file", () => {
    const assigned = { slots: [{ ...blueprint.slots[0], sourceFileId: 9 }] };
    expect(validateQuestionDetailed(valid, assigned, [{
      id: 7, fileId: 4, ordinal: 0, fileName: "Tax.pdf", locator: null, pageStart: null, pageEnd: null, sectionTitle: null, computationScore: 0, text: "Sale B is subject to VAT.",
    }], true).valid).toBe(false);
  });

  it("rejects unsupported and missing semantic support verdicts", () => {
    const second = { ...valid, slot: 2, text: "What other transaction is subject to VAT?" };
    const result = applySupportVerdicts([valid, second], [{ slot: 1, supported: false, answerEntailed: false, explanationAccurate: true, unambiguous: true, distractorsValid: true, calculationValid: true, reason: "Answer is not entailed." }]);
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected).toEqual([
      { slot: 1, reason: "Answer is not entailed." },
      { slot: 2, reason: "Slot 2 received no support verdict." },
    ]);
  });

  it("accepts a deterministic computational numeric question", () => {
    const computationalBlueprint: Blueprint = { slots: [{ ...blueprint.slots[0], type: "NUMERIC", style: "COMPUTATIONAL" }] };
    const question: GeneratedQuestion = {
      ...valid, type: "NUMERIC", options: [], correctAnswer: "120", isComputational: true,
      calculationMetadata: { expression: "1000 * 0.12", expectedValue: 120, toleranceType: "ABSOLUTE", tolerance: .01, unit: null, roundingInstruction: "Round to two decimals.", steps: ["Multiply 1,000 by 12%."] },
    };
    const result = validateQuestionDetailed(question, computationalBlueprint, [{ id: 7, fileId: 4, ordinal: 0, fileName: "Tax.pdf", locator: "Page 1", pageStart: 1, pageEnd: 1, sectionTitle: null, computationScore: 8, text: "Calculate the tax on 1,000 at a rate of 12 percent. Sale B is subject to VAT." }], true);
    expect(result.valid).toBe(true);
  });

  it("rejects number recall and expression/result disagreement as computation", () => {
    const computationalBlueprint: Blueprint = { slots: [{ ...blueprint.slots[0], type: "NUMERIC", style: "COMPUTATIONAL" }] };
    const question: GeneratedQuestion = {
      ...valid, type: "NUMERIC", options: [], correctAnswer: "12", isComputational: true,
      calculationMetadata: { expression: "10 + 1", expectedValue: 12, toleranceType: "ABSOLUTE", tolerance: .01, unit: "%", roundingInstruction: "Enter the rate.", steps: ["Recall the rate."] },
    };
    expect(validateQuestionDetailed(question, computationalBlueprint, [], false).valid).toBe(false);
  });
});
