import "server-only";
import { cache } from "react";
import { requirePageUser } from "@/features/auth/page-session";
import { getProgressSummary } from "@/features/progress/service";

export const progressPageData = cache(async () => {
  const user = await requirePageUser();
  return getProgressSummary(user.id);
});
