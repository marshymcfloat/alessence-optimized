import "server-only";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { del, put } from "@vercel/blob";
import { GoogleGenAI } from "@google/genai";
import { AcceptedFileType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";
import {
  ACCEPTED_MIME_TYPES,
  MAX_FILE_BYTES,
  MAX_FILES_PER_REQUEST,
} from "./schemas";
import { chunkText } from "./chunking";

function safeName(name: string) {
  const cleaned = name
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .replace(/\s+/g, " ")
    .slice(0, 180)
    .trim();
  return cleaned || "material.txt";
}

function fileType(type: string) {
  if (type === "application/pdf") return AcceptedFileType.PDF;
  if (
    type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return AcceptedFileType.DOCX;
  }
  return AcceptedFileType.TEXT;
}

async function extract(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (file.type === "application/pdf") {
    const parser = new PDFParse(new Uint8Array(buffer));
    try {
      return (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  }
  if (
    file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return (await mammoth.extractRawText({ buffer })).value;
  }
  return buffer.toString("utf8");
}

async function embedChunks(chunks: ReturnType<typeof chunkText>) {
  const ai = new GoogleGenAI({ apiKey: env().GEMINI_API_KEY });
  const values: number[][] = [];
  for (const chunk of chunks) {
    const response = await ai.models.embedContent({
      model: env().GEMINI_EMBEDDING_MODEL,
      contents: chunk.text,
    });
    const embedding = response.embeddings?.[0]?.values;
    if (!embedding) throw new Error("Embedding service returned no vector.");
    values.push(embedding);
  }
  return values;
}

export async function ingestFiles(files: File[], userId: string, subjectId: number) {
  if (files.length > MAX_FILES_PER_REQUEST) {
    throw new ApiError(400, `Upload at most ${MAX_FILES_PER_REQUEST} files.`);
  }
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

    const text = (await extract(file)).trim();
    if (!text) throw new ApiError(422, `No text could be extracted from ${file.name}.`);
    const chunks = chunkText(text);
    const embeddings = await embedChunks(chunks);
    const name = safeName(file.name);
    const blob = await put(`${userId}/${crypto.randomUUID()}-${name}`, file, {
      access: "public",
      token: env().BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    });

    try {
      const record = await db.$transaction(async (tx) => {
        const stored = await tx.file.create({
          data: {
            name,
            fileUrl: blob.url,
            size: file.size,
            type: fileType(file.type),
            contentText: text,
            ingestionStatus: "PROCESSING",
            subjectId,
            userId,
          },
        });
        for (const [index, chunk] of chunks.entries()) {
          const row = await tx.documentChunk.create({
            data: {
              fileId: stored.id,
              ordinal: chunk.ordinal,
              text: chunk.text,
              tokenEstimate: chunk.tokenEstimate,
            },
          });
          const vector = JSON.stringify(embeddings[index]);
          await tx.$executeRaw`
            UPDATE "DocumentChunk"
            SET embedding = ${vector}::vector
            WHERE id = ${row.id}
          `;
        }
        return tx.file.update({
          where: { id: stored.id },
          data: { ingestionStatus: "READY" },
          select: { id: true, name: true, size: true, type: true },
        });
      });
      created.push(record);
    } catch (error) {
      await del(blob.url, { token: env().BLOB_READ_WRITE_TOKEN }).catch(() => undefined);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiError(409, `A material named ${name} already exists.`);
      }
      throw error;
    }
  }
  return created;
}

export async function assertReadyFiles(
  fileIds: number[],
  userId: string,
  subjectId?: number,
) {
  const unique = [...new Set(fileIds)];
  const files = await db.file.findMany({
    where: {
      id: { in: unique },
      userId,
      ingestionStatus: "READY",
      ...(subjectId ? { subjectId } : {}),
    },
    select: { id: true },
  });
  if (files.length !== unique.length) {
    throw new ApiError(
      400,
      "One or more selected materials are missing, unauthorized, assigned to another subject, or not ready.",
      "SOURCES_UNAVAILABLE",
    );
  }
  return unique;
}
