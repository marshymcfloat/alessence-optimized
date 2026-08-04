import "server-only";
import { cache } from "react";
import { requirePageUser } from "@/features/auth/page-session";
import { listExams } from "@/features/exams/service";
import { listMaterials } from "@/features/materials/library-service";
import { getProgressSummary } from "@/features/progress/service";

export const dashboardExams = cache(async () => {
  const user = await requirePageUser();
  return listExams(user.id);
});

export const dashboardMaterials = cache(async () => {
  const user = await requirePageUser();
  return listMaterials(user.id);
});

export const dashboardProgress = cache(async () => {
  const user = await requirePageUser();
  return getProgressSummary(user.id);
});
