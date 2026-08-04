import Link from "next/link";
import {
  ArrowRight, BookOpenText, ChartLineUp, CheckCircle,
  Clock, FileArrowUp, FileText,
} from "@phosphor-icons/react/dist/ssr";
import { requirePageUser } from "@/features/auth/page-session";
import { percent } from "@/lib/format";
import { dashboardExams, dashboardMaterials, dashboardProgress } from "./dashboard-data";
import { DashboardReveal } from "./DashboardMotion";
import styles from "./dashboard.module.css";

function activeExamFrom(exams: Awaited<ReturnType<typeof dashboardExams>>) {
  const ready = exams.find((exam) => exam.status === "READY");
  return { ready, active: ready ?? exams.find((exam) => exam.status === "GENERATING") ?? exams[0] };
}

export async function DashboardGreeting() {
  const user = await requirePageUser();
  return <DashboardReveal className={styles.greetingReveal}><h1>Good {daypart()}, {firstName(user.name)}</h1></DashboardReveal>;
}

export async function WelcomeStudyAction() {
  const { ready, active } = activeExamFrom(await dashboardExams());
  return (
    <DashboardReveal className={styles.welcomeDynamic}>
      <p>{active ? "Your next focused session is ready when you are." : "Add a source, create an exam, and start with one useful question."}</p>
      <Link className={styles.primaryAction} href={active ? `/app/exams/${active.id}` : "/app/exams/new"}>
        {ready ? "Continue studying" : active?.status === "GENERATING" ? "View generation" : "Create your first exam"}
        <ArrowRight size={18} weight="bold" />
      </Link>
    </DashboardReveal>
  );
}

export async function FocusExamState() {
  const { active } = activeExamFrom(await dashboardExams());
  return active ? <DashboardReveal className={styles.stateReveal}><span className={styles.state}>{active.status.toLowerCase()}</span></DashboardReveal> : null;
}

export async function FocusExamContent() {
  const { ready, active } = activeExamFrom(await dashboardExams());
  return (
    <DashboardReveal className={styles.focusCopy}>
      <p>{active?.subject.title ?? "Your first subject"}</p>
      <h2 id="focus-title">{active?.description ?? "Create a focused exam from material you trust"}</h2>
      <div className={styles.examMeta}>
        <span><BookOpenText size={17} /> {active ? `${active.requestedItems} questions` : "Source grounded"}</span>
        <span><Clock size={17} /> {active?.timeLimit ? `${active.timeLimit} min` : "Your own pace"}</span>
      </div>
      <Link className={styles.focusButton} href={active ? `/app/exams/${active.id}` : "/app/exams/new"}>
        {ready ? "Open exam" : active ? "Check progress" : "Set up exam"} <ArrowRight size={18} weight="bold" />
      </Link>
    </DashboardReveal>
  );
}

export async function RecentMaterials() {
  const materials = await dashboardMaterials();
  return (
    <DashboardReveal className={styles.materialRowsReveal}>
      {materials.slice(0, 4).map((material, index) => (
        <div className={styles.materialRow} key={material.id}>
          <span className={`${styles.fileIcon} ${styles[`fileTone${index % 4}`]}`}><FileText size={22} weight="duotone" /></span>
          <span className={styles.materialCopy}><strong>{material.name}</strong><small>{material.subject?.title ?? "No subject"} · {material.type}</small></span>
          <span className={`${styles.materialStatus} ${material.ingestionStatus === "READY" ? styles.ready : ""}`}>
            {material.ingestionStatus === "READY" && <CheckCircle size={14} weight="fill" />}{material.ingestionStatus.toLowerCase()}
          </span>
        </div>
      ))}
      {!materials.length && <div className={styles.emptyMaterials}><FileArrowUp size={29} weight="duotone" /><div><strong>Your library is empty</strong><span>Upload a reading to ground your first exam.</span></div><Link href="/app/materials">Add material</Link></div>}
    </DashboardReveal>
  );
}

export async function ProgressSnapshot() {
  const progress = await dashboardProgress();
  return (
    <DashboardReveal>
      <div className={styles.scoreFeature}><div className={styles.scoreNumber}><strong>{percent(progress.averageScore)}</strong><span>average score</span></div><ChartLineUp size={38} weight="duotone" /></div>
      <div className={styles.statGrid}>
        <div><strong>{progress.completedAttempts}</strong><span>Completed</span></div>
        <div><strong>{progress.readyExams}</strong><span>Ready exams</span></div>
        <div><strong>{progress.materialCount}</strong><span>Materials</span></div>
        <div><strong>{progress.examCount}</strong><span>Total exams</span></div>
      </div>
    </DashboardReveal>
  );
}

export async function ReviewRecommendation() {
  const weakTopic = (await dashboardProgress()).weakTopics[0];
  return (
    <DashboardReveal className={styles.reviewDynamic}>
      <p>{weakTopic ? "Worth another look" : "Build your study map"}</p>
      <h2>{weakTopic?.topic ?? "Complete an exam to uncover your focus areas"}</h2>
      <span>{weakTopic ? `${weakTopic.misses} missed ${weakTopic.misses === 1 ? "question" : "questions"}` : "Recommendations will appear here."}</span>
      <Link href={weakTopic ? "/app/exams/quiz" : "/app/exams/new"}>{weakTopic ? "Practice this area" : "Start an exam"} <ArrowRight size={16} weight="bold" /></Link>
    </DashboardReveal>
  );
}

export async function LatestResult() {
  const recent = (await dashboardProgress()).recentAttempts[0];
  if (!recent) return null;
  return (
    <DashboardReveal>
      <Link className={styles.lastResult} href={`/app/attempts/${recent.id}`}>
        <span><CheckCircle size={22} weight="duotone" /></span>
        <div><small>Latest result</small><strong>{recent.examTitle}</strong><em>{recent.subjectTitle}</em></div>
        <b>{percent(recent.score)}</b>
      </Link>
    </DashboardReveal>
  );
}

function firstName(name: string) { return name.trim().split(/\s+/)[0] || "Scholar"; }
function daypart() { const hour = new Date().getHours(); return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"; }
