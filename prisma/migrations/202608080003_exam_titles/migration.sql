ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS title TEXT;

UPDATE "Exam" e
SET title = LEFT(s.title || ' Review', 120)
FROM "Subject" s
WHERE e."subjectId" = s.id AND (e.title IS NULL OR BTRIM(e.title) = '');

UPDATE "Exam" SET title = 'Practice Exam' WHERE title IS NULL OR BTRIM(title) = '';

ALTER TABLE "Exam" ALTER COLUMN title SET NOT NULL;
