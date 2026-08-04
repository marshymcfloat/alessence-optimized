"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Brain, Check, CheckCircle, ClipboardText, Target, XCircle } from "@phosphor-icons/react";
import { percent } from "@/lib/format";
import styles from "./quiz.module.css";

type Quiz = {
  questions: Array<{ id: number; text: string; type: string; options: unknown; topicLabel: string | null }>;
  weakCount: number;
  totalAvailable: number;
};
type QuizResult = { score: number; results: Array<{ questionId: number; isCorrect: boolean; correctAnswer: string; explanation: string | null }> };

export function AdaptiveQuiz({ quiz }: { quiz: Quiz }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const answered = useMemo(() => Object.values(answers).filter((value) => value.trim()).length, [answers]);

  async function submit() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/exams/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: quiz.questions.map((question) => ({ questionId: question.id, userAnswer: answers[question.id] ?? "" })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Could not check your answers.");
      setResult(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not check your answers.");
    } finally {
      setPending(false);
    }
  }

  if (!quiz.questions.length) {
    return (
      <div className={styles.page}>
        <header className={styles.header}><div><p>Adaptive practice</p><h1>Quick review</h1><span>Your review set will be built from completed exams.</span></div></header>
        <section className={styles.emptyState}><span><Brain size={34} weight="duotone" /></span><p>No quiz pool yet</p><h2>Complete an exam to unlock focused review.</h2><small>Alessence will prioritize concepts that need another pass.</small><Link href="/app/exams/new">Create an exam <ArrowRight size={17} weight="bold" /></Link></section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href="/app/progress"><ArrowLeft size={16} weight="bold" /> Progress</Link>
      <header className={styles.header}>
        <div><p>Adaptive practice</p><h1>Quick review</h1><span>Five focused questions shaped by your recent mistakes.</span></div>
        <div className={styles.headerStats} aria-label="Quiz summary">
          <div><strong>{quiz.questions.length}</strong><span>Questions</span></div>
          <div><strong>{quiz.weakCount}</strong><span>From mistakes</span></div>
          <div><strong>{answered}</strong><span>Answered</span></div>
        </div>
      </header>

      {result && (
        <section className={`${styles.resultBanner} ${result.score >= 70 ? styles.resultGood : styles.resultReview}`}>
          <span>{result.score >= 70 ? <CheckCircle size={25} weight="duotone" /> : <Target size={25} weight="duotone" />}</span>
          <div><p>Review complete</p><h2>{result.score >= 70 ? "A strong pass." : "A few ideas need another look."}</h2></div>
          <strong>{percent(result.score)}</strong>
        </section>
      )}

      <section className={styles.quizList} aria-label="Adaptive quiz questions">
        {quiz.questions.map((question, index) => {
          const options = Array.isArray(question.options) ? question.options.map(String) : [];
          const graded = result?.results.find((item) => item.questionId === question.id);
          return (
            <article className={`${styles.questionCard} ${styles[`tone${index % 4}`]}`} key={question.id}>
              <div className={styles.questionHead}>
                <span className={styles.questionNumber}>{String(index + 1).padStart(2, "0")}</span>
                <div><p>{question.topicLabel ?? "General coverage"}</p><small>{formatLabel(question.type)}</small></div>
                {graded && <span className={graded.isCorrect ? styles.correctMark : styles.wrongMark}>{graded.isCorrect ? <CheckCircle size={22} weight="fill" /> : <XCircle size={22} weight="fill" />}</span>}
              </div>
              <h2>{question.text}</h2>
              {question.type === "IDENTIFICATION" ? (
                <label className={styles.textField}><span>Your answer</span><input value={answers[question.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} disabled={Boolean(result)} placeholder="Type your answer" /></label>
              ) : (
                <div className={styles.options} role="group" aria-label={`Answer choices for question ${index + 1}`}>
                  {options.map((option, optionIndex) => {
                    const selected = answers[question.id] === option;
                    return <button className={selected ? styles.selectedOption : styles.option} key={option} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))} disabled={Boolean(result)} aria-pressed={selected}><span>{selected ? <Check size={16} weight="bold" /> : String.fromCharCode(65 + optionIndex)}</span><strong>{option}</strong></button>;
                  })}
                </div>
              )}
              {graded && !graded.isCorrect && <div className={styles.correction}><span>Correct answer</span><strong>{graded.correctAnswer}</strong>{graded.explanation && <p>{graded.explanation}</p>}</div>}
            </article>
          );
        })}
      </section>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {!result ? (
        <div className={styles.submitBar}><div><span>{answered} of {quiz.questions.length} answered</span><div><i style={{ width: `${(answered / quiz.questions.length) * 100}%` }} /></div></div><button disabled={pending} onClick={submit}>{pending ? "Checking answers…" : "Check answers"}<ArrowRight size={17} weight="bold" /></button></div>
      ) : (
        <div className={styles.finishedActions}><Link href="/app/progress"><ClipboardText size={17} /> Return to progress</Link><Link href="/app/exams/quiz">Try another review <ArrowRight size={17} /></Link></div>
      )}
    </div>
  );
}

function formatLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}
