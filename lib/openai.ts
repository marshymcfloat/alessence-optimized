import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/env";

let client: OpenAI | undefined;

export function openai() {
  client ??= new OpenAI({ apiKey: env().OPENAI_API_KEY, timeout: 60_000, maxRetries: 0 });
  return client;
}

export async function embedTexts(inputs: string[]) {
  if (!inputs.length) return [];
  const embeddings: number[][] = [];
  const batchSize = 64;
  for (let index = 0; index < inputs.length; index += batchSize) {
    const response = await openai().embeddings.create({
      model: env().OPENAI_EMBEDDING_MODEL,
      dimensions: env().OPENAI_EMBEDDING_DIMENSIONS,
      input: inputs.slice(index, index + batchSize),
      encoding_format: "float",
    });
    const ordered = [...response.data].sort((left, right) => left.index - right.index);
    if (ordered.length !== Math.min(batchSize, inputs.length - index)) {
      throw new Error("Embedding service returned an incomplete batch.");
    }
    embeddings.push(...ordered.map((item) => item.embedding));
  }
  return embeddings;
}
