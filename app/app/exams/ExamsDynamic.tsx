import Link from "next/link";
import {
  ArrowRight, Books, CalendarBlank, CheckCircle, ClipboardText, Clock,
  Lightning, Play, Question, Repeat, WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/lib/format";
import { ClearFailedExams, ExamDeleteButton } from "./ExamDeleteControls";
import { GenerationRefresh } from "./GenerationRefresh";
import { ExamsReveal } from "./ExamsPageMotion";
import { examsPageData } from "./exams-data";
import styles from "./exams.module.css";

export async function ExamHeaderStats() {
  const exams = await examsPageData();
  const ready = exams.filter((exam) => exam.status === "READY");
  const attempted = ready.filter((exam) => exam._count.attempts > 0).length;

  return (
    <ExamsReveal className={styles.heroStats}>
      <div><span className={styles.statIcon}><Books size={21} weight="duotone" /></span><strong>{exams.length}</strong><small>Total exams</small></div>
      <div><span className={styles.statIcon}><CheckCircle size={21} weight="duotone" /></span><strong>{ready.length}</strong><small>Ready to study</small></div>
      <div><span className={styles.statIcon}><Repeat size={21} weight="duotone" /></span><strong>{attempted}</strong><small>Practiced</small></div>
    </ExamsReveal>
  );
}

export async function ExamLibraryBody() {
  const exams = await examsPageData();
  const ready = exams.filter((exam) => exam.status === "READY");
  const generating = exams.filter((exam) => exam.status === "GENERATING");
  const failed = exams.filter((exam) => exam.status === "FAILED");

  return (
    <ExamsReveal className={styles.libraryBody}>
      {!exams.length && (
        <section className={styles.emptyState}>
          <span><ClipboardText size={36} weight="duotone" /></span>
          <div><p>Your practice library is empty</p><h2>Create an exam from material you already trust.</h2><small>Select a subject, choose your sources, and let Alessence build the questions.</small></div>
          <Link href="/app/exams/new">Create your first exam <ArrowRight size={17} weight="bold" /></Link>
        </section>
      )}

      {generating.length > 0 && (
        <section className={styles.generationSection} aria-labelledby="generation-title">
          <GenerationRefresh />
          <div className={styles.sectionHead}><div><span>Working in the background</span><h2 id="generation-title">Being prepared</h2></div><strong>{generating.length}</strong></div>
          <div className={styles.generationGrid}>
            {generating.map((exam) => {
              const generation = exam.generations[0];
              const progress = generation?.progress ?? 0;
              return (
                <article className={styles.generationCard} aria-busy="true" key={exam.id}>
                  <span className={styles.generatingIcon}><Lightning size={22} weight="duotone" /></span>
                  <div className={styles.generationCopy}>
                    <span>{exam.subject.title}</span><h3>{exam.description}</h3>
                    <div className={styles.progressLine}><progress value={progress} max="100" aria-label={`${progress}% generated`} /><b>{progress}%</b></div>
                    <small>{generation ? generation.status.toLowerCase().replaceAll("_", " ") : "queued"} · {exam.requestedItems} questions</small>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {ready.length > 0 && (
        <section aria-labelledby="ready-title">
          <div className={styles.sectionHead}>
            <div><span>Your practice shelf</span><h2 id="ready-title">Ready to study</h2></div>
            <strong>{ready.length}</strong>
          </div>
          <div className={styles.examGrid}>
            {ready.map((exam, index) => (
              <article className={`${styles.examCard} ${styles[`tone${index % 4}`]}`} key={exam.id}>
                <div className={styles.cardTop}>
                  <div className={styles.cardIdentity}>
                    <span className={styles.subjectMark}><ClipboardText size={23} weight="duotone" /></span>
                    <span className={styles.cardSequence}><small>Practice set</small><strong>{String(index + 1).padStart(2, "0")}</strong></span>
                  </div>
                  <div className={styles.cardTools}>
                    <div className={styles.badges}>
                      {exam.isMock && <span>Mock exam</span>}
                      <span>{exam._count.attempts ? `${exam._count.attempts} ${exam._count.attempts === 1 ? "attempt" : "attempts"}` : "New"}</span>
                    </div>
                    <ExamDeleteButton examId={exam.id} examTitle={exam.description} />
                  </div>
                </div>

                <div className={styles.examCopy}>
                  <p>{exam.subject.title}</p>
                  <h3>{exam.description}</h3>
                </div>

                <div className={styles.metaGrid}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaIcon}><Question size={16} weight="duotone" /></span>
                    <span><small>Questions</small><strong>{exam.requestedItems}</strong></span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaIcon}><Clock size={16} weight="duotone" /></span>
                    <span><small>Time limit</small><strong>{exam.timeLimit ? `${exam.timeLimit} min` : "Untimed"}</strong></span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaIcon}><CalendarBlank size={16} weight="duotone" /></span>
                    <span><small>Created</small><strong>{formatDate(exam.createdAt)}</strong></span>
                  </div>
                </div>

                <div className={styles.typeList} aria-label="Question types">
                  {exam.questionTypes.map((type) => <span key={type}>{formatType(type)}</span>)}
                </div>
                <Link className={styles.openButton} href={`/app/exams/${exam.id}`}>
                  <Play size={16} weight="fill" />
                  {exam._count.attempts ? "Practice again" : "Open exam"}
                  <ArrowRight size={16} weight="bold" />
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      {failed.length > 0 && (
        <section className={styles.failedSection} aria-labelledby="failed-title">
          <div className={styles.failedHeading}><span><WarningCircle size={22} weight="duotone" /></span><div><p>Needs attention</p><h2 id="failed-title">Generation stopped</h2></div><b aria-label={`${failed.length} failed exams`}>{failed.length}</b><ClearFailedExams examIds={failed.map((exam) => exam.id)} /></div>
          <div className={styles.failedList}>
            {failed.map((exam) => (
              <article key={exam.id}>
                <span className={styles.failedIcon}><WarningCircle size={19} /></span>
                <span><strong>{exam.description}</strong><small>{exam.subject.title} · {exam.generations[0]?.failureCode?.toLowerCase().replaceAll("_", " ") ?? "generation failed"}</small></span>
                <span className={styles.failedActions}><Link className={styles.retryLabel} href={`/app/exams/${exam.id}`}>Review and retry <ArrowRight size={16} /></Link><ExamDeleteButton examId={exam.id} examTitle={exam.description} compact /></span>
              </article>
            ))}
          </div>
        </section>
      )}
    </ExamsReveal>
  );
}

function formatType(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}
