import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, CalendarBlank, CheckCircle, Question,
  Target, TrendUp, XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { requirePageUser } from "@/features/auth/page-session";
import { attemptDetails, attemptReviewState } from "@/features/exams/history-service";
import { formatDate, percent } from "@/lib/format";
import { AttemptReviewing } from "./AttemptReviewing";
import styles from "./attempt-results.module.css";

export const metadata: Metadata = { title: "Exam results" };

export default async function AttemptResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const attemptId = Number(id);
  const reviewState = await attemptReviewState(attemptId, user.id);
  if (reviewState.status === "IN_PROGRESS") redirect(`/app/exams/${reviewState.examId}/take?attempt=${attemptId}`);
  if (reviewState.status === "ABANDONED") redirect(`/app/exams/${reviewState.examId}`);
  if (reviewState.status !== "COMPLETED") {
    return <AttemptReviewing attemptId={attemptId} initialStatus={reviewState.status} examDescription={reviewState.examDescription} subjectTitle={reviewState.subjectTitle} />;
  }
  const attempt = await attemptDetails(attemptId, user.id);
  const correct = attempt.questions.filter((question) => question.isCorrect).length;
  const incorrect = attempt.questions.length - correct;
  const score = attempt.score ?? 0;
  const topics = weakTopics(attempt.questions);
  const mascot = {
    src: "/mascots/exam-planner-mascot-v2.png",
    alt: "Alessence mascot holding an exam planner",
    width: 1536,
    height: 1024,
  };

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href={`/app/exams/${attempt.exam.id}`}><ArrowLeft size={16} weight="bold" /> Back to exam</Link>

      <header className={`${styles.hero} ${styles[scoreTone(score)]}`}>
        <div className={styles.heroCopy}>
          <span className={styles.subject}>{attempt.exam.subject.title}</span>
          <span className={styles.grounding}>{attempt.exam.groundingMode === "SOURCES" ? "Source-grounded" : "Model knowledge"}</span>
          <p className={styles.kicker}>Attempt complete</p>
          <h1>Exam results</h1>
          <p className={styles.examTitle}>{attempt.exam.title}</p>
          <span className={styles.completed}><CalendarBlank size={15} /> Completed {attempt.completedAt ? formatDate(attempt.completedAt) : "recently"}</span>
        </div>

        <div className={styles.scoreBlock}>
          <span>Your score</span>
          <strong>{percent(score)}</strong>
          <p>{resultCopy(score)}</p>
        </div>

        <Image className={styles.mascot} src={mascot.src} alt={mascot.alt} width={mascot.width} height={mascot.height} priority sizes="(max-width: 760px) 42vw, 260px" />
      </header>

      <section className={styles.overview} aria-label="Attempt summary">
        <div className={styles.summaryCard}>
          <div className={styles.summaryHeading}><div><span>Performance</span><h2>At a glance</h2></div><TrendUp size={21} weight="duotone" /></div>
          <div className={styles.metrics}>
            <div><span className={styles.correctIcon}><CheckCircle size={19} weight="fill" /></span><strong>{correct}</strong><small>Correct</small></div>
            <div><span className={styles.wrongIcon}><XCircle size={19} weight="fill" /></span><strong>{incorrect}</strong><small>To review</small></div>
            <div><span className={styles.totalIcon}><Question size={19} weight="duotone" /></span><strong>{attempt.questions.length}</strong><small>Total</small></div>
          </div>
          <div className={styles.actions}>
            <Link href={`/app/exams/${attempt.exam.id}`}>Practice again <ArrowRight size={16} weight="bold" /></Link>
            <Link href="/app/progress">View progress</Link>
          </div>
        </div>

        <aside className={styles.focusCard}>
          <div className={styles.summaryHeading}><div><span>Next focus</span><h2>Topics to revisit</h2></div><Target size={21} weight="duotone" /></div>
          {topics.length ? (
            <div className={styles.topicList}>{topics.map(([topic, misses], index) => <div key={topic}><span>{String(index + 1).padStart(2, "0")}</span><strong>{topic}</strong><small>{misses} {misses === 1 ? "miss" : "misses"}</small></div>)}</div>
          ) : (
            <div className={styles.clearState}><CheckCircle size={25} weight="duotone" /><span><strong>No weak topic found</strong><small>This attempt shows balanced coverage.</small></span></div>
          )}
        </aside>
      </section>

      <section className={styles.review} aria-labelledby="answer-review-title">
        <div className={styles.sectionHead}>
          <div><span>Question by question</span><h2 id="answer-review-title">Answer review</h2></div>
          <strong>{attempt.questions.length} questions</strong>
        </div>

        <div className={styles.answerGrid}>
          {attempt.questions.map((question, index) => (
            <article className={`${styles.answerCard} ${question.isCorrect ? styles.answerCorrect : styles.answerWrong}`} key={question.id}>
              <div className={styles.questionHead}>
                <span className={styles.questionNumber}>{String(index + 1).padStart(2, "0")}</span>
                <div><small>{question.topicLabel ?? "General coverage"}</small><strong>{question.isCorrect ? "Correct" : "Review"}</strong></div>
                {question.isCorrect ? <CheckCircle size={20} weight="fill" /> : <XCircle size={20} weight="fill" />}
              </div>

              <h3>{question.text}</h3>

              <div className={styles.answerDetails}>
                <div className={styles.userAnswer}><span>Your answer</span><p>{question.userAnswer || "No answer"}</p></div>
                {!question.isCorrect && <div className={styles.correctAnswer}><span>Correct answer</span><p>{question.correctAnswer}</p></div>}
              </div>

              {(question.feedback ?? question.explanation) && (
                <div className={styles.feedback}><span>Explanation</span><p>{question.feedback ?? question.explanation}</p></div>
              )}

              {question.isComputational && question.calculationMetadata && typeof question.calculationMetadata === "object" && !Array.isArray(question.calculationMetadata) && (
                <details className={styles.sources}>
                  <summary>View calculation</summary>
                  <div>
                    {Array.isArray((question.calculationMetadata as { steps?: unknown }).steps) && (question.calculationMetadata as { steps: unknown[] }).steps.map((step, stepIndex) => <p key={stepIndex}>{stepIndex + 1}. {String(step)}</p>)}
                    <strong>{String((question.calculationMetadata as { roundingInstruction?: unknown }).roundingInstruction ?? "")}</strong>
                  </div>
                </details>
              )}

              {Array.isArray(question.sourceCitations) && question.sourceCitations.length > 0 && (
                <details className={styles.sources}>
                  <summary>View source support</summary>
                  <div>{(question.sourceCitations as Array<{ chunkId?: number; fileName?: string; locator?: string | null; quote?: string }>).map((citation, citationIndex) => (
                    <div key={`${citation.chunkId ?? "citation"}-${citationIndex}`}>
                      <strong>{citation.fileName ?? "Source material"}{citation.locator ? ` — ${citation.locator}` : ""}</strong>
                      {citation.quote && <p>“{citation.quote}”</p>}
                    </div>
                  ))}</div>
                </details>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function resultCopy(score: number) {
  if (score >= 90) return "The material is holding well.";
  if (score >= 75) return "A focused review should close the remaining gaps.";
  return "Review the missed topics before trying another set.";
}

function scoreTone(score: number) {
  if (score >= 90) return "highScore";
  if (score >= 75) return "mediumScore";
  return "reviewScore";
}

function weakTopics(questions: Array<{ isCorrect: boolean; topicLabel: string | null }>) {
  const counts = new Map<string, number>();
  questions.filter((question) => !question.isCorrect).forEach((question) => {
    const topic = question.topicLabel ?? "General";
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 4);
}
