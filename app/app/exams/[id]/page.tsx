import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { ExamActionPanel, ExamAttemptHistory, ExamHeader, ExamOutline, ExamSources } from "./ExamDetailDynamic";
import { ActionPanelSkeleton, AttemptHistorySkeleton, ExamHeaderSkeleton, ExamOutlineSkeleton, ExamSourcesSkeleton } from "./ExamDetailSkeletons";
import styles from "./exam-detail.module.css";

export const metadata: Metadata = { title: "Exam details" };

type PageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ attempts?: string }> };

export default function ExamDetailPage({ params, searchParams }: PageProps) {
  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href="/app/exams"><ArrowLeft size={16} weight="bold" /> Exam library</Link>

      <Suspense fallback={<ExamHeaderSkeleton />}>
        <ExamHeader params={params} />
      </Suspense>

      <div className={styles.contentGrid}>
        <Suspense fallback={<ActionPanelSkeleton />}>
          <ExamActionPanel params={params} />
        </Suspense>
        <Suspense fallback={<ExamSourcesSkeleton />}>
          <ExamSources params={params} />
        </Suspense>
      </div>

      <Suspense fallback={<AttemptHistorySkeleton />}>
        <ExamAttemptHistory params={params} searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<ExamOutlineSkeleton />}>
        <ExamOutline params={params} />
      </Suspense>
    </div>
  );
}
