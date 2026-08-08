import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { embedTexts } from "@/lib/openai";
import type { Blueprint } from "./generation-schemas";

export interface RetrievedChunk {
  id: number;
  fileId: number;
  ordinal: number;
  fileName: string;
  text: string;
  locator: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  sectionTitle: string | null;
  computationScore: number;
}

export interface RankedChunk extends RetrievedChunk {
  score: number;
}

export interface RetrievalMetrics {
  vectorCandidates: number;
  keywordCandidates: number;
  fusedCandidates: number;
  selectedChunks: number;
  duplicatesRemoved: number;
  requiredFileCoverage: number;
  fallbackUsed: boolean;
}

type CandidateRow = RetrievedChunk & { distance?: number; keywordRank?: number };

function normalized(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

async function queryVector(query: string) {
  const [embedding] = await embedTexts([query]);
  if (!embedding || embedding.length !== 1536) throw new Error("Unable to create a 1536-dimensional retrieval embedding.");
  return JSON.stringify(embedding);
}

async function vectorCandidates(fileIds: number[], vector: string, limit: number) {
  if (!fileIds.length || limit <= 0) return [];
  return db.$queryRaw<CandidateRow[]>`
    SELECT c.id, c."fileId", c.ordinal, f.name AS "fileName", c.text, c.locator,
           c."pageStart", c."pageEnd", c."sectionTitle", c."computationScore",
           (c.embedding <=> ${vector}::vector(1536))::float8 AS distance
    FROM "DocumentChunk" c
    JOIN "File" f ON f.id = c."fileId"
    WHERE c."fileId" IN (${Prisma.join(fileIds)}) AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${vector}::vector(1536), c.id
    LIMIT ${limit}
  `;
}

async function keywordCandidates(fileIds: number[], query: string, limit: number) {
  if (!fileIds.length || limit <= 0 || !query.trim()) return [];
  return db.$queryRaw<CandidateRow[]>`
    SELECT c.id, c."fileId", c.ordinal, f.name AS "fileName", c.text, c.locator,
           c."pageStart", c."pageEnd", c."sectionTitle", c."computationScore",
           ts_rank_cd(c."searchVector", websearch_to_tsquery('simple', ${query}))::float8 AS "keywordRank"
    FROM "DocumentChunk" c
    JOIN "File" f ON f.id = c."fileId"
    WHERE c."fileId" IN (${Prisma.join(fileIds)})
      AND c."searchVector" @@ websearch_to_tsquery('simple', ${query})
    ORDER BY "keywordRank" DESC, c.id
    LIMIT ${limit}
  `;
}

export function fuseRankedChunks(vector: RetrievedChunk[], keyword: RetrievedChunk[], rankConstant = 60) {
  const values = new Map<number, RankedChunk>();
  const add = (rows: RetrievedChunk[], weight: number) => rows.forEach((row, index) => {
    const prior = values.get(row.id);
    values.set(row.id, { ...(prior ?? row), score: (prior?.score ?? 0) + weight / (rankConstant + index + 1) });
  });
  add(vector, 1);
  add(keyword, .9);
  return [...values.values()].sort((left, right) => right.score - left.score || left.id - right.id);
}

export function selectDiverseChunks(candidates: RankedChunk[], requiredFileIds: number[], limit: number, maxPerFile = 3) {
  const selected: RankedChunk[] = [];
  const selectedIds = new Set<number>();
  const selectedTexts = new Set<string>();
  const perFile = new Map<number, number>();
  const add = (candidate: RankedChunk, enforceCap: boolean) => {
    const text = normalized(candidate.text);
    if (selectedIds.has(candidate.id) || selectedTexts.has(text)) return false;
    if (enforceCap && (perFile.get(candidate.fileId) ?? 0) >= maxPerFile) return false;
    const adjacent = selected.some((item) => item.fileId === candidate.fileId && Math.abs(item.ordinal - candidate.ordinal) === 1);
    if (adjacent && enforceCap) return false;
    selected.push(candidate);
    selectedIds.add(candidate.id);
    selectedTexts.add(text);
    perFile.set(candidate.fileId, (perFile.get(candidate.fileId) ?? 0) + 1);
    return true;
  };
  for (const fileId of [...new Set(requiredFileIds)]) {
    const best = candidates.find((candidate) => candidate.fileId === fileId);
    if (best) add(best, false);
  }
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    add(candidate, true);
  }
  if (selected.length < limit) {
    for (const candidate of candidates) {
      if (selected.length >= limit) break;
      add(candidate, false);
    }
  }
  return selected;
}

async function fallbackChunks(fileIds: number[], limit: number): Promise<RetrievedChunk[]> {
  if (!fileIds.length || limit <= 0) return [];
  const rows = await db.documentChunk.findMany({
    where: { fileId: { in: fileIds } }, orderBy: [{ fileId: "asc" }, { ordinal: "asc" }], take: limit,
    select: { id: true, fileId: true, ordinal: true, text: true, locator: true, pageStart: true, pageEnd: true, sectionTitle: true, computationScore: true, file: { select: { name: true } } },
  });
  return rows.map(({ file, ...row }) => ({ ...row, fileName: file.name }));
}

async function hybridCandidates(fileIds: number[], query: string, candidateLimit = 30) {
  const vector = await queryVector(query);
  const [semantic, keyword] = await Promise.all([
    vectorCandidates(fileIds, vector, candidateLimit), keywordCandidates(fileIds, query, candidateLimit),
  ]);
  return { semantic, keyword, fused: fuseRankedChunks(semantic, keyword) };
}

export function combineRetrievedChunks(required: RetrievedChunk[], global: RetrievedChunk[], limit: number) {
  const fused = fuseRankedChunks(required, global);
  return selectDiverseChunks(fused, required.map((chunk) => chunk.fileId), limit);
}

export async function rankFilesByRelevance(fileIds: number[], query: string) {
  if (!fileIds.length) return [];
  const { fused } = await hybridCandidates(fileIds, query, 40);
  const best = new Map<number, number>();
  for (const chunk of fused) best.set(chunk.fileId, Math.max(best.get(chunk.fileId) ?? 0, chunk.score));
  return [...fileIds].sort((left, right) => (best.get(right) ?? -1) - (best.get(left) ?? -1) || left - right);
}

export async function retrieveChunksForBatch(
  fileIds: number[], description: string, subject: string, slots: Blueprint["slots"], limit = 14,
) {
  if (!fileIds.length) return { chunks: [], metrics: emptyMetrics() };
  const files = await db.file.findMany({ where: { id: { in: fileIds } }, select: { id: true, name: true } });
  const names = new Map(files.map((file) => [file.id, file.name]));
  const computational = slots.some((slot) => slot.style === "COMPUTATIONAL");
  const query = [description, subject, computational ? "calculate compute formula rate worked example numerical solution" : "", ...slots.flatMap((slot) => [slot.topic, slot.objective, slot.sourceFileId ? names.get(slot.sourceFileId) ?? "" : ""])].filter(Boolean).join("\n");
  const required = [...new Set(slots.map((slot) => slot.sourceFileId).filter((id): id is number => id !== null))];
  const { semantic, keyword, fused: rawFused } = await hybridCandidates(fileIds, query, 30);
  const fused = computational
    ? rawFused.map((chunk) => ({ ...chunk, score: chunk.score + chunk.computationScore * .004 })).sort((a, b) => b.score - a.score || a.id - b.id)
    : rawFused;
  const perFileLimit = fileIds.length === 1 ? limit : 3;
  let selected = selectDiverseChunks(fused, required, limit, perFileLimit);
  let fallbackUsed = false;
  if (selected.length < Math.min(limit, required.length || 1)) {
    fallbackUsed = true;
    const fallback = await fallbackChunks(fileIds, limit);
    selected = selectDiverseChunks(fuseRankedChunks(selected, fallback), required, limit, perFileLimit);
  }
  const coverage = new Set(selected.filter((chunk) => required.includes(chunk.fileId)).map((chunk) => chunk.fileId)).size;
  return { chunks: selected, metrics: {
    vectorCandidates: semantic.length, keywordCandidates: keyword.length, fusedCandidates: fused.length,
    selectedChunks: selected.length, duplicatesRemoved: Math.max(0, fused.length - selected.length),
    requiredFileCoverage: coverage, fallbackUsed,
  } satisfies RetrievalMetrics };
}

export async function retrieveChunks(fileIds: number[], query: string, limit = 18) {
  if (!fileIds.length) return [];
  const { fused } = await hybridCandidates(fileIds, query, 30);
  const selected = selectDiverseChunks(fused, [], limit);
  return selected.length ? selected : fallbackChunks(fileIds, limit);
}

function emptyMetrics(): RetrievalMetrics {
  return { vectorCandidates: 0, keywordCandidates: 0, fusedCandidates: 0, selectedChunks: 0, duplicatesRemoved: 0, requiredFileCoverage: 0, fallbackUsed: false };
}
