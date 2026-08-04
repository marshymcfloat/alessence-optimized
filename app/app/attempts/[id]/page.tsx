import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import { requirePageUser } from "@/features/auth/page-session";
import { attemptDetails } from "@/features/exams/history-service";
import { formatDate, percent } from "@/lib/format";

export const metadata: Metadata = { title: "Exam results" };

export default async function AttemptResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;
  const attempt = await attemptDetails(Number(id), user.id);
  const correct = attempt.questions.filter((question) => question.isCorrect).length;
  const score = attempt.score ?? 0;
  return (
    <>
      <header className="page-head">
        <div><p className="eyebrow">{attempt.exam.subject.title}</p><h1 className="serif">Exam results</h1><p>{attempt.exam.description} · completed {attempt.completedAt ? formatDate(attempt.completedAt) : "recently"}</p></div>
      </header>
      <div className="dashboard-grid">
        <section className="panel panel-soft">
          <p className="eyebrow">Your score</p>
          <div className="serif tabular" style={{ fontSize: "clamp(4rem, 18vw, 7rem)", lineHeight: ".9", letterSpacing: "-.07em", color: "var(--aubergine)" }}>{percent(score)}</div>
          <p className="muted" style={{ marginTop: "1rem" }}>{correct} of {attempt.questions.length} correct. {resultCopy(score)}</p>
          <div className="button-row"><Link className="button" href="/app/progress">Review progress <ArrowRight size={17} /></Link><Link className="button secondary" href={`/app/exams/${attempt.exam.id}`}>Back to exam</Link></div>
        </section>
        <aside className="panel">
          <p className="eyebrow">What to review next</p>
          {weakTopics(attempt.questions).map(([topic, misses]) => <div className="list-row row row-between" key={topic}><strong>{topic}</strong><span className="status failed">{misses} missed</span></div>)}
          {!weakTopics(attempt.questions).length && <p className="muted">No weak topic was identified in this attempt.</p>}
        </aside>
      </div>
      <section>
        <div className="section-head"><h2>Answer review</h2><span className="help">{attempt.questions.length} questions</span></div>
        <div className="panel">
          {attempt.questions.map((question, index) => (
            <article className="list-row" key={question.id} style={{ display: "block", paddingBlock: "1.25rem" }}>
              <div className="row"><span className="icon-tile" style={{ color: question.isCorrect ? "var(--sage)" : "var(--rust)" }}>{question.isCorrect ? <CheckCircle size={22} weight="fill" /> : <XCircle size={22} weight="fill" />}</span><div className="row-copy"><span className="help">Question {index + 1} · {question.topicLabel ?? "General"}</span><strong style={{ whiteSpace: "normal", marginTop: ".2rem" }}>{question.text}</strong></div></div>
              <div style={{ margin: ".9rem 0 0 3.5rem" }}><p className="help">Your answer</p><p>{question.userAnswer || "No answer"}</p>{!question.isCorrect && <><p className="help">Correct answer</p><p><strong>{question.correctAnswer}</strong></p></>}<p className="muted">{question.feedback ?? question.explanation}</p>{Array.isArray(question.sourceCitations) && question.sourceCitations.length > 0 && <details><summary className="help" style={{ cursor: "pointer" }}>View source support</summary><div className="notice" style={{ marginTop: ".6rem" }}>{(question.sourceCitations as Array<{ quote?: string }>).map((citation) => citation.quote).filter(Boolean).join(" · ")}</div></details>}</div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function resultCopy(score: number) {
  if (score >= 90) return "The material is holding well.";
  if (score >= 75) return "A focused review should close the remaining gaps.";
  return "Review the missed topics before trying another set.";
}

function weakTopics(questions: Array<{ isCorrect: boolean; topicLabel: string | null }>) {
  const counts = new Map<string, number>();
  questions.filter((question) => !question.isCorrect).forEach((question) => {
    const topic = question.topicLabel ?? "General";
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
}
