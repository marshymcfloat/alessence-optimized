import { ArrowRight, BookOpenText, CalendarBlank, ChartLineUp, CheckCircle, Clock, FileText, HourglassMedium, Medal, PencilSimple, Question, ShieldCheck, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { requirePageUser } from "@/features/auth/page-session";
import { examAttemptsForDetail } from "@/features/exams/history-service";
import { formatDate, percent } from "@/lib/format";
import { ExamDetailActions } from "./ExamDetailActions";
import { examDetailData } from "./exam-detail-data";
import styles from "./exam-detail.module.css";
import { parseStudyPeriod, studyPeriodLabel, studyPeriods } from "@/lib/study-period";

type DetailProps = { params: Promise<{ id: string }> };

export async function ExamHeader({ params }: DetailProps) {
  const { exam } = await examDetailData(params);
  return (
    <header className={styles.header}>
      <div className={styles.titleBlock}><p>{exam.subject.title}</p><h1>{exam.title}</h1><span>{exam.description}</span></div>
      <div className={styles.meta} aria-label="Exam details">
        <span><Question size={17} /><b>{exam.requestedItems}</b> questions</span>
        <span><Clock size={17} /><b>{exam.timeLimit ?? "No"}</b> {exam.timeLimit ? "minutes" : "time limit"}</span>
        <span><ShieldCheck size={17} />{exam.isPracticeMode ? "Practice mode" : "Single attempt"}</span>
      </div>
    </header>
  );
}

export async function ExamActionPanel({ params }: DetailProps) {
  const { exam, generation } = await examDetailData(params);
  return <ExamDetailActions examId={exam.id} initialStatus={exam.status} initialGeneration={generation} />;
}

export async function ExamSources({ params }: DetailProps) {
  const { exam, generation } = await examDetailData(params);
  const sourceGrounded = generation?.groundingMode === "SOURCES";
  return (
    <aside className={styles.sources}>
      <div className={styles.sourcesHead}>
        <span><BookOpenText size={20} weight="duotone" /></span>
        <div><p>Question grounding</p><h2>{sourceGrounded ? "Your selected readings" : "Model knowledge"}</h2></div>
      </div>
      <p className={styles.sourceNote}>{sourceGrounded ? "Questions are checked against the materials below." : "No source files were attached to this exam."}</p>
      {exam.sourceFiles.length > 0 && <div className={styles.sourceList}>{exam.sourceFiles.map((file) => <div className={styles.sourceRow} key={file.id}><span><FileText size={18} /></span><strong>{file.name}</strong></div>)}</div>}
    </aside>
  );
}

export async function ExamOutline({ params }: DetailProps) {
  const { exam } = await examDetailData(params);
  if (exam.status !== "READY") return null;
  return (
    <section className={styles.outline} aria-labelledby="outline-title">
      <div className={styles.sectionHead}>
        <div><p>Before you begin</p><h2 id="outline-title">What this exam covers</h2></div>
        <span>{exam.questions.length} questions</span>
      </div>
      <div className={styles.questionList}>
        {exam.questions.slice(0, 6).map((question) => (
          <article className={styles.questionRow} key={question.id}>
            <span className={styles.questionNumber}>{String(question.slot).padStart(2, "0")}</span>
            <div><strong>{question.topicLabel ?? "General coverage"}</strong><small>{formatLabel(question.type)} · {formatLabel(question.difficulty)}</small></div>
          </article>
        ))}
      </div>
      {exam.questions.length > 6 && <p className={styles.moreQuestions}>Plus {exam.questions.length - 6} more questions in the full exam.</p>}
    </section>
  );
}

export async function ExamAttemptHistory({ params, searchParams }: DetailProps & { searchParams: Promise<{ attempts?: string }> }) {
  const [user, { id }, query] = await Promise.all([requirePageUser(), params, searchParams]);
  const examId = Number(id);
  const period = parseStudyPeriod(query.attempts);
  const attempts = await examAttemptsForDetail(examId, user.id, period);

  const completed = attempts.filter((attempt) => attempt.status === "COMPLETED" && attempt.score !== null);
  const bestScore = completed.length ? Math.max(...completed.map((attempt) => attempt.score ?? 0)) : null;
  const recent = attempts.slice(0, 5);
  const earlier = attempts.slice(5);
  const trend = completed.slice(0, 8).reverse();

  const cards = (items: typeof attempts) => items.map((attempt) => {
    const latest = attempt.id === attempts[0]?.id;
    const best = attempt.status === "COMPLETED" && attempt.score === bestScore;
    return (
      <article className={styles.attemptCard} key={attempt.id}>
        <div className={styles.attemptIdentity}>
          <span>{String(attempt.attemptNumber).padStart(2, "0")}</span>
          <div><small>Attempt {attempt.attemptNumber}</small><strong>{attemptTitle(attempt.status)}</strong></div>
        </div>
        <div className={styles.attemptBadges}>{latest && <span>Latest</span>}{best && <span className={styles.bestBadge}><Medal size={13} weight="fill" /> Best</span>}</div>
        {attempt.status === "COMPLETED" ? (
          <>
            <div className={styles.attemptScore}><strong>{percent(attempt.score ?? 0)}</strong><small>{attempt.correctAnswers} of {attempt.totalQuestions} correct</small></div>
            <div className={styles.attemptMeta}><span><CalendarBlank size={14} />{formatDate(attempt.completedAt ?? attempt.startedAt)}</span><span><Clock size={14} />{formatDuration(attempt.durationSeconds)}</span></div>
            <Link className={styles.attemptLink} href={`/app/attempts/${attempt.id}`}>Review answers <ArrowRight size={15} weight="bold" /></Link>
          </>
        ) : (
          <>
            <div className={`${styles.attemptState} ${styles[`attempt${attempt.status}`]}`}>{attemptStatusIcon(attempt.status)}<span>{attemptStatusCopy(attempt.status)}</span></div>
            <Link className={styles.attemptLink} href={attempt.status === "IN_PROGRESS" ? `/app/exams/${examId}/take?attempt=${attempt.id}` : `/app/attempts/${attempt.id}`}>{attempt.status === "IN_PROGRESS" ? "Resume exam" : attempt.status === "SUBMITTING" ? "View review status" : "Resolve review"}<ArrowRight size={15} weight="bold" /></Link>
          </>
        )}
      </article>
    );
  });

  return (
    <section className={styles.history} aria-labelledby="attempt-history-title">
      <div className={styles.sectionHead}>
        <div><p>Your study record</p><h2 id="attempt-history-title">Previous attempts</h2></div>
        <span>{attempts.length} {attempts.length === 1 ? "attempt" : "attempts"}</span>
      </div>
      <nav className={styles.periodFilter} aria-label="Attempt history period">
        {studyPeriods.map((option) => <Link className={option === period ? styles.periodActive : ""} href={`/app/exams/${examId}?attempts=${option}`} key={option}>{studyPeriodLabel(option)}</Link>)}
      </nav>
      {!attempts.length && <div className={styles.emptyHistory}><CalendarBlank size={24} weight="duotone" /><span>No attempts in this period.</span></div>}
      {trend.length >= 2 && <div className={styles.attemptTrend} aria-label="Score trend">
        <span><ChartLineUp size={18} weight="duotone" /><strong>Score trend</strong><small>Oldest to newest</small></span>
        <div>{trend.map((attempt) => <i style={{ height: `${Math.max(8, attempt.score ?? 0)}%` }} aria-label={`Attempt ${attempt.attemptNumber}: ${percent(attempt.score ?? 0)}`} key={attempt.id} />)}</div>
        <strong>{percent(trend.at(-1)?.score ?? 0)}</strong>
      </div>}
      <div className={styles.attemptList}>{cards(recent)}</div>
      {earlier.length > 0 && <details className={styles.earlierAttempts}><summary>View {earlier.length} earlier {earlier.length === 1 ? "attempt" : "attempts"}</summary><div className={styles.attemptList}>{cards(earlier)}</div></details>}
    </section>
  );
}

function attemptTitle(status: string) {
  if (status === "COMPLETED") return "Completed";
  if (status === "IN_PROGRESS") return "In progress";
  if (status === "SUBMITTING") return "Being reviewed";
  return "Review paused";
}

function attemptStatusCopy(status: string) {
  if (status === "IN_PROGRESS") return "Your saved answers are ready to continue.";
  if (status === "SUBMITTING") return "Answers are being scored and checked.";
  return "Your answers are safe, but the review needs to be restarted.";
}

function attemptStatusIcon(status: string) {
  if (status === "IN_PROGRESS") return <PencilSimple size={18} weight="duotone" />;
  if (status === "SUBMITTING") return <HourglassMedium size={18} weight="duotone" />;
  if (status === "COMPLETED") return <CheckCircle size={18} weight="duotone" />;
  return <WarningCircle size={18} weight="duotone" />;
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function formatLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}
