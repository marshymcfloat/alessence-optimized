import styles from "./materials.module.css";
const Bone = ({ className = "" }: { className?: string }) => <span className={`${styles.materialBone} ${className}`} />;
export function HeaderStatsSkeleton() { return <div className={styles.headerStatsSkeleton}>{Array.from({ length: 3 }, (_, i) => <Bone key={i} />)}</div>; }
export function UploadSkeleton() { return <div className={styles.uploadSkeleton}><Bone /><Bone /><Bone /></div>; }
export function SubjectsSkeleton() { return <div className={styles.subjectsSkeleton}><Bone />{Array.from({ length: 4 }, (_, i) => <div key={i}><Bone /><span><Bone /><Bone /></span></div>)}</div>; }
export function LibrarySkeleton() { return <div className={styles.librarySkeleton}><div><Bone /><Bone /></div><div>{Array.from({ length: 4 }, (_, i) => <Bone key={i} />)}</div></div>; }
