export const focusModes = ["BALANCED", "CONCEPTS", "APPLICATIONS", "CUSTOM"] as const;
export type FocusMode = (typeof focusModes)[number];

export function resolveExamFocus(input: {
  description?: string;
  focusMode?: FocusMode;
  subjectTitle: string;
  hasSources: boolean;
}) {
  const custom = input.description?.normalize("NFKC").trim().replace(/\s+/g, " ") ?? "";
  if (custom) return { value: custom, mode: "CUSTOM" as const, automatic: false };

  const mode = input.focusMode === "CONCEPTS" || input.focusMode === "APPLICATIONS"
    ? input.focusMode
    : "BALANCED";
  const subject = input.subjectTitle.trim();
  const sourceSuffix = input.hasSources ? " across the selected reviewers" : "";

  if (mode === "CONCEPTS") {
    return {
      value: `Concepts and definitions in ${subject}, emphasizing principles, rules, relationships, and important distinctions${sourceSuffix}.`,
      mode,
      automatic: true,
    };
  }
  if (mode === "APPLICATIONS") {
    return {
      value: `Practical applications in ${subject}, emphasizing representative problems, scenarios, analysis, and applied reasoning${sourceSuffix}.`,
      mode,
      automatic: true,
    };
  }
  return {
    value: input.hasSources
      ? `Balanced review of ${subject}, covering key concepts, definitions, rules, relationships, distinctions, and practical applications across the selected reviewers.`
      : `Comprehensive review of ${subject}, covering foundational concepts, important distinctions, practical applications, and commonly tested principles.`,
    mode: "BALANCED" as const,
    automatic: true,
  };
}

export function cleanMaterialTopic(name: string) {
  const cleaned = name
    .normalize("NFKC")
    .replace(/\.(pdf|docx?|txt)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "Selected reviewer").slice(0, 160);
}

export function resolveExamTitle(input: { title?: string; subjectTitle: string; focusMode?: FocusMode }) {
  const custom = input.title?.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (custom) return custom.slice(0, 120);
  const subject = input.subjectTitle.trim();
  if (input.focusMode === "CONCEPTS") return `${subject} Concepts`.slice(0, 120);
  if (input.focusMode === "APPLICATIONS") return `${subject} Applications`.slice(0, 120);
  return `${subject} Review`.slice(0, 120);
}
