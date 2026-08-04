import type { QuestionTypeEnum } from "@prisma/client";
import type { Blueprint, GeneratedQuestion } from "./generation-schemas";

const difficultyPattern = ["MEDIUM", "HARD", "EASY", "HARD", "MEDIUM"] as const;

export function distributeTypes(count: number, types: QuestionTypeEnum[]) {
  const result = new Map<QuestionTypeEnum, number>();
  types.forEach((type) => result.set(type, Math.floor(count / types.length)));
  for (let index = 0; index < count % types.length; index++) {
    const type = types[index]!;
    result.set(type, (result.get(type) ?? 0) + 1);
  }
  return result;
}

export function buildBlueprint(input: {
  count: number;
  types: QuestionTypeEnum[];
  description: string;
  weakTopics: string[];
  rankedFileIds?: number[];
}): Blueprint {
  const distribution = distributeTypes(input.count, input.types);
  const remaining = new Map(distribution);
  const scheduledTypes = Array.from({ length: input.count }, (_, index) => {
    const ordered = input.types.map((_, offset) => input.types[(index + offset) % input.types.length]!);
    const selected = ordered.find((type) => (remaining.get(type) ?? 0) > 0)!;
    remaining.set(selected, (remaining.get(selected) ?? 0) - 1);
    return selected;
  });
  const weakSlots = Math.min(
    Math.floor(input.count * 0.4),
    input.weakTopics.length ? input.count : 0,
  );
  return {
    slots: scheduledTypes.map((type, index) => {
      const difficulty = difficultyPattern[index % difficultyPattern.length];
      const topic =
        index < weakSlots
          ? input.weakTopics[index % input.weakTopics.length]!
          : input.description;
      return {
        slot: index + 1,
        type,
        difficulty,
        topic,
        objective: `Assess ${difficulty.toLowerCase()}-level understanding of ${topic}`,
        sourceFileId: input.rankedFileIds?.[index] ?? null,
      };
    }),
  };
}

export function missingBlueprintSlots(blueprint: Blueprint, questions: GeneratedQuestion[]) {
  const present = new Set(questions.map((question) => question.slot));
  return blueprint.slots.filter((slot) => !present.has(slot.slot));
}
