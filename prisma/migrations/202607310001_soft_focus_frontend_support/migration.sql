ALTER TABLE "Subject" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Subject_userId_title_key" ON "Subject"("userId", "title");
