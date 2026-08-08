import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({ env: () => ({}) }));

import { combineRetrievedChunks, fuseRankedChunks, selectDiverseChunks, type RetrievedChunk } from "@/features/exams/retrieval";

const chunk = (id: number, fileId: number, text = `Chunk ${id}`): RetrievedChunk => ({ id, fileId, ordinal: id, fileName: `File ${fileId}.pdf`, text, locator: `Page ${id}`, pageStart: id, pageEnd: id, sectionTitle: null, computationScore: 0 });

describe("retrieval context", () => {
  it("keeps required-file chunks before global results and deduplicates", () => {
    const result = combineRetrievedChunks(
      [chunk(1, 10), chunk(2, 20)],
      [chunk(1, 10), chunk(3, 10), chunk(4, 30)],
      3,
    );
    expect(result.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(new Set(result.map((item) => item.fileId))).toEqual(new Set([10, 20]));
  });

  it("uses reciprocal-rank fusion and preserves exact-term candidates", () => {
    const result = fuseRankedChunks([chunk(1, 1), chunk(2, 1)], [chunk(2, 1), chunk(3, 2)]);
    expect(result[0].id).toBe(2);
    expect(result.map((item) => item.id)).toContain(3);
  });

  it("covers required files and removes duplicate context", () => {
    const candidates = fuseRankedChunks(
      [chunk(1, 1, "same evidence"), chunk(2, 1, "same evidence"), chunk(3, 2)],
      [chunk(4, 3)],
    );
    const result = selectDiverseChunks(candidates, [1, 2, 3], 12);
    expect(new Set(result.map((item) => item.fileId))).toEqual(new Set([1, 2, 3]));
    expect(result.filter((item) => item.text === "same evidence")).toHaveLength(1);
  });
});
