import "server-only";
import { cache } from "react";
import { requirePageUser } from "@/features/auth/page-session";
import { listExams } from "@/features/exams/service";

export const examsPageData = cache(async () => {
  const user = await requirePageUser();
  return listExams(user.id);
});
