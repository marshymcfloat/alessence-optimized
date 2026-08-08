import "server-only";
import { cache } from "react";
import { requirePageUser } from "@/features/auth/page-session";
import { getExam } from "@/features/exams/service";
import { db } from "@/lib/db";

export const examDetailData = cache(async (params: Promise<{ id: string }>) => {
  const [user, { id }] = await Promise.all([requirePageUser(), params]);
  const examId = Number(id);
  const [exam, generation] = await Promise.all([
    getExam(examId, user.id),
    db.examGeneration.findFirst({
      where: { examId, exam: { userId: user.id } },
      orderBy: { version: "desc" },
      select: { status: true, progress: true, failureCode: true, failureMessage: true, groundingMode: true },
    }),
  ]);
  return { exam, generation };
});
