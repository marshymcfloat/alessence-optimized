import "server-only";
import { del, put } from "@vercel/blob";
import { AcceptedFileType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";
import { embedTexts } from "@/lib/openai";
import { inngest } from "@/inngest/client";
import { ACCEPTED_MIME_TYPES, MAX_FILE_BYTES, MAX_FILES_PER_REQUEST } from "./schemas";
import { chunkSections, CURRENT_INDEX_VERSION } from "./chunking";
import { extractDocument } from "./extraction";
import { scoreComputationalEvidence } from "@/features/exams/computation";

function safeName(name: string) {
  const cleaned = name.normalize("NFKC").replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .replace(/\s+/g, " ").slice(0, 180).trim();
  return cleaned || "material.txt";
}

function fileType(type: string) {
  if (type === "application/pdf") return AcceptedFileType.PDF;
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return AcceptedFileType.DOCX;
  return AcceptedFileType.TEXT;
}

function safeIngestionMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  if (/OCR_REQUIRED|scanned|image-only/i.test(message)) {
    return "This PDF appears to be scanned or image-only. OCR is required before it can be indexed.";
  }
  if (/fetch|blob|download/i.test(message)) return "The uploaded file could not be downloaded for processing.";
  if (/embedding|OpenAI|429|timeout|overloaded/i.test(message)) return "Indexing was temporarily unavailable. The file will be retried.";
  return "The material could not be processed. Check that the file contains readable text.";
}

export async function ingestFiles(files: File[], userId: string, subjectId: number) {
  if (!files.length) throw new ApiError(400, "Choose at least one file.");
  if (files.length > MAX_FILES_PER_REQUEST) throw new ApiError(400, `Upload at most ${MAX_FILES_PER_REQUEST} files.`);
  const subject = await db.subject.findFirst({ where: { id: subjectId, userId } });
  if (!subject) throw new ApiError(404, "Subject not found.", "SUBJECT_NOT_FOUND");

  const created = [];
  for (const file of files) {
    if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
      throw new ApiError(415, `Unsupported file type for ${file.name}.`);
    }
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      throw new ApiError(400, `${file.name} must be between 1 byte and 10 MB.`);
    }
    const name = safeName(file.name);
    const blob = await put(`${userId}/${crypto.randomUUID()}-${name}`, file, {
      access: "public", token: env().BLOB_READ_WRITE_TOKEN, addRandomSuffix: false,
    });
    try {
      const stored = await db.file.create({
        data: {
          name, fileUrl: blob.url, size: file.size, type: fileType(file.type),
          ingestionStatus: "PROCESSING", ingestionError: null, indexVersion: 0,
          subjectId, userId,
        },
        select: { id: true, name: true, size: true, type: true, ingestionStatus: true },
      });
      try {
        await inngest.send({
          id: `material-ingest-${stored.id}-v${CURRENT_INDEX_VERSION}`,
          name: "material/ingestion.requested",
          data: { fileId: stored.id },
        });
      } catch (error) {
        await db.file.update({ where: { id: stored.id }, data: {
          ingestionStatus: "FAILED", ingestionError: "The indexing job could not be queued.",
        } });
        throw error;
      }
      created.push(stored);
    } catch (error) {
      const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (duplicate) await del(blob.url, { token: env().BLOB_READ_WRITE_TOKEN }).catch(() => undefined);
      if (duplicate) throw new ApiError(409, `A material named ${name} already exists.`);
      throw error;
    }
  }
  return created;
}

export async function processMaterial(fileId: number, reindex = false) {
  const startedAt = Date.now();
  const file = await db.file.findUnique({
    where: { id: fileId },
    select: { id: true, fileUrl: true, type: true, ingestionStatus: true, indexVersion: true },
  });
  if (!file) return { deleted: true };
  if (file.indexVersion >= CURRENT_INDEX_VERSION && file.ingestionStatus === "READY") return { alreadyIndexed: true };

  const response = await fetch(file.fileUrl);
  if (!response.ok) throw new Error(`Blob download failed with ${response.status}.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const extracted = await extractDocument(buffer, file.type);
  const chunks = chunkSections(extracted.sections);
  if (!chunks.length) throw new ApiError(422, "No useful text chunks could be created from this material.");
  const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));
  if (embeddings.length !== chunks.length || embeddings.some((embedding) => embedding.length !== 1536)) {
    throw new Error("Embedding service returned invalid dimensions.");
  }

  await db.$transaction(async (tx) => {
    await tx.documentChunk.deleteMany({ where: { fileId } });
    for (const [index, chunk] of chunks.entries()) {
      const row = await tx.documentChunk.create({
        data: {
          fileId, ordinal: chunk.ordinal, text: chunk.text, locator: chunk.locator,
          pageStart: chunk.pageStart, pageEnd: chunk.pageEnd, sectionTitle: chunk.sectionTitle,
          indexVersion: CURRENT_INDEX_VERSION, tokenEstimate: chunk.tokenEstimate,
          computationScore: scoreComputationalEvidence(chunk.text),
          computationScored: true,
        },
        select: { id: true },
      });
      const vector = JSON.stringify(embeddings[index]);
      await tx.$executeRaw`UPDATE "DocumentChunk" SET embedding = ${vector}::vector(1536) WHERE id = ${row.id}`;
    }
    await tx.file.update({ where: { id: fileId }, data: {
      contentText: extracted.text,
      ingestionStatus: "READY",
      ingestionError: null,
      indexVersion: CURRENT_INDEX_VERSION,
      indexedAt: new Date(),
    } });
  });
  return { fileId, reindex, chunks: chunks.length, pageCount: extracted.pageCount, durationMs: Date.now() - startedAt };
}

export async function backfillComputationScores(limit = 100) {
  const chunks = await db.documentChunk.findMany({
    where: { computationScored: false }, orderBy: { id: "asc" }, take: limit,
    select: { id: true, text: true },
  });
  if (!chunks.length) return 0;
  await db.$transaction(chunks.map((chunk) => db.documentChunk.update({
    where: { id: chunk.id }, data: { computationScore: scoreComputationalEvidence(chunk.text), computationScored: true },
  })));
  return chunks.length;
}

export async function failMaterialIngestion(fileId: number, error: unknown, reindex = false) {
  const exists = await db.file.findUnique({ where: { id: fileId }, select: { id: true, ingestionStatus: true } });
  if (!exists) return;
  await db.file.update({ where: { id: fileId }, data: reindex && exists.ingestionStatus === "READY"
    ? { ingestionError: `Reindex failed: ${safeIngestionMessage(error)}` }
    : { ingestionStatus: "FAILED", ingestionError: safeIngestionMessage(error) }
  });
}

export async function filesNeedingBackfill(limit = 10) {
  return db.file.findMany({
    where: { ingestionStatus: "READY", indexVersion: { lt: CURRENT_INDEX_VERSION } },
    orderBy: { updatedAt: "asc" }, take: limit, select: { id: true },
  });
}

export async function assertReadyFiles(fileIds: number[], userId: string, subjectId?: number) {
  const unique = [...new Set(fileIds)];
  const files = await db.file.findMany({
    where: { id: { in: unique }, userId, ingestionStatus: "READY", ...(subjectId ? { subjectId } : {}) },
    select: { id: true },
  });
  if (files.length !== unique.length) {
    throw new ApiError(400, "One or more selected materials are missing, unauthorized, assigned to another subject, or still processing.", "SOURCES_UNAVAILABLE");
  }
  return unique;
}
