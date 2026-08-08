import "server-only";
import { cache } from "react";
import { requirePageUser } from "@/features/auth/page-session";
import { listExams } from "@/features/exams/service";
import type { StudyPeriod } from "@/lib/study-period";

export const examsPageData = cache(async (period: StudyPeriod = "current") => {
  const user = await requirePageUser();
  return listExams(user.id, undefined, period);
});
