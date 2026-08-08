import type { Blueprint, GeneratedQuestion } from "./generation-schemas";
import type { RetrievedChunk } from "./retrieval";
import { numericAnswerIsCorrect, parseNumericAnswer, validateCalculation } from "./computation";

export function normalizeAnswer(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en")
    .replace(/[.,;:!?\'"`()]/g, "").replace(/\s+/g, " ");
}

export function normalizedQuestion(value: string) {
  return normalizeAnswer(value).replace(/\b(a|an|the)\b/g, "").replace(/\s+/g, " ");
}

export function normalizeSourceText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g, " ").trim();
}

export type ValidationResult = { valid: true; question: GeneratedQuestion } | { valid: false; reason: string };

export function applySupportVerdicts(
  questions: GeneratedQuestion[],
  results: Array<{ slot: number; supported: boolean; answerEntailed: boolean; explanationAccurate: boolean; unambiguous: boolean; distractorsValid: boolean; calculationValid: boolean; reason: string }>,
) {
  const verdicts = new Map(results.map((result) => [result.slot, result]));
  const accepted: GeneratedQuestion[] = [];
  const rejected: Array<{ slot: number; reason: string }> = [];
  for (const question of questions) {
    const verdict = verdicts.get(question.slot);
    if (verdict?.supported && verdict.answerEntailed && verdict.explanationAccurate && verdict.unambiguous && verdict.distractorsValid && verdict.calculationValid) accepted.push(question);
    else rejected.push({
      slot: question.slot,
      reason: verdict?.reason ?? `Slot ${question.slot} received no support verdict.`,
    });
  }
  return { accepted, rejected };
}

export function validateQuestionDetailed(
  question: GeneratedQuestion,
  blueprint: Blueprint,
  chunks: RetrievedChunk[],
  grounded: boolean,
): ValidationResult {
  const slot = blueprint.slots.find((item) => item.slot === question.slot);
  if (!slot) return { valid: false, reason: `Slot ${question.slot} is not in the blueprint.` };
  if (slot.type !== question.type) return { valid: false, reason: `Slot ${question.slot} has the wrong question type.` };
  if (slot.difficulty !== question.difficulty) return { valid: false, reason: `Slot ${question.slot} has the wrong difficulty.` };
  if (slot.style === "COMPUTATIONAL") {
    if (!question.isComputational || !question.calculationMetadata) return { valid: false, reason: `COMPUTATION_METADATA: Slot ${question.slot} lacks validated calculation metadata.` };
    if (question.type !== "MULTIPLE_CHOICE" && question.type !== "NUMERIC") return { valid: false, reason: `COMPUTATION_FORMAT: Slot ${question.slot} uses an incompatible format.` };
    if (!validateCalculation(question.calculationMetadata)) return { valid: false, reason: `COMPUTATION_EXPRESSION: Slot ${question.slot} has an invalid expression, result, or tolerance.` };
    if (!numericAnswerIsCorrect(question.correctAnswer, question.calculationMetadata)) return { valid: false, reason: `COMPUTATION_ANSWER: Slot ${question.slot} correct answer disagrees with the calculation.` };
  } else if (question.isComputational || question.calculationMetadata) {
    return { valid: false, reason: `Slot ${question.slot} incorrectly marks a standard question as computational.` };
  }
  if (question.type === "MULTIPLE_CHOICE") {
    const unique = new Set(question.options.map(normalizeAnswer));
    if (question.options.length !== 4 || unique.size !== 4) return { valid: false, reason: `Slot ${question.slot} must have four distinct options.` };
    if (!unique.has(normalizeAnswer(question.correctAnswer))) return { valid: false, reason: `Slot ${question.slot} answer must match an option.` };
    if (question.isComputational && question.calculationMetadata && question.options.filter((option) => numericAnswerIsCorrect(option, question.calculationMetadata!)).length !== 1) {
      return { valid: false, reason: `COMPUTATION_DISTRACTORS: Slot ${question.slot} must have exactly one option within tolerance.` };
    }
  } else if (question.type === "TRUE_FALSE") {
    const options = new Set(question.options.map(normalizeAnswer));
    if (options.size !== 2 || !options.has("true") || !options.has("false") || !options.has(normalizeAnswer(question.correctAnswer))) {
      return { valid: false, reason: `Slot ${question.slot} must use True and False with a matching answer.` };
    }
  } else if (question.options.length !== 0) {
    return { valid: false, reason: `Slot ${question.slot} identification question cannot have options.` };
  }
  if (question.type === "NUMERIC" && (!question.calculationMetadata || parseNumericAnswer(question.correctAnswer, question.calculationMetadata.unit) === null)) {
    return { valid: false, reason: `COMPUTATION_ANSWER: Slot ${question.slot} numeric answer is invalid.` };
  }
  if (grounded) {
    if (!question.citations.length) return { valid: false, reason: `Slot ${question.slot} has no citation.` };
    const chunkMap = new Map(chunks.map((chunk) => [chunk.id, chunk]));
    for (const citation of question.citations) {
      const chunk = chunkMap.get(citation.chunkId);
      if (!chunk) return { valid: false, reason: `Slot ${question.slot} cites an unavailable chunk.` };
      const quote = normalizeSourceText(citation.quote);
      if (quote.length < 12 || !normalizeSourceText(chunk.text).includes(quote)) {
        return { valid: false, reason: `Slot ${question.slot} contains a quote not found in its cited chunk.` };
      }
    }
    if (slot.sourceFileId && !question.citations.some((citation) => chunkMap.get(citation.chunkId)?.fileId === slot.sourceFileId)) {
      return { valid: false, reason: `Slot ${question.slot} does not cite its assigned source file.` };
    }
  }
  return {
    valid: true,
    question: { ...question, topicLabel: slot.topic, objective: slot.objective },
  };
}

export function validateQuestion(
  question: GeneratedQuestion,
  blueprint: Blueprint,
  allowedChunkIds: Set<number>,
  grounded: boolean,
) {
  const placeholderChunks = [...allowedChunkIds].map((id) => ({ id, fileId: 0, ordinal: id, fileName: "", text: question.citations.find((citation) => citation.chunkId === id)?.quote ?? "", locator: null, pageStart: null, pageEnd: null, sectionTitle: null, computationScore: 0 }));
  return validateQuestionDetailed(question, blueprint, placeholderChunks, grounded).valid;
}

export function uniqueValidQuestions(
  questions: GeneratedQuestion[],
  existing: GeneratedQuestion[],
  blueprint: Blueprint,
  chunksOrIds: RetrievedChunk[] | Set<number>,
  grounded: boolean,
) {
  const chunks = chunksOrIds instanceof Set
    ? [...chunksOrIds].map((id) => ({ id, fileId: 0, ordinal: id, fileName: "", text: questions.flatMap((question) => question.citations).find((citation) => citation.chunkId === id)?.quote ?? "", locator: null, pageStart: null, pageEnd: null, sectionTitle: null, computationScore: 0 }))
    : chunksOrIds;
  const seenText = new Set(existing.map((question) => normalizedQuestion(question.text)));
  const seenSlots = new Set(existing.map((question) => question.slot));
  const accepted: GeneratedQuestion[] = [];
  for (const question of questions) {
    const key = normalizedQuestion(question.text);
    if (seenText.has(key) || seenSlots.has(question.slot)) continue;
    const result = validateQuestionDetailed(question, blueprint, chunks, grounded);
    if (!result.valid) continue;
    seenText.add(key);
    seenSlots.add(question.slot);
    accepted.push(result.question);
  }
  return accepted;
}
