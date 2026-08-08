ALTER TABLE "Exam" ADD COLUMN "academicYear" TEXT NOT NULL DEFAULT 'THIRD_YEAR';

UPDATE "Exam" SET "academicYear" = 'SECOND_YEAR';

CREATE INDEX "Exam_userId_academicYear_idx" ON "Exam"("userId", "academicYear");
