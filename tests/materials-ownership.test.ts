import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { file: { findMany } } }));
vi.mock("@/lib/env", () => ({ env: () => ({}) }));

import { assertReadyFiles } from "@/features/materials/service";

describe("source ownership validation", () => {
  beforeEach(() => findMany.mockReset());

  it("requires ready files to belong to the selected subject", async () => {
    findMany.mockResolvedValue([{ id: 1 }]);
    await expect(assertReadyFiles([1, 2], "user-1", 7)).rejects.toMatchObject({ status: 400, code: "SOURCES_UNAVAILABLE" });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: "user-1", subjectId: 7, ingestionStatus: "READY" }),
    }));
  });

  it("deduplicates IDs before validating", async () => {
    findMany.mockResolvedValue([{ id: 1 }]);
    await expect(assertReadyFiles([1, 1], "user-1", 7)).resolves.toEqual([1]);
  });
});
