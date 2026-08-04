export interface TextChunk {
  ordinal: number;
  text: string;
  tokenEstimate: number;
}

export function chunkText(
  input: string,
  maxChars = 4_000,
  overlapChars = 400,
): TextChunk[] {
  const text = input.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!text) return [];
  const chunks: TextChunk[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const boundary = Math.max(
        text.lastIndexOf("\n", end),
        text.lastIndexOf(". ", end),
      );
      if (boundary > start + maxChars * 0.6) end = boundary + 1;
    }
    const value = text.slice(start, end).trim();
    if (value) {
      chunks.push({
        ordinal: chunks.length,
        text: value,
        tokenEstimate: Math.ceil(value.length / 4),
      });
    }
    if (end >= text.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }
  return chunks;
}
