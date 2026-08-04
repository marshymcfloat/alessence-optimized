import Link from "next/link";
import {
  ArrowRight, CalendarBlank, ChartLineUp, Target, TrendUp,
} from "@phosphor-icons/react/dist/ssr";
import { formatDate, percent } from "@/lib/format";
import { progressPageData } from "./progress-data";
import styles from "./progress.module.css";

export async function ProgressHeaderStats() {
  const progress = await progressPageData();
  return (
    <div className={styles.headerStats} aria-label="Progress summary">
      <div><strong>{percent(progress.averageScore)}</strong><span>Average</span></div>
      <div><strong>{progress.completedAttempts}</strong><span>Attempts</span></div>
      <div><strong>{progress.weakTopics.length}</strong><span>Review topics</span></div>
    </div>
  );
}

export async function TrendBadge() {
  const progress = await progressPageData();
  return <span className={styles.trendBadge}><TrendUp size={16} /> Last {progress.recentAttempts.length}</span>;
}

export async function ScoreTrend() {
  const progress = await progressPageData();
  const trend = [...progress.recentAttempts].reverse();
  const points = trendPoints(trend.map((attempt) => attempt.score));

  if (!trend.length) {
    return <div className={styles.emptyChart}><ChartLineUp size={32} weight="duotone" /><h3>Your score trend will start here</h3><p>Complete an exam to add the first point.</p><Link href="/app/exams">Choose an exam <ArrowRight size={16} /></Link></div>;
  }

  return (
    <>
      <div className={styles.chart}>
        <div className={styles.axisLabels}><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
        <svg viewBox="0 0 600 180" role="img" aria-label={`Scores from ${trend.map((attempt) => percent(attempt.score)).join(" to ")}`} preserveAspectRatio="none">
          <title>Recent exam score trend</title>
          {[10, 50, 90, 130, 170].map((y) => <line x1="0" y1={y} x2="600" y2={y} key={y} />)}
          {points.length > 1 && <polyline className={styles.areaLine} points={`0,170 ${points} 600,170`} />}
          {points.length > 1 && <polyline className={styles.scoreLine} points={points} />}
          {trend.map((attempt, index) => {
            const point = trendPoint(attempt.score, index, trend.length);
            return <circle cx={point.x} cy={point.y} r="6" key={attempt.id}><title>{attempt.examTitle}: {percent(attempt.score)}</title></circle>;
          })}
        </svg>
      </div>
      <div className={styles.chartLabels}>{trend.map((attempt) => <span key={attempt.id}>{formatShortDate(attempt.completedAt)}</span>)}</div>
    </>
  );
}

export async function PracticeRecommendation() {
  const progress = await progressPageData();
  const hasWeakTopics = progress.weakTopics.length > 0;
  return (
    <div className={styles.practiceContent}>
      <p>{hasWeakTopics ? "Recommended practice" : "Build your learning map"}</p>
      <h2>{progress.weakTopics[0]?.topic ?? "A short quiz can reveal your next focus area"}</h2>
      <span>{hasWeakTopics ? "An adaptive quiz will prioritize questions related to recent mistakes." : "Complete an exam first, then adaptive practice will use your results."}</span>
      <Link href={hasWeakTopics ? "/app/exams/quiz" : "/app/exams"}>{hasWeakTopics ? "Start adaptive quiz" : "Choose an exam"}<ArrowRight size={17} weight="bold" /></Link>
    </div>
  );
}

export async function WeakTopics() {
  const progress = await progressPageData();
  const maxMisses = Math.max(...progress.weakTopics.map((topic) => topic.misses), 1);
  return (
    <div className={styles.topicList}>
      {progress.weakTopics.map((topic, index) => (
        <div className={styles.topicRow} key={topic.topic}>
          <span className={`${styles.rank} ${styles[`rank${index}`]}`}>{index + 1}</span>
          <div><strong>{topic.topic}</strong><span>{topic.misses} missed {topic.misses === 1 ? "answer" : "answers"}</span><progress value={topic.misses} max={maxMisses} aria-label={`${topic.topic}: ${topic.misses} misses`} /></div>
        </div>
      ))}
      {!progress.weakTopics.length && <div className={styles.emptyTopics}><Target size={27} weight="duotone" /><div><strong>No focus topics yet</strong><span>Wrong-answer patterns will appear after completed exams.</span></div></div>}
    </div>
  );
}

export async function BestScore() {
  const progress = await progressPageData();
  const strongest = progress.recentAttempts.reduce<(typeof progress.recentAttempts)[number] | null>((best, attempt) => !best || attempt.score > best.score ? attempt : best, null);
  return strongest ? <span className={styles.bestScore}>Best {percent(strongest.score)}</span> : null;
}

export async function RecentAttempts() {
  const progress = await progressPageData();
  return (
    <div className={styles.attemptList}>
      {progress.recentAttempts.map((attempt, index) => (
        <Link href={`/app/attempts/${attempt.id}`} key={attempt.id}>
          <span className={`${styles.attemptIcon} ${styles[`tone${index % 4}`]}`}><ChartLineUp size={20} weight="duotone" /></span>
          <span className={styles.attemptCopy}><strong>{attempt.examTitle}</strong><small>{attempt.subjectTitle} · {formatDate(attempt.completedAt)}</small></span>
          <span className={`${styles.score} ${scoreClass(attempt.score)}`}>{percent(attempt.score)}</span>
          <ArrowRight size={16} />
        </Link>
      ))}
      {!progress.recentAttempts.length && <div className={styles.emptyAttempts}><CalendarBlank size={26} weight="duotone" /><span>Completed attempts will appear here.</span></div>}
    </div>
  );
}

function trendPoint(score: number, index: number, count: number) {
  const x = count === 1 ? 300 : 20 + index * (560 / (count - 1));
  const y = 170 - Math.max(0, Math.min(100, score)) * 1.6;
  return { x, y };
}

function trendPoints(scores: number[]) {
  return scores.map((score, index) => {
    const point = trendPoint(score, index, scores.length);
    return `${point.x},${point.y}`;
  }).join(" ");
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function scoreClass(score: number) {
  if (score >= 80) return styles.scoreHigh;
  if (score >= 60) return styles.scoreMid;
  return styles.scoreLow;
}
