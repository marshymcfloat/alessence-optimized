import { z } from "zod";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 10;
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export const existingFileIdsSchema = z.array(z.coerce.number().int().positive()).max(25);
