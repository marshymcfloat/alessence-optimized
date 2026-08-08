import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Brain, Target } from "@phosphor-icons/react/dist/ssr";
import {
  BestScore, PracticeRecommendation, ProgressHeaderStats, RecentAttempts,
  ScoreTrend, TrendBadge, WeakTopics,
} from "./ProgressDynamic";
import {
  AttemptsSkeleton, BestScoreSkeleton, HeaderStatsSkeleton, PracticeSkeleton,
  TopicsSkeleton, TrendBadgeSkeleton, TrendSkeleton,
} from "./ProgressSkeletons";
import styles from "./progress.module.css";
import { parseStudyPeriod, studyPeriodLabel, studyPeriods } from "@/lib/study-period";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const period = parseStudyPeriod((await searchParams).period);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <p>Learning record</p>
          <h1>Progress</h1>
          <span>See what is improving and choose the next useful practice.</span>
        </div>
        <Suspense fallback={<HeaderStatsSkeleton />}><ProgressHeaderStats period={period} /></Suspense>
      </header>
      <nav className={styles.periodFilter} aria-label="Progress history period">
        {studyPeriods.map((option) => <Link className={option === period ? styles.periodActive : ""} href={`/app/progress?period=${option}`} key={option}>{studyPeriodLabel(option)}</Link>)}
      </nav>

      <div className={styles.mainGrid}>
        <section className={styles.trendCard} aria-labelledby="trend-title">
          <div className={styles.sectionHead}>
            <div><span>Recent performance</span><h2 id="trend-title">Score trend</h2></div>
            <Suspense fallback={<TrendBadgeSkeleton />}><TrendBadge period={period} /></Suspense>
          </div>
          <Suspense fallback={<TrendSkeleton />}><ScoreTrend period={period} /></Suspense>
        </section>

        <aside className={styles.practiceCard}>
          <span className={styles.practiceIcon}><Brain size={28} weight="duotone" /></span>
          <Suspense fallback={<PracticeSkeleton />}><PracticeRecommendation period={period} /></Suspense>
        </aside>
      </div>

      <div className={styles.detailGrid}>
        <section className={styles.topicCard} aria-labelledby="topics-title">
          <div className={styles.sectionHead}>
            <div><span>Priority review</span><h2 id="topics-title">Topics to revisit</h2></div>
            <Target size={22} weight="duotone" />
          </div>
          <Suspense fallback={<TopicsSkeleton />}><WeakTopics period={period} /></Suspense>
        </section>

        <section className={styles.attemptCard} aria-labelledby="attempts-title">
          <div className={styles.sectionHead}>
            <div><span>Your history</span><h2 id="attempts-title">Recent attempts</h2></div>
            <Suspense fallback={<BestScoreSkeleton />}><BestScore period={period} /></Suspense>
          </div>
          <Suspense fallback={<AttemptsSkeleton />}><RecentAttempts period={period} /></Suspense>
        </section>
      </div>
    </div>
  );
}
