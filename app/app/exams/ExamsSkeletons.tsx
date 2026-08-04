import styles from "./exams.module.css";
const Bone = ({ className = "" }: { className?: string }) => <span className={`${styles.examBone} ${className}`} />;
export function ExamStatsSkeleton() { return <div className={styles.heroStatsSkeleton}>{Array.from({ length: 3 }, (_, i) => <Bone key={i} />)}</div>; }
export function ExamLibrarySkeleton() { return <div className={styles.librarySkeleton} aria-label="Loading exam library"><div><Bone /><Bone /></div><div>{Array.from({ length: 3 }, (_, i) => <Bone key={i} />)}</div></div>; }
