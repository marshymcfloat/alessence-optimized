export const STRONG_COMPUTATION_SCORE = 5;

export type CalculationMetadata = {
  expression: string;
  expectedValue: number;
  toleranceType: "ABSOLUTE" | "PERCENT";
  tolerance: number;
  unit: string | null;
  roundingInstruction: string;
  steps: string[];
};

export function scoreComputationalEvidence(text: string) {
  const value = text.normalize("NFKC");
  const numbers = value.match(/(?:₱|\$|€|£)?\s*-?\d[\d,]*(?:\.\d+)?\s*(?:%|percent|kg|g|mg|km|m|cm|mm|hours?|days?|years?|units?)?/gi) ?? [];
  let score = 0;
  if (/\b(calculate|compute|determine|solve|derive|formula|solution|computation)\b/i.test(value)) score += 3;
  if (/\b(worked example|example problem|given|required|step \d+)\b/i.test(value)) score += 2;
  if (/[=×÷+*/^]|\b(rate|ratio|percentage|interest|tax|discount|variance|mean|cost|revenue|profit)\b/i.test(value)) score += 2;
  if (numbers.length >= 2) score += 2;
  if (numbers.length >= 4) score += 1;
  if (numbers.length < 2) score = Math.min(score, 3);
  if (/^(?:page|chapter|section)\s+\d+\s*$/i.test(value.trim()) || /^\d{4}$/.test(value.trim())) score = 0;
  return Math.max(0, Math.min(10, score));
}

type Token = number | "+" | "-" | "*" | "/" | "^" | "(" | ")";

export function evaluateArithmetic(expression: string) {
  if (!expression.trim() || !/^[\d\s.+\-*/^()]+$/.test(expression)) throw new Error("Expression contains unsupported characters.");
  const raw = expression.match(/\d+(?:\.\d+)?|[()+\-*/^]/g) ?? [];
  if (raw.join("").length !== expression.replace(/\s/g, "").length) throw new Error("Expression is invalid.");
  const tokens: Token[] = raw.map((token) => /^\d/.test(token) ? Number(token) : token as Token);
  let index = 0;
  const parsePrimary = (): number => {
    const token = tokens[index++];
    if (typeof token === "number") return token;
    if (token === "(") {
      const value = parseAdd();
      if (tokens[index++] !== ")") throw new Error("Unclosed parenthesis.");
      return value;
    }
    if (token === "+") return parsePrimary();
    if (token === "-") return -parsePrimary();
    throw new Error("Expected a number.");
  };
  const parsePower = (): number => {
    let value = parsePrimary();
    if (tokens[index] === "^") { index++; value **= parsePower(); }
    return value;
  };
  const parseMultiply = (): number => {
    let value = parsePower();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index++];
      const right = parsePower();
      if (operator === "/" && right === 0) throw new Error("Division by zero.");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  };
  const parseAdd = (): number => {
    let value = parseMultiply();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      const right = parseMultiply();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };
  const result = parseAdd();
  if (index !== tokens.length || !Number.isFinite(result)) throw new Error("Expression is invalid.");
  return result;
}

export function parseNumericAnswer(input: string, unit: string | null) {
  let value = input.normalize("NFKC").trim();
  if (unit) value = value.replace(new RegExp(`${escapeRegExp(unit)}\\s*$`, "i"), "").trim();
  value = value.replace(/^[₱$€£]\s*/, "").replace(/,/g, "");
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function numericAnswerIsCorrect(input: string, metadata: CalculationMetadata) {
  const actual = parseNumericAnswer(input, metadata.unit);
  if (actual === null) return false;
  const allowed = metadata.toleranceType === "PERCENT"
    ? Math.abs(metadata.expectedValue) * metadata.tolerance / 100
    : metadata.tolerance;
  return Math.abs(actual - metadata.expectedValue) <= allowed + Number.EPSILON;
}

export function validateCalculation(metadata: CalculationMetadata) {
  if (!(metadata.tolerance > 0) || metadata.tolerance > (metadata.toleranceType === "PERCENT" ? 10 : Math.max(1, Math.abs(metadata.expectedValue) * .1))) return false;
  if (!metadata.roundingInstruction.trim() || !metadata.steps.length) return false;
  if ((metadata.expression.match(/\d+(?:\.\d+)?/g) ?? []).length < 2 || !/[+\-*/^]/.test(metadata.expression)) return false;
  try {
    const evaluated = evaluateArithmetic(metadata.expression);
    const epsilon = Math.max(1e-9, Math.abs(metadata.expectedValue) * 1e-9);
    const rounded = applyDeclaredRounding(evaluated, metadata.roundingInstruction);
    return Math.abs(rounded - metadata.expectedValue) <= epsilon;
  } catch { return false; }
}

function applyDeclaredRounding(value: number, instruction: string) {
  const normalized = instruction.toLowerCase();
  const decimal = normalized.match(/(?:to|nearest)\s+(zero|one|two|three|four|five|six|\d+)\s+decimal places?/);
  const words: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  if (decimal) {
    const places = words[decimal[1]!] ?? Number(decimal[1]);
    const factor = 10 ** places;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
  if (/nearest\s+(?:whole|integer)/.test(normalized)) return Math.round(value);
  if (/nearest\s+tenth/.test(normalized)) return Math.round((value + Number.EPSILON) * 10) / 10;
  if (/nearest\s+hundredth/.test(normalized)) return Math.round((value + Number.EPSILON) * 100) / 100;
  return value;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
