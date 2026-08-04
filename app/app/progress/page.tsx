import { Suspense } from "react";
import type { Metadata } from "next";
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

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <p>Learning record</p>
          <h1>Progress</h1>
          <span>See what is improving and choose the next useful practice.</span>
        </div>
        <Suspense fallback={<HeaderStatsSkeleton />}><ProgressHeaderStats /></Suspense>
      </header>

      <div className={styles.mainGrid}>
        <section className={styles.trendCard} aria-labelledby="trend-title">
          <div className={styles.sectionHead}>
            <div><span>Recent performance</span><h2 id="trend-title">Score trend</h2></div>
            <Suspense fallback={<TrendBadgeSkeleton />}><TrendBadge /></Suspense>
          </div>
          <Suspense fallback={<TrendSkeleton />}><ScoreTrend /></Suspense>
        </section>

        <aside className={styles.practiceCard}>
          <span className={styles.practiceIcon}><Brain size={28} weight="duotone" /></span>
          <Suspense fallback={<PracticeSkeleton />}><PracticeRecommendation /></Suspense>
        </aside>
      </div>

      <div className={styles.detailGrid}>
        <section className={styles.topicCard} aria-labelledby="topics-title">
          <div className={styles.sectionHead}>
            <div><span>Priority review</span><h2 id="topics-title">Topics to revisit</h2></div>
            <Target size={22} weight="duotone" />
          </div>
          <Suspense fallback={<TopicsSkeleton />}><WeakTopics /></Suspense>
        </section>

        <section className={styles.attemptCard} aria-labelledby="attempts-title">
          <div className={styles.sectionHead}>
            <div><span>Your history</span><h2 id="attempts-title">Recent attempts</h2></div>
            <Suspense fallback={<BestScoreSkeleton />}><BestScore /></Suspense>
          </div>
          <Suspense fallback={<AttemptsSkeleton />}><RecentAttempts /></Suspense>
        </section>
      </div>
    </div>
  );
}
