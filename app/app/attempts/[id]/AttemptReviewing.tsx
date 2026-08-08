"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import styles from "./attempt-reviewing.module.css";

export function AttemptReviewing({
  attemptId,
  initialStatus,
  examDescription,
  subjectTitle,
}: {
  attemptId: number;
  initialStatus: string;
  examDescription: string;
  subjectTitle: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (status !== "SUBMITTING") return;
    let active = true;
    let timer: number | undefined;
    let failures = 0;
    const check = async () => {
      if (document.visibilityState === "hidden") {
        timer = window.setTimeout(check, 5000);
        return;
      }
      try {
        const response = await fetch(`/api/attempts/${attemptId}`, { cache: "no-store" });
        if (!active) return;
        if (!response.ok) throw new Error("Unable to read review status");
        failures = 0;
        const data = await response.json();
        if (data.status === "COMPLETED") {
          router.refresh();
          return;
        }
        setStatus(data.status);
      } catch {
        failures += 1;
      }
      if (active) timer = window.setTimeout(check, Math.min(3000 * 2 ** failures, 15000));
    };
    void check();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [attemptId, router, status]);

  async function retry() {
    setRetrying(true);
    const response = await fetch(`/api/attempts/${attemptId}/review`, { method: "POST" });
    if (response.ok) setStatus("SUBMITTING");
    setRetrying(false);
  }

  return <AttemptLoadingShell status={status} examDescription={examDescription} subjectTitle={subjectTitle} retrying={retrying} onRetry={retry} />;
}

export function AttemptLoadingShell({
  status = "SUBMITTING",
  examDescription = "Preparing your exam results",
  subjectTitle = "Attempt submitted",
  retrying = false,
  onRetry,
}: {
  status?: string;
  examDescription?: string;
  subjectTitle?: string;
  retrying?: boolean;
  onRetry?: () => void;
}) {
  const failed = status === "SUBMISSION_FAILED";
  return (
    <main className={styles.page} aria-live="polite" aria-busy={!failed}>
      <section className={styles.statusCard}>
        <span className={failed ? styles.failedIcon : styles.reviewIcon}>{failed ? <WarningCircle size={28} weight="duotone" /> : <Brain size={28} weight="duotone" />}</span>
        <div>
          <p>{subjectTitle}</p>
          <h1>{failed ? "Review paused" : "Reviewing your answers"}</h1>
          <span>{failed ? "Your answers are safe. Restart the review when you are ready." : "Your exam is submitted. We are checking identification answers and preparing your feedback."}</span>
        </div>
        {failed ? <button type="button" disabled={retrying} onClick={onRetry}>{retrying ? "Restarting…" : "Retry review"}</button> : <strong><i /><i /><i /> Reviewing</strong>}
      </section>

      <section className={styles.preview} aria-label="Loading results">
        <div className={styles.heroBone}><span /><span /><span /><small>{examDescription}</small></div>
        <div className={styles.summaryBones}><span /><span /></div>
      </section>

      <section className={styles.answerPreview}>
        <div><CheckCircle size={18} weight="duotone" /><span>Scoring responses</span></div>
        <div className={styles.answerGrid}>{[0, 1, 2, 3].map((item) => <article key={item}><span /><strong /><i /><i /></article>)}</div>
      </section>
    </main>
  );
}
