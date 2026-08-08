import "server-only";
import { cache } from "react";
import { requirePageUser } from "@/features/auth/page-session";
import { listMaterials } from "@/features/materials/library-service";
import { listSubjects } from "@/features/subjects/service";
import type { StudyPeriod } from "@/lib/study-period";

export const materialsPageMaterials = cache(async (period: StudyPeriod = "current") => {
  const user = await requirePageUser();
  return listMaterials(user.id, undefined, period);
});

export const materialsPageSubjects = cache(async () => {
  const user = await requirePageUser();
  return listSubjects(user.id);
});
