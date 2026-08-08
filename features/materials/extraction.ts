import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import type { AcceptedFileType } from "@prisma/client";
import { ApiError } from "@/lib/http";
import type { DocumentSection } from "./chunking";

export interface ExtractedDocument {
  text: string;
  sections: DocumentSection[];
  pageCount: number | null;
}

function decodeHtml(value: string) {
  const entities: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  };
  return value.replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (_match, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return entities[entity.toLowerCase()] ?? `&${entity};`;
  });
}

function plain(value: string) {
  return decodeHtml(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+/g, " ").trim();
}

function looksLikeHeading(value: string) {
  const text = value.trim();
  if (!text || text.length > 120 || /[.!?]$/.test(text)) return false;
  const words = text.split(/\s+/);
  if (words.length > 12) return false;
  return text === text.toUpperCase() || words.filter((word) => /^[A-Z\d]/.test(word)).length >= Math.ceil(words.length * .7);
}

export function sectionsFromPlainText(text: string): DocumentSection[] {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
  const sections: DocumentSection[] = [];
  let title: string | undefined;
  let body: string[] = [];
  const flush = () => {
    if (body.length) sections.push({ text: body.join("\n\n"), sectionTitle: title });
    body = [];
  };
  for (const block of blocks) {
    const firstLine = block.split("\n", 1)[0]!.trim();
    if (block === firstLine && looksLikeHeading(firstLine)) {
      flush();
      title = firstLine;
    } else {
      body.push(block);
    }
  }
  flush();
  if (!sections.length && text.trim()) sections.push({ text: text.trim() });
  return sections;
}

async function extractPdf(buffer: Buffer): Promise<ExtractedDocument> {
  const parser = new PDFParse(new Uint8Array(buffer));
  try {
    const result = await parser.getText();
    const sections = result.pages
      .map((page) => ({ text: page.text.trim(), pageStart: page.num, pageEnd: page.num }))
      .filter((section) => section.text.length > 0);
    const text = sections.map((section) => section.text).join("\n\n").trim();
    if (isLowTextPdf(text, result.total)) {
      throw new ApiError(422, "This PDF appears to be scanned or image-only. OCR is required before it can be indexed.", "OCR_REQUIRED");
    }
    return { text, sections, pageCount: result.total };
  } finally {
    await parser.destroy();
  }
}

export function isLowTextPdf(text: string, pageCount: number) {
  return text.replace(/\s/g, "").length < Math.max(80, pageCount * 20);
}

async function extractDocx(buffer: Buffer): Promise<ExtractedDocument> {
  const result = await mammoth.convertToHtml({ buffer });
  const blocks = [...result.value.matchAll(/<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi)];
  const sections: DocumentSection[] = [];
  let title: string | undefined;
  let body: string[] = [];
  const flush = () => {
    if (body.length) sections.push({ text: body.join("\n\n"), sectionTitle: title });
    body = [];
  };
  for (const match of blocks) {
    const tag = match[1]!.toLowerCase();
    const value = plain(match[2] ?? "");
    if (!value) continue;
    if (tag.startsWith("h")) {
      flush();
      title = value;
    } else {
      body.push(value);
    }
  }
  flush();
  const text = sections.map((section) => section.text).join("\n\n").trim();
  if (!text) throw new ApiError(422, "No readable text could be extracted from this DOCX file.");
  return { text, sections, pageCount: null };
}

export async function extractDocument(buffer: Buffer, type: AcceptedFileType): Promise<ExtractedDocument> {
  if (type === "PDF") return extractPdf(buffer);
  if (type === "DOCX") return extractDocx(buffer);
  const text = buffer.toString("utf8").trim();
  if (!text) throw new ApiError(422, "No readable text could be extracted from this text file.");
  return { text, sections: sectionsFromPlainText(text), pageCount: null };
}
