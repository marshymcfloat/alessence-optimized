"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowClockwise, Check, HourglassMedium, WarningCircle } from "@phosphor-icons/react";
import styles from "./exam-detail.module.css";

type Generation = {
  status: string;
  progress: number;
  failureCode: string | null;
  failureMessage: string | null;
  groundingMode: string;
} | null;

export function ExamDetailActions({ examId, initialStatus, initialGeneration }: { examId: number; initialStatus: string; initialGeneration: Generation }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [generation, setGeneration] = useState(initialGeneration);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "GENERATING") return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/exams/${examId}/status`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setStatus(data.status);
      setGeneration(data.generations?.[0] ?? null);
      if (data.status !== "GENERATING") router.refresh();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [examId, router, status]);

  async function start() {
    setPending(true);
    setError("");
    const response = await fetch(`/api/exams/${examId}/attempts`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setPending(false);
      setError(data.error?.message ?? "Could not start the exam.");
      return;
    }
    router.push(`/app/exams/${examId}/take?attempt=${data.attemptId}`);
  }

  async function retry() {
    setPending(true);
    setError("");
    const response = await fetch(`/api/exams/${examId}/retry`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setPending(false);
      setError(data.error?.message ?? "Could not retry generation.");
      return;
    }
    setStatus("GENERATING");
    setGeneration({ status: "QUEUED", progress: 0, failureCode: null, failureMessage: null, groundingMode: generation?.groundingMode ?? "SOURCES" });
    setPending(false);
  }

  const progress = generation?.progress ?? 0;
  const stage = generation?.status?.toLowerCase().replaceAll("_", " ") ?? "queued";

  return (
    <section className={`${styles.actionPanel} ${styles[`state${status}`]}`} aria-live="polite">
      {status === "GENERATING" && (
        <>
          <div className={styles.stateHeading}>
            <span><HourglassMedium size={22} weight="duotone" /></span>
            <div><p>Preparing your exam</p><h2>Building questions from your brief</h2></div>
            <strong>{progress}%</strong>
          </div>
          <p className={styles.stateCopy}>You can return to the exam library. Generation will continue safely in the background.</p>
          <div className={styles.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.progressMeta}><span>{stage}</span><span>{progress < 100 ? "Keep this tab open or come back later" : "Finishing checks"}</span></div>
        </>
      )}

      {status === "READY" && (
        <>
          <div className={styles.readyMark}><Check size={20} weight="bold" /></div>
          <p className={styles.readyEyebrow}>Ready to study</p>
          <h2>Start when you can give it your full attention.</h2>
          <p className={styles.readyCopy}>Your answers are saved when you submit. You can resume an unfinished attempt from this page.</p>
          <button className={styles.startButton} disabled={pending} onClick={start}>{pending ? "Opening exam…" : "Start or resume"}<ArrowRight size={18} weight="bold" /></button>
        </>
      )}

      {status === "FAILED" && (
        <>
          <div className={styles.stateHeading}>
            <span><WarningCircle size={22} weight="duotone" /></span>
            <div><p>Generation stopped</p><h2>This exam needs another attempt</h2></div>
          </div>
          <p className={styles.stateCopy}>{generation?.failureMessage ?? "The generator stopped before it produced enough valid questions."}</p>
          {generation?.failureCode && <p className={styles.failureCode}>Reference: {generation.failureCode.toLowerCase().replaceAll("_", " ")}</p>}
          <button className={styles.retryButton} disabled={pending} onClick={retry}><ArrowClockwise size={18} weight="bold" />{pending ? "Retrying…" : "Retry generation"}</button>
        </>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}
