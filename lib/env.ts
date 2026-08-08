import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  ALLOWED_USER_EMAIL: z.string().email().transform((value) => value.toLowerCase()),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default("gpt-5.6-terra"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  OPENAI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  INNGEST_DEV: z.enum(["0", "1"]).optional(),
});

let parsed: z.infer<typeof schema> | undefined;

export function env() {
  if (!parsed) {
    const result = schema.safeParse(process.env);
    if (!result.success) {
      const missing = Object.keys(result.error.flatten().fieldErrors);
      console.error("Invalid server configuration", { fields: missing });
      throw new Error("Server configuration is incomplete.");
    }
    parsed = result.data;
  }
  return parsed;
}
