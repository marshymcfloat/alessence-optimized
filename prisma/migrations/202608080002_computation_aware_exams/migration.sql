ALTER TYPE "QuestionTypeEnum" ADD VALUE IF NOT EXISTS 'NUMERIC';

DO $$ BEGIN
  CREATE TYPE "CalculationMode" AS ENUM ('AUTO', 'ONLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "GenerationFailureCode" ADD VALUE IF NOT EXISTS 'INSUFFICIENT_COMPUTATION_EVIDENCE';

ALTER TABLE "Exam"
  ADD COLUMN IF NOT EXISTS "calculationMode" "CalculationMode" NOT NULL DEFAULT 'AUTO';

ALTER TABLE "Question"
  ADD COLUMN IF NOT EXISTS "isComputational" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "calculationMetadata" JSONB;

ALTER TABLE "DocumentChunk"
  ADD COLUMN IF NOT EXISTS "computationScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "computationScored" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "DocumentChunk_fileId_computationScore_idx"
  ON "DocumentChunk"("fileId", "computationScore");
