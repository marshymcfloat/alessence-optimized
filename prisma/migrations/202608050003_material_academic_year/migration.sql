ALTER TABLE "File" ADD COLUMN "academicYear" TEXT NOT NULL DEFAULT 'THIRD_YEAR';

UPDATE "File" SET "academicYear" = 'SECOND_YEAR';

DROP INDEX "File_userId_name_key";
CREATE UNIQUE INDEX "File_userId_name_academicYear_key" ON "File"("userId", "name", "academicYear");
CREATE INDEX "File_userId_academicYear_idx" ON "File"("userId", "academicYear");
