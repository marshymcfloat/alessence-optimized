import { describe, expect, it } from "vitest";
import { chunkSections, chunkText } from "@/features/materials/chunking";

describe("chunkText", () => {
  it("returns bounded, overlapping chunks", () => {
    const text = Array.from({ length: 200 }, (_, index) => `Sentence ${index}.`).join(" ");
    const chunks = chunkText(text, 300, 40);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.length <= 301)).toBe(true);
    expect(chunks.map((chunk) => chunk.ordinal)).toEqual(
      chunks.map((_, index) => index),
    );
  });

  it("ignores empty material", () => {
    expect(chunkText(" \n ")).toEqual([]);
  });

  it("preserves page and section locators without merging unrelated sections", () => {
    const chunks = chunkSections([
      { text: "VAT exemptions apply to the listed transactions.", pageStart: 14, pageEnd: 14, sectionTitle: "VAT Exemptions" },
      { text: "Estate tax has a separate computation.", pageStart: 20, pageEnd: 20, sectionTitle: "Estate Tax" },
    ], 10, 20, 2);
    expect(chunks[0].locator).toBe("Page 14 · VAT Exemptions");
    expect(chunks[1].locator).toBe("Page 20 · Estate Tax");
    expect(chunks.every((chunk) => !(chunk.text.includes("VAT") && chunk.text.includes("Estate")))).toBe(true);
  });
});
