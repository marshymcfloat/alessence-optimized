import styles from "./dashboard.module.css";

const Bone = ({ className = "" }: { className?: string }) => <span className={`${styles.dashboardBone} ${className}`} />;

export function GreetingSkeleton() { return <div className={styles.greetingSkeleton} aria-label="Loading greeting"><Bone /></div>; }
export function WelcomeActionSkeleton() { return <div className={styles.welcomeActionSkeleton} aria-label="Loading study recommendation"><Bone /><Bone /></div>; }
export function FocusStateSkeleton() { return <Bone className={styles.stateSkeleton} />; }
export function FocusContentSkeleton() {
  return <div className={`${styles.focusCopy} ${styles.focusSkeleton}`} aria-label="Loading recommended exam"><Bone /><Bone /><Bone /><Bone /></div>;
}
export function MaterialsSkeleton() {
  return <div className={styles.materialSkeleton} aria-label="Loading recent materials">{Array.from({ length: 4 }, (_, index) => <div key={index}><Bone /><span><Bone /><Bone /></span><Bone /></div>)}</div>;
}
export function ProgressSkeleton() {
  return <div className={styles.progressSkeleton} aria-label="Loading study snapshot"><div><Bone /><Bone /></div><div>{Array.from({ length: 4 }, (_, index) => <Bone key={index} />)}</div></div>;
}
export function ReviewSkeleton() { return <div className={styles.reviewSkeleton} aria-label="Loading study recommendation"><Bone /><Bone /><Bone /><Bone /></div>; }
export function LatestResultSkeleton() { return <div className={styles.latestSkeleton} aria-label="Loading latest result"><Bone /><span><Bone /><Bone /></span><Bone /></div>; }
