export const CURRENT_INDEX_VERSION = 2;

export interface DocumentSection {
  text: string;
  pageStart?: number;
  pageEnd?: number;
  sectionTitle?: string;
}

export interface TextChunk {
  ordinal: number;
  text: string;
  tokenEstimate: number;
  pageStart: number | null;
  pageEnd: number | null;
  sectionTitle: string | null;
  locator: string | null;
  indexVersion: number;
}

function normalizedParagraphs(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n|(?<=\.)\s*\n/)
    .map((value) => value.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

function splitOversized(value: string, maxChars: number) {
  if (value.length <= maxChars) return [value];
  const sentences = value.split(/(?<=[.!?])\s+/).filter(Boolean);
  const pieces: string[] = [];
  let current = "";
  for (const sentence of sentences.length > 1 ? sentences : value.match(new RegExp(`.{1,${maxChars}}`, "gs")) ?? []) {
    if (current && current.length + sentence.length + 1 > maxChars) {
      pieces.push(current.trim());
      current = "";
    }
    current = `${current}${current ? " " : ""}${sentence}`;
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces;
}

function locator(section: DocumentSection) {
  const pages = section.pageStart
    ? section.pageEnd && section.pageEnd !== section.pageStart
      ? `Pages ${section.pageStart}–${section.pageEnd}`
      : `Page ${section.pageStart}`
    : null;
  return [pages, section.sectionTitle?.trim()].filter(Boolean).join(" · ") || null;
}

export function chunkSections(
  sections: DocumentSection[],
  targetTokens = 750,
  maxTokens = 900,
  overlapTokens = 100,
): TextChunk[] {
  const targetChars = targetTokens * 4;
  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;
  const chunks: TextChunk[] = [];

  for (const section of sections) {
    const paragraphs = normalizedParagraphs(section.text)
      .flatMap((paragraph) => splitOversized(paragraph, maxChars));
    let current: string[] = [];
    let currentLength = 0;
    let dirty = false;

    const flush = () => {
      if (!dirty) return;
      const text = current.join("\n\n").trim();
      if (!text) return;
      chunks.push({
        ordinal: chunks.length,
        text,
        tokenEstimate: Math.ceil(text.length / 4),
        pageStart: section.pageStart ?? null,
        pageEnd: section.pageEnd ?? section.pageStart ?? null,
        sectionTitle: section.sectionTitle?.trim() || null,
        locator: locator(section),
        indexVersion: CURRENT_INDEX_VERSION,
      });
      const overlap: string[] = [];
      let overlapLength = 0;
      for (let index = current.length - 1; index >= 0; index--) {
        const paragraph = current[index]!;
        if (overlap.length && overlapLength + paragraph.length > overlapChars) break;
        overlap.unshift(paragraph);
        overlapLength += paragraph.length;
      }
      current = overlap;
      currentLength = overlapLength;
      dirty = false;
    };

    for (const paragraph of paragraphs) {
      let added = paragraph.length + (current.length ? 2 : 0);
      if (current.length && currentLength + added > maxChars) flush();
      added = paragraph.length + (current.length ? 2 : 0);
      if (current.length && currentLength + added > maxChars) {
        current = [];
        currentLength = 0;
        added = paragraph.length;
      }
      current.push(paragraph);
      currentLength += added;
      dirty = true;
      if (currentLength >= targetChars) flush();
    }
    flush();
  }

  return chunks.filter((chunk, index, values) => index === 0 || chunk.text !== values[index - 1]?.text)
    .map((chunk, ordinal) => ({ ...chunk, ordinal }));
}

export function chunkText(input: string, maxChars = 4_000, overlapChars = 400): TextChunk[] {
  return chunkSections(
    [{ text: input }],
    Math.max(1, Math.floor((maxChars - overlapChars) / 4)),
    Math.max(1, Math.floor(maxChars / 4)),
    Math.max(0, Math.floor(overlapChars / 4)),
  );
}
