"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash, X } from "@phosphor-icons/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "./exams.module.css";

gsap.registerPlugin(useGSAP);

function motionDuration(duration: number) {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
}

export function ExamDeleteButton({ examId, examTitle, compact = false }: { examId: number; examTitle: string; compact?: boolean }) {
  const router = useRouter();
  const rootRef = useRef<HTMLSpanElement>(null);
  const confirmRef = useRef<HTMLSpanElement>(null);
  const cancelAction = useRef<() => void>(() => undefined);
  const removeAction = useRef<() => void>(() => undefined);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useGSAP((_context, contextSafe) => {
    if (!confirming || !confirmRef.current) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(confirmRef.current, { autoAlpha: 0, x: 10, scale: 0.96 }, {
        autoAlpha: 1, x: 0, scale: 1, duration: 0.26, ease: "back.out(1.5)", clearProps: "transform,opacity,visibility",
      });
    });
    cancelAction.current = contextSafe!(() => {
      if (!confirmRef.current) return setConfirming(false);
      gsap.to(confirmRef.current, {
        autoAlpha: 0, x: 8, scale: 0.97, duration: motionDuration(0.16), ease: "power2.in",
        onComplete: () => setConfirming(false),
      });
    });
    removeAction.current = contextSafe!(async () => {
      setPending(true);
      setError("");
      const response = await fetch(`/api/exams/${examId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error?.message ?? "Could not delete this exam.");
        setPending(false);
        gsap.fromTo(confirmRef.current, { x: -3 }, { x: 3, repeat: 3, yoyo: true, duration: motionDuration(0.055), clearProps: "transform" });
        return;
      }
      const item = rootRef.current?.closest("article");
      if (!item) return router.refresh();
      gsap.to(item, {
        autoAlpha: 0, x: 14, scale: 0.985, duration: motionDuration(0.28), ease: "power2.in",
        onComplete: () => router.refresh(),
      });
    });
    return () => {
      media.revert();
      cancelAction.current = () => undefined;
      removeAction.current = () => undefined;
    };
  }, { scope: rootRef, dependencies: [confirming, examId, router], revertOnUpdate: true });

  function cancel() { cancelAction.current(); }
  function remove() { removeAction.current(); }

  return (
    <span className={styles.deleteControlRoot} ref={rootRef}>
      {confirming ? (
        <span className={`${styles.deleteConfirm} ${compact ? styles.deleteConfirmCompact : ""}`} ref={confirmRef}>
          <span className={styles.srOnly}>Permanently delete {examTitle}?</span>
          <button type="button" className={styles.confirmDelete} disabled={pending} onClick={remove}>{pending ? "Deleting…" : "Delete permanently"}</button>
          <button type="button" className={styles.cancelDelete} disabled={pending} onClick={cancel} aria-label="Cancel removal"><X size={15} weight="bold" /></button>
          {error && <span className={styles.deleteError} role="alert">{error}</span>}
        </span>
      ) : (
        <button type="button" className={`${styles.deleteButton} ${compact ? styles.deleteButtonCompact : ""}`} onClick={() => setConfirming(true)} aria-label={`Remove ${examTitle}`}><Trash size={16} />{compact ? "Remove" : <span className={styles.srOnly}>Remove exam</span>}</button>
      )}
    </span>
  );
}

export function ClearFailedExams({ examIds }: { examIds: number[] }) {
  const router = useRouter();
  const rootRef = useRef<HTMLSpanElement>(null);
  const confirmRef = useRef<HTMLSpanElement>(null);
  const cancelAction = useRef<() => void>(() => undefined);
  const clearAction = useRef<() => void>(() => undefined);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useGSAP((_context, contextSafe) => {
    if (!confirming || !confirmRef.current) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(confirmRef.current, { autoAlpha: 0, y: -6, scale: 0.97 }, {
        autoAlpha: 1, y: 0, scale: 1, duration: 0.24, ease: "power3.out", clearProps: "transform,opacity,visibility",
      });
    });
    cancelAction.current = contextSafe!(() => {
      if (!confirmRef.current) return setConfirming(false);
      gsap.to(confirmRef.current, { autoAlpha: 0, y: -5, duration: motionDuration(0.15), ease: "power2.in", onComplete: () => setConfirming(false) });
    });
    clearAction.current = contextSafe!(async () => {
      setPending(true);
      setError("");
      const responses = await Promise.all(examIds.map((id) => fetch(`/api/exams/${id}`, { method: "DELETE" })));
      if (responses.some((response) => !response.ok)) {
        setError("Some failed exams could not be removed.");
        setPending(false);
        router.refresh();
        return;
      }
      const rows = rootRef.current?.closest("section")?.querySelectorAll("article");
      if (!rows?.length) return router.refresh();
      gsap.to(rows, {
        autoAlpha: 0, x: 18, scale: 0.99, duration: motionDuration(0.24), stagger: 0.045,
        ease: "power2.in", onComplete: () => router.refresh(),
      });
    });
    return () => {
      media.revert();
      cancelAction.current = () => undefined;
      clearAction.current = () => undefined;
    };
  }, { scope: rootRef, dependencies: [confirming, examIds, router], revertOnUpdate: true });

  function cancel() { cancelAction.current(); }
  function clear() { clearAction.current(); }

  return (
    <span className={styles.clearFailedControl} ref={rootRef}>
      {confirming ? <span className={styles.clearConfirm} ref={confirmRef}><button type="button" className={styles.confirmClear} disabled={pending} onClick={clear}>{pending ? "Deleting…" : `Delete all ${examIds.length}?`}</button><button type="button" className={styles.cancelClear} disabled={pending} onClick={cancel}>Cancel</button></span> : <button type="button" className={styles.clearFailedButton} onClick={() => setConfirming(true)}><Trash size={15} /> Clear failed</button>}
      {error && <span className={styles.clearError} role="alert">{error}</span>}
    </span>
  );
}
