import { materialsPageMaterials, materialsPageSubjects } from "./materials-data";
import { LibraryIsland, SubjectIsland, UploadIsland } from "./MaterialsIslands";
import { MaterialsReveal } from "./MaterialsMotion";
import styles from "./materials.module.css";
import type { StudyPeriod } from "@/lib/study-period";

export async function MaterialsHeaderStats({ period }: { period: StudyPeriod }) {
  const [materials, subjects] = await Promise.all([materialsPageMaterials(period), materialsPageSubjects()]);
  return <MaterialsReveal className={styles.headerStats}><div><strong>{materials.length}</strong><span>Materials</span></div><div><strong>{subjects.length}</strong><span>Subjects</span></div><div><strong>{materials.filter((item) => item.ingestionStatus === "READY").length}</strong><span>Ready</span></div></MaterialsReveal>;
}

export async function UploadControls() { const subjects = await materialsPageSubjects(); return <MaterialsReveal><UploadIsland key={subjects.map((item) => `${item.id}:${item.title}`).join("|")} subjects={subjects} /></MaterialsReveal>; }
export async function SubjectManager() { const subjects = await materialsPageSubjects(); return <MaterialsReveal><SubjectIsland key={subjects.map((item) => `${item.id}:${item.title}:${item.materialCount}:${item.examCount}`).join("|")} subjects={subjects} /></MaterialsReveal>; }
export async function MaterialLibrary({ period }: { period: StudyPeriod }) {
  const [materials, subjects] = await Promise.all([materialsPageMaterials(period), materialsPageSubjects()]);
  const revision = `${materials.map((item) => `${item.id}:${item.name}:${item.ingestionStatus}:${item.ingestionError ?? ""}:${item.subject?.title}`).join("|")}::${subjects.map((item) => `${item.id}:${item.title}`).join("|")}`;
  return <MaterialsReveal><LibraryIsland key={revision} materials={materials} subjects={subjects} /></MaterialsReveal>;
}
