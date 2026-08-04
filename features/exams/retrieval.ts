import "server-only";
import { GoogleGenAI } from "@google/genai";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Blueprint } from "./generation-schemas";

export interface RetrievedChunk {
  id: number;
  fileId: number;
  text: string;
  locator: string | null;
}

export function combineRetrievedChunks(
  required: RetrievedChunk[],
  global: RetrievedChunk[],
  limit: number,
) {
  const combined: RetrievedChunk[] = [];
  const seen = new Set<number>();
  for (const chunk of [...required, ...global]) {
    if (!seen.has(chunk.id) && combined.length < limit) {
      combined.push(chunk);
      seen.add(chunk.id);
    }
  }
  return combined;
}

async function queryVector(query: string) {
  const ai = new GoogleGenAI({ apiKey: env().GEMINI_API_KEY });
  const result = await ai.models.embedContent({
    model: env().GEMINI_EMBEDDING_MODEL,
    contents: query,
  });
  const embedding = result.embeddings?.[0]?.values;
  if (!embedding) throw new Error("Unable to create retrieval embedding.");
  return JSON.stringify(embedding);
}

async function nearest(fileIds: number[], vector: string, limit: number) {
  if (!fileIds.length || limit <= 0) return [];
  return db.$queryRaw<RetrievedChunk[]>`
    SELECT id, "fileId", text, locator
    FROM "DocumentChunk"
    WHERE "fileId" IN (${Prisma.join(fileIds)}) AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vector}::vector
    LIMIT ${limit}
  `;
}

export async function rankFilesByRelevance(fileIds: number[], query: string) {
  if (!fileIds.length) return [];
  const vector = await queryVector(query);
  const rows = await db.$queryRaw<Array<{ fileId: number; distance: number }>>`
    SELECT "fileId", MIN(embedding <=> ${vector}::vector) AS distance
    FROM "DocumentChunk"
    WHERE "fileId" IN (${Prisma.join(fileIds)}) AND embedding IS NOT NULL
    GROUP BY "fileId"
    ORDER BY distance ASC, "fileId" ASC
  `;
  const ranked = rows.map((row) => row.fileId);
  return [...ranked, ...fileIds.filter((id) => !ranked.includes(id))];
}

export async function retrieveChunksForBatch(
  fileIds: number[],
  description: string,
  subject: string,
  slots: Blueprint["slots"],
  limit = 12,
) {
  if (!fileIds.length) return [];
  const query = [description, subject, ...new Set(slots.map((slot) => slot.topic))].join("\n");
  const vector = await queryVector(query);
  const required = [...new Set(slots.map((slot) => slot.sourceFileId).filter((id): id is number => id !== null))];
  const collected: RetrievedChunk[] = [];
  for (const fileId of required) {
    collected.push(...await nearest([fileId], vector, 1));
  }
  const global = await nearest(fileIds, vector, limit);
  return combineRetrievedChunks(collected, global, limit);
}

export async function retrieveChunks(fileIds: number[], query: string, limit = 18) {
  if (!fileIds.length) return [];
  return nearest(fileIds, await queryVector(query), limit);
}
