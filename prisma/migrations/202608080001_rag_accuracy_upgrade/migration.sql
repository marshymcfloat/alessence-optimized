CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "File"
  ADD COLUMN IF NOT EXISTS "indexVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "indexedAt" TIMESTAMP(3);

ALTER TABLE "DocumentChunk"
  ADD COLUMN IF NOT EXISTS "pageStart" INTEGER,
  ADD COLUMN IF NOT EXISTS "pageEnd" INTEGER,
  ADD COLUMN IF NOT EXISTS "sectionTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "indexVersion" INTEGER NOT NULL DEFAULT 2;

ALTER TABLE "DocumentChunk"
  ALTER COLUMN embedding TYPE vector(1536)
  USING embedding::vector(1536);

ALTER TABLE "DocumentChunk"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce("sectionTitle", '') || ' ' || text)
  ) STORED;

CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_hnsw_idx"
  ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS "DocumentChunk_searchVector_gin_idx"
  ON "DocumentChunk" USING gin ("searchVector");

CREATE INDEX IF NOT EXISTS "File_indexVersion_ingestionStatus_idx"
  ON "File"("indexVersion", "ingestionStatus");
