import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({ env: () => ({}) }));

import { combineRetrievedChunks, type RetrievedChunk } from "@/features/exams/retrieval";

const chunk = (id: number, fileId: number): RetrievedChunk => ({ id, fileId, text: `Chunk ${id}`, locator: null });

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
});
