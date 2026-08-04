import type { Metadata } from "next";
import { requirePageUser } from "@/features/auth/page-session";
import { listMaterials } from "@/features/materials/library-service";
import { listSubjects } from "@/features/subjects/service";
import { ExamWizard } from "./ExamWizard";

export const metadata: Metadata = { title: "Create exam" };

export default async function NewExamPage() {
  const user = await requirePageUser();
  const [materials, subjects] = await Promise.all([
    listMaterials(user.id),
    listSubjects(user.id),
  ]);
  return <ExamWizard materials={materials} subjects={subjects} />;
}
