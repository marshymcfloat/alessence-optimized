import styles from "./exam-detail.module.css";

function Bone({ className = "" }: { className?: string }) {
  return <span className={`${styles.detailBone} ${className}`} aria-hidden="true" />;
}

export function ExamHeaderSkeleton() {
  return (
    <header className={`${styles.header} ${styles.headerSkeleton}`} aria-label="Loading exam details">
      <div className={styles.titleSkeleton}><Bone /><Bone /><Bone /></div>
      <div className={styles.metaSkeleton}>{Array.from({ length: 3 }, (_, index) => <Bone key={index} />)}</div>
    </header>
  );
}

export function ActionPanelSkeleton() {
  return <section className={`${styles.actionPanel} ${styles.actionSkeleton}`} aria-label="Loading exam status"><Bone /><Bone /><Bone /><Bone /></section>;
}

export function ExamSourcesSkeleton() {
  return <aside className={`${styles.sources} ${styles.sourcesSkeleton}`} aria-label="Loading source details"><div><Bone /><span><Bone /><Bone /></span></div><Bone /><Bone /><Bone /></aside>;
}

export function ExamOutlineSkeleton() {
  return <section className={`${styles.outline} ${styles.outlineSkeleton}`} aria-label="Loading exam outline"><div><span><Bone /><Bone /></span><Bone /></div><div>{Array.from({ length: 6 }, (_, index) => <Bone key={index} />)}</div></section>;
}

export function AttemptHistorySkeleton() {
  return <section className={`${styles.history} ${styles.historySkeleton}`} aria-label="Loading previous attempts"><div><span><Bone /><Bone /></span><Bone /></div><div>{Array.from({ length: 3 }, (_, index) => <Bone key={index} />)}</div></section>;
}
