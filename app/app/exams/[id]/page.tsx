import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpenText, Clock, FileText, Question, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { requirePageUser } from "@/features/auth/page-session";
import { getExam } from "@/features/exams/service";
import { db } from "@/lib/db";
import { ExamDetailActions } from "./ExamDetailActions";
import styles from "./exam-detail.module.css";

export const metadata: Metadata = { title: "Exam details" };

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const examId = Number(id);
  const [exam, generation] = await Promise.all([
    getExam(examId, user.id),
    db.examGeneration.findFirst({
      where: { examId, exam: { userId: user.id } },
      orderBy: { version: "desc" },
      select: { status: true, progress: true, failureCode: true, failureMessage: true, groundingMode: true },
    }),
  ]);
  const sourceGrounded = generation?.groundingMode === "SOURCES";

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href="/app/exams"><ArrowLeft size={16} weight="bold" /> Exam library</Link>

      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <p>{exam.subject.title}</p>
          <h1>{exam.description}</h1>
        </div>
        <div className={styles.meta} aria-label="Exam details">
          <span><Question size={17} /><b>{exam.requestedItems}</b> questions</span>
          <span><Clock size={17} /><b>{exam.timeLimit ?? "No"}</b> {exam.timeLimit ? "minutes" : "time limit"}</span>
          <span><ShieldCheck size={17} />{exam.isPracticeMode ? "Practice mode" : "Single attempt"}</span>
        </div>
      </header>

      <div className={styles.contentGrid}>
        <ExamDetailActions examId={exam.id} initialStatus={exam.status} initialGeneration={generation} />

        <aside className={styles.sources}>
          <div className={styles.sourcesHead}>
            <span><BookOpenText size={20} weight="duotone" /></span>
            <div><p>Question grounding</p><h2>{sourceGrounded ? "Your selected readings" : "Model knowledge"}</h2></div>
          </div>
          <p className={styles.sourceNote}>{sourceGrounded ? "Questions are checked against the materials below." : "No source files were attached to this exam."}</p>
          {exam.sourceFiles.length > 0 && (
            <div className={styles.sourceList}>
              {exam.sourceFiles.map((file) => (
                <div className={styles.sourceRow} key={file.id}>
                  <span><FileText size={18} /></span><strong>{file.name}</strong>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {exam.status === "READY" && (
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
      )}
    </div>
  );
}

function formatLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}
