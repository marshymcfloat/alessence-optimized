import { describe, expect, it } from "vitest";
import { chunkText } from "@/features/materials/chunking";

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
});
