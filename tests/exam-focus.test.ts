import { describe, expect, it } from "vitest";
import { cleanMaterialTopic, resolveExamFocus, resolveExamTitle } from "@/features/exams/focus";

describe("exam focus resolution", () => {
  it("gives normalized custom text precedence over a preset", () => {
    expect(resolveExamFocus({
      description: "  VAT   exemptions and zero-rated sales  ",
      focusMode: "APPLICATIONS",
      subjectTitle: "Income Taxation",
      hasSources: true,
    })).toEqual({ value: "VAT exemptions and zero-rated sales", mode: "CUSTOM", automatic: false });
  });

  it("builds a stable source-grounded balanced fallback", () => {
    const result = resolveExamFocus({ subjectTitle: "Financial Management", hasSources: true });
    expect(result.mode).toBe("BALANCED");
    expect(result.automatic).toBe(true);
    expect(result.value).toContain("selected reviewers");
  });

  it("builds distinct concepts, applications, and model-knowledge fallbacks", () => {
    expect(resolveExamFocus({ focusMode: "CONCEPTS", subjectTitle: "Auditing", hasSources: true }).value).toContain("Concepts and definitions");
    expect(resolveExamFocus({ focusMode: "APPLICATIONS", subjectTitle: "Auditing", hasSources: true }).value).toContain("Practical applications");
    expect(resolveExamFocus({ subjectTitle: "Auditing", hasSources: false }).value).toContain("Comprehensive review");
  });

  it("cleans reviewer filenames for blueprint topics", () => {
    expect(cleanMaterialTopic("Chapter_04--Audit-Evidence.pdf")).toBe("Chapter 04 Audit Evidence");
  });

  it("creates concise default titles independently from the exam focus", () => {
    expect(resolveExamTitle({ subjectTitle: "Auditing", focusMode: "BALANCED" })).toBe("Auditing Review");
    expect(resolveExamTitle({ subjectTitle: "Auditing", focusMode: "CONCEPTS" })).toBe("Auditing Concepts");
    expect(resolveExamTitle({ subjectTitle: "Auditing", focusMode: "APPLICATIONS" })).toBe("Auditing Applications");
  });

  it("normalizes and limits a custom title", () => {
    expect(resolveExamTitle({ title: "  Midterm   Review  ", subjectTitle: "Auditing" })).toBe("Midterm Review");
    expect(resolveExamTitle({ title: "x".repeat(150), subjectTitle: "Auditing" })).toHaveLength(120);
  });
});
