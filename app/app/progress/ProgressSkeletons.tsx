import styles from "./progress.module.css";

function Bone({ className = "" }: { className?: string }) {
  return <span className={`${styles.progressBone} ${className}`} aria-hidden="true" />;
}

export function HeaderStatsSkeleton() {
  return <div className={`${styles.headerStats} ${styles.headerStatsSkeleton}`} aria-label="Loading progress summary">{Array.from({ length: 3 }, (_, index) => <Bone key={index} />)}</div>;
}

export function TrendBadgeSkeleton() {
  return <Bone className={styles.trendBadgeBone} />;
}

export function TrendSkeleton() {
  return <div className={styles.trendSkeleton} aria-label="Loading score trend"><Bone /><Bone /><Bone /><Bone /><Bone /></div>;
}

export function PracticeSkeleton() {
  return <div className={styles.practiceSkeleton} aria-label="Loading recommendation"><Bone /><Bone /><Bone /><Bone /></div>;
}

export function TopicsSkeleton() {
  return <div className={styles.listSkeleton} aria-label="Loading review topics">{Array.from({ length: 3 }, (_, index) => <div key={index}><Bone /><span><Bone /><Bone /></span></div>)}</div>;
}

export function BestScoreSkeleton() {
  return <Bone className={styles.bestScoreBone} />;
}

export function AttemptsSkeleton() {
  return <div className={styles.listSkeleton} aria-label="Loading recent attempts">{Array.from({ length: 3 }, (_, index) => <div key={index}><Bone /><span><Bone /><Bone /></span></div>)}</div>;
}
