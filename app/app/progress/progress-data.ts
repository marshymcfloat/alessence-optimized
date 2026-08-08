import "server-only";
import { cache } from "react";
import { requirePageUser } from "@/features/auth/page-session";
import { getProgressSummary } from "@/features/progress/service";
import type { StudyPeriod } from "@/lib/study-period";

export const progressPageData = cache(async (period: StudyPeriod = "current") => {
  const user = await requirePageUser();
  return getProgressSummary(user.id, period);
});
