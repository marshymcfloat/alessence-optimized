import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardText, NotePencil } from "@phosphor-icons/react/dist/ssr";
import { ExamHeaderStats, ExamLibraryBody } from "./ExamsDynamic";
import { ExamLibrarySkeleton, ExamStatsSkeleton } from "./ExamsSkeletons";
import { ExamsPageMotion } from "./ExamsPageMotion";
import styles from "./exams.module.css";
import { parseStudyPeriod, studyPeriodLabel, studyPeriods } from "@/lib/study-period";

export const metadata: Metadata = { title: "Exams" };

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; period?: string }>;
}) {
  const query = await searchParams;
  const createdId = Number(query.created);
  const period = parseStudyPeriod(query.period);
  return (
    <ExamsPageMotion className={styles.page}>
      <header className={styles.hero} data-exam-section>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}><ClipboardText size={15} weight="fill" /> Practice library</span>
          <h1>Exams</h1>
          <p>Build focused practice from your readings, then return to the questions that need another look.</p>
          <Link className={styles.createButton} href="/app/exams/new"><NotePencil size={18} weight="bold" /> Create an exam <ArrowRight size={17} weight="bold" /></Link>
        </div>
        <Suspense fallback={<ExamStatsSkeleton />}><ExamHeaderStats period={period} /></Suspense>
      </header>
      <nav className={styles.periodFilter} aria-label="Exam history period">
        {studyPeriods.map((option) => <Link className={option === period ? styles.periodActive : ""} href={`/app/exams?period=${option}`} key={option}>{studyPeriodLabel(option)}</Link>)}
      </nav>
      <Suspense fallback={<ExamLibrarySkeleton />}><ExamLibraryBody period={period} createdExamId={Number.isInteger(createdId) && createdId > 0 ? createdId : undefined} /></Suspense>
    </ExamsPageMotion>
  );
}
