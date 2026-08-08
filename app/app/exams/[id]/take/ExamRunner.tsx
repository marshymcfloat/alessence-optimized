"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookmarkSimple, Check, Clock, PaperPlaneTilt, X } from "@phosphor-icons/react";
import styles from "./exam-runner.module.css";

type Question = { id: number; slot: number; text: string; type: string; options: unknown; calculationMetadata?: { unit?: string | null; roundingInstruction?: string } | null };
type Attempt = { id: number; startedAt: string; exam: { id: number; title: string; description: string; timeLimit: number | null; questions: Question[] } };

export function ExamRunner({ attempt }: { attempt: Attempt }) {
  const router = useRouter();
  const questionMapRef = useRef<HTMLDivElement>(null);
  const storageKey = `alessence-attempt-${attempt.id}`;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>(() => loadDraft(storageKey).answers);
  const [flagged, setFlagged] = useState<number[]>(() => loadDraft(storageKey).flagged);
  const [remaining, setRemaining] = useState<number | null>(() => attempt.exam.timeLimit
    ? Math.max(0, attempt.exam.timeLimit * 60 - Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000))
    : null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const question = attempt.exam.questions[index]!;
  const options = Array.isArray(question?.options) ? question.options.map(String) : [];
  const answered = useMemo(() => Object.values(answers).filter((value) => value.trim()).length, [answers]);
  const completion = Math.round((answered / attempt.exam.questions.length) * 100);
  const isFlagged = flagged.includes(question.id);

  useEffect(() => {
    document.body.classList.add("exam-mode");
    router.prefetch(`/app/attempts/${attempt.id}`);
    return () => document.body.classList.remove("exam-mode");
  }, [attempt.id, router]);
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ answers, flagged }));
  }, [answers, flagged, storageKey]);
  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const timer = window.setInterval(() => setRemaining((value) => value === null ? null : Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [remaining]);
  useEffect(() => {
    const map = questionMapRef.current;
    const active = map?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!map || !active || map.scrollWidth <= map.clientWidth) return;

    map.scrollTo({
      left: active.offsetLeft - (map.clientWidth - active.offsetWidth) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [index]);

  function answer(value: string) {
    setAnswers((current) => ({ ...current, [question.id]: value }));
  }
  function toggleFlag() {
    setFlagged((current) => current.includes(question.id) ? current.filter((id) => id !== question.id) : [...current, question.id]);
  }
  function goTo(nextIndex: number) {
    setIndex(nextIndex);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function submit() {
    setPending(true);
    setError("");
    const response = await fetch(`/api/exams/${attempt.exam.id}/attempts/${attempt.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: Object.entries(answers).map(([questionId, userAnswer]) => ({ questionId: Number(questionId), userAnswer })) }),
    });
    const data = await response.json();
    if (!response.ok) {
      setPending(false);
      setConfirming(false);
      setError(data.error?.message ?? "Could not submit the exam.");
      return;
    }
    localStorage.removeItem(storageKey);
    router.replace(`/app/attempts/${attempt.id}`);
  }

  return (
    <div className={styles.runner}>
      <header className={styles.topbar}>
        <button className={styles.leaveButton} onClick={() => router.push(`/app/exams/${attempt.exam.id}`)}><ArrowLeft size={17} weight="bold" /> Leave exam</button>
        <div className={styles.examIdentity}><span>In progress</span><strong>{attempt.exam.title}</strong></div>
        {remaining !== null ? <div className={`${styles.timer} ${remaining <= 300 ? styles.timerUrgent : ""}`}><Clock size={17} /><span>{formatTime(remaining)}</span></div> : <span className={styles.untimed}><Clock size={16} /> Untimed</span>}
      </header>

      <div className={styles.progressHeader}>
        <div><span>{answered} answered</span><span>{attempt.exam.questions.length - answered} remaining</span></div>
        <div className={styles.progressTrack} aria-label={`${completion}% answered`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}><span style={{ width: `${completion}%` }} /></div>
      </div>

      <main className={styles.workspace}>
        <section className={styles.questionArea} aria-labelledby="question-title">
          <div className={styles.questionMeta}>
            <span>Question {index + 1} of {attempt.exam.questions.length}</span>
            <button className={isFlagged ? styles.flaggedButton : styles.flagButton} onClick={toggleFlag}><BookmarkSimple size={17} weight={isFlagged ? "fill" : "regular"} />{isFlagged ? "Flagged" : "Flag for review"}</button>
          </div>

          <article className={styles.questionCard}>
            <p>{formatLabel(question.type)}</p>
            <h1 id="question-title">{question.text}</h1>
            {question.type === "IDENTIFICATION" || question.type === "NUMERIC" ? (
              <label className={styles.textAnswer} htmlFor="identification-answer">
                <span>Your answer</span>
                {question.type === "NUMERIC"
                  ? <input id="identification-answer" name={`exam-answer-${attempt.id}-${question.id}`} type="text" inputMode="decimal" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} data-1p-ignore data-lpignore="true" value={answers[question.id] ?? ""} onChange={(event) => answer(event.target.value)} placeholder={question.calculationMetadata?.unit ? `Enter value in ${question.calculationMetadata.unit}` : "Enter the calculated value"} autoFocus />
                  : <textarea id="identification-answer" name={`exam-answer-${attempt.id}-${question.id}`} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} data-1p-ignore data-lpignore="true" value={answers[question.id] ?? ""} onChange={(event) => answer(event.target.value)} placeholder="Type your answer here" autoFocus />}
                {question.type === "NUMERIC" && question.calculationMetadata?.roundingInstruction && <small>{question.calculationMetadata.roundingInstruction}</small>}
              </label>
            ) : (
              <div className={styles.options} role="group" aria-label="Answer choices">
                {options.map((option, optionIndex) => {
                  const selected = answers[question.id] === option;
                  return <button className={selected ? styles.selectedOption : styles.option} type="button" key={option} aria-pressed={selected} onClick={() => answer(option)}><span>{selected ? <Check size={17} weight="bold" /> : String.fromCharCode(65 + optionIndex)}</span><strong>{option}</strong></button>;
                })}
              </div>
            )}
          </article>

          {error && <p className={styles.error} role="alert">{error}</p>}
          <nav className={styles.questionActions} aria-label="Question navigation">
            <button disabled={index === 0} onClick={() => goTo(index - 1)}><ArrowLeft size={17} weight="bold" /> Previous</button>
            {index < attempt.exam.questions.length - 1
              ? <button className={styles.nextButton} onClick={() => goTo(index + 1)}>Next question <ArrowRight size={17} weight="bold" /></button>
              : <button className={styles.submitButton} onClick={() => setConfirming(true)}><PaperPlaneTilt size={17} weight="fill" /> Review and submit</button>}
          </nav>
        </section>

        <aside className={styles.navigator}>
          <div className={styles.navigatorHead}><div><span>Question map</span><strong>Your progress</strong></div><b>{completion}%</b></div>
          <div className={styles.questionMap} ref={questionMapRef}>
            {attempt.exam.questions.map((item, itemIndex) => {
              const hasAnswer = Boolean(answers[item.id]?.trim());
              const hasFlag = flagged.includes(item.id);
              return <button key={item.id} className={`${itemIndex === index ? styles.currentQuestion : ""} ${hasAnswer ? styles.answeredQuestion : ""}`} aria-label={`Question ${itemIndex + 1}${hasAnswer ? ", answered" : ""}${hasFlag ? ", flagged" : ""}`} aria-current={itemIndex === index ? "step" : undefined} onClick={() => goTo(itemIndex)}>{itemIndex + 1}{hasFlag && <span />}</button>;
            })}
          </div>
          <div className={styles.legend}><span><i />Answered</span><span><i />Current</span><span><i />Flagged</span></div>
          <button className={styles.reviewButton} onClick={() => setConfirming(true)}><PaperPlaneTilt size={17} /> Review and submit</button>
        </aside>
      </main>

      {confirming && (
        <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => !pending && event.target === event.currentTarget && setConfirming(false)}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="submit-title">
            <button className={styles.closeDialog} aria-label="Close submission review" disabled={pending} onClick={() => setConfirming(false)}><X size={18} /></button>
            <span className={styles.dialogIcon}><PaperPlaneTilt size={22} weight="duotone" /></span>
            <p>Submission check</p><h2 id="submit-title">Ready to finish?</h2>
            <div className={styles.submitSummary}><span><b>{answered}</b> answered</span><span><b>{attempt.exam.questions.length - answered}</b> unanswered</span><span><b>{flagged.length}</b> flagged</span></div>
            <p className={styles.dialogCopy}>Unanswered questions will be marked incorrect. You cannot change answers after submitting.</p>
            <div className={styles.dialogActions}><button disabled={pending} onClick={() => setConfirming(false)}>Keep reviewing</button><button disabled={pending} onClick={submit}>{pending ? "Sending answers…" : "Submit exam"}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function loadDraft(key: string): { answers: Record<number, string>; flagged: number[] } {
  if (typeof window === "undefined") return { answers: {}, flagged: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "{}");
    return { answers: parsed.answers ?? {}, flagged: Array.isArray(parsed.flagged) ? parsed.flagged : [] };
  } catch {
    return { answers: {}, flagged: [] };
  }
}
