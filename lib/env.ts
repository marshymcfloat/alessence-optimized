import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  ALLOWED_USER_EMAIL: z.string().email().transform((value) => value.toLowerCase()),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-2"),
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
