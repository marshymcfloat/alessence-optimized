CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "IngestionStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');
CREATE TYPE "GenerationStatus" AS ENUM (
  'QUEUED', 'PLANNING', 'RETRIEVING', 'GENERATING',
  'VALIDATING', 'REPAIRING', 'READY', 'FAILED'
);
CREATE TYPE "GroundingMode" AS ENUM ('SOURCES', 'MODEL_KNOWLEDGE');
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE "GenerationFailureCode" AS ENUM (
  'CONFIGURATION', 'SOURCES_UNAVAILABLE', 'AI_TRANSIENT',
  'AI_INVALID_OUTPUT', 'INSUFFICIENT_VALID_QUESTIONS', 'INTERNAL'
);

ALTER TABLE "File"
  ADD COLUMN "ingestionStatus" "IngestionStatus" NOT NULL DEFAULT 'READY',
  ADD COLUMN "ingestionError" TEXT;

DROP INDEX IF EXISTS "File_name_key";
CREATE UNIQUE INDEX "File_userId_name_key" ON "File"("userId", "name");
CREATE INDEX "File_userId_ingestionStatus_idx"
  ON "File"("userId", "ingestionStatus");

CREATE TABLE "DocumentChunk" (
  "id" SERIAL PRIMARY KEY,
  "fileId" INTEGER NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "locator" TEXT,
  "tokenEstimate" INTEGER NOT NULL,
  "embedding" vector,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentChunk_fileId_fkey"
    FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "DocumentChunk_fileId_ordinal_key"
  ON "DocumentChunk"("fileId", "ordinal");
CREATE INDEX "DocumentChunk_fileId_idx" ON "DocumentChunk"("fileId");

CREATE TABLE "ExamGeneration" (
  "id" TEXT PRIMARY KEY,
  "examId" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "GenerationStatus" NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "groundingMode" "GroundingMode" NOT NULL,
  "blueprint" JSONB,
  "metrics" JSONB,
  "failureCode" "GenerationFailureCode",
  "failureMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExamGeneration_examId_fkey"
    FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "ExamGeneration_examId_version_key"
  ON "ExamGeneration"("examId", "version");
CREATE INDEX "ExamGeneration_status_createdAt_idx"
  ON "ExamGeneration"("status", "createdAt");

ALTER TABLE "Question"
  ADD COLUMN "acceptedAnswers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "explanation" TEXT,
  ADD COLUMN "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "topicLabel" TEXT,
  ADD COLUMN "objective" TEXT,
  ADD COLUMN "sourceCitations" JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN "slot" INTEGER,
  ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "generationId" TEXT;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "examId" ORDER BY "id") AS position
  FROM "Question"
)
UPDATE "Question"
SET "slot" = ranked.position
FROM ranked
WHERE "Question"."id" = ranked."id";

ALTER TABLE "Question" ALTER COLUMN "slot" SET NOT NULL;
ALTER TABLE "Question"
  ADD CONSTRAINT "Question_generationId_fkey"
  FOREIGN KEY ("generationId") REFERENCES "ExamGeneration"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX "Question_generationId_slot_key"
  ON "Question"("generationId", "slot");
CREATE INDEX "Question_examId_published_idx"
  ON "Question"("examId", "published");
