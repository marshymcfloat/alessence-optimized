import { describe, expect, it } from "vitest";
import { evaluateArithmetic, numericAnswerIsCorrect, parseNumericAnswer, scoreComputationalEvidence, validateCalculation } from "@/features/exams/computation";

describe("computational evidence", () => {
  it("scores formulas and worked numerical examples strongly", () => {
    expect(scoreComputationalEvidence("Worked example: calculate VAT on ₱50,000 at 12%. Formula: 50000 * 0.12 = 6000.")).toBeGreaterThanOrEqual(5);
  });

  it("does not mistake page numbers, dates, or isolated rates for computation", () => {
    expect(scoreComputationalEvidence("Page 14")).toBeLessThan(5);
    expect(scoreComputationalEvidence("The statute was enacted in 2024.")).toBeLessThan(5);
    expect(scoreComputationalEvidence("The applicable rate is 12 percent.")).toBeLessThan(5);
  });
});

describe("safe arithmetic and numeric grading", () => {
  const calculation = {
    expression: "(50000 * 0.12) + 100",
    expectedValue: 6100,
    toleranceType: "ABSOLUTE" as const,
    tolerance: .01,
    unit: "PHP",
    roundingInstruction: "Round to two decimal places.",
    steps: ["Multiply 50,000 by 12%.", "Add 100."],
  };

  it("evaluates precedence, parentheses, powers, and unary signs", () => {
    expect(evaluateArithmetic("2 + 3 * 4")).toBe(14);
    expect(evaluateArithmetic("(2 + 3) ^ 2")).toBe(25);
    expect(evaluateArithmetic("-5 + 8")).toBe(3);
  });

  it("rejects unsafe syntax and division by zero", () => {
    expect(() => evaluateArithmetic("process.exit()")).toThrow();
    expect(() => evaluateArithmetic("10 / 0")).toThrow();
  });

  it("validates expression/result agreement and tolerance", () => {
    expect(validateCalculation(calculation)).toBe(true);
    expect(validateCalculation({ ...calculation, expectedValue: 6200 })).toBe(false);
    expect(validateCalculation({ ...calculation, tolerance: 1000 })).toBe(false);
    expect(validateCalculation({ ...calculation, expression: "12", expectedValue: 12, steps: ["Recall 12."] })).toBe(false);
    expect(validateCalculation({ ...calculation, expression: "1 / 3", expectedValue: .33, roundingInstruction: "Round to two decimal places." })).toBe(true);
  });

  it("normalizes currency, commas, units, and applies declared tolerance", () => {
    expect(parseNumericAnswer("₱ 6,100.00 PHP", "PHP")).toBe(6100);
    expect(numericAnswerIsCorrect("6,100.005 PHP", calculation)).toBe(true);
    expect(numericAnswerIsCorrect("6,101 PHP", calculation)).toBe(false);
    expect(numericAnswerIsCorrect("not a number", calculation)).toBe(false);
  });

  it("supports percentage tolerance", () => {
    expect(numericAnswerIsCorrect("101", { ...calculation, expectedValue: 100, expression: "100", toleranceType: "PERCENT", tolerance: 1, unit: null })).toBe(true);
  });
});
