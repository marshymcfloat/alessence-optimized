import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, Brain, FileArrowUp, Lightning,
  NotePencil, Target,
} from "@phosphor-icons/react/dist/ssr";
import {
  DashboardGreeting, FocusExamContent, FocusExamState, LatestResult,
  ProgressSnapshot, RecentMaterials, ReviewRecommendation, WelcomeStudyAction,
} from "./DashboardDynamic";
import {
  FocusContentSkeleton, FocusStateSkeleton, GreetingSkeleton, LatestResultSkeleton,
  MaterialsSkeleton, ProgressSkeleton, ReviewSkeleton, WelcomeActionSkeleton,
} from "./DashboardSkeletons";
import { DashboardMotion } from "./DashboardMotion";
import styles from "./dashboard.module.css";

export default function HomePage() {
  return (
    <DashboardMotion className={styles.dashboard}>
      <header className={styles.topbar} data-dashboard-section>
        <div>
          <p className={styles.kicker}>{formattedDate()}</p>
          <Suspense fallback={<GreetingSkeleton />}><DashboardGreeting /></Suspense>
        </div>
        <Link className={styles.newExam} href="/app/exams/new"><NotePencil size={19} weight="bold" /><span>New exam</span></Link>
      </header>

      <section className={styles.welcome} aria-labelledby="welcome-title" data-dashboard-section>
        <div className={styles.welcomeCopy}>
          <span className={styles.welcomeBadge}><Lightning size={15} weight="fill" /> Your study space</span>
          <h2 id="welcome-title">Let’s make today’s study session count.</h2>
          <Suspense fallback={<WelcomeActionSkeleton />}><WelcomeStudyAction /></Suspense>
        </div>
        <div className={styles.welcomeArt} aria-hidden="true"><span className={styles.artDotOne} /><span className={styles.artDotTwo} /><Image src="/mascots/greet-mascot-exam-style-v2.png" alt="" width={1024} height={1536} priority sizes="(max-width: 420px) 171px, (max-width: 900px) 29vw, 312px" /></div>
      </section>

      <section className={styles.quickSection} aria-labelledby="quick-title" data-dashboard-section>
        <div className={styles.sectionTitle}><div><span>Pick one thing</span><h2 id="quick-title">Start learning</h2></div></div>
        <div className={styles.quickGrid}>
          <Link className={`${styles.quickCard} ${styles.quickCoral}`} href="/app/exams/new"><span className={styles.quickIcon}><NotePencil size={24} weight="duotone" /></span><span><strong>Generate an exam</strong><small>Build from your sources</small></span><ArrowRight className={styles.quickArrow} size={19} weight="bold" /></Link>
          <Link className={`${styles.quickCard} ${styles.quickBlue}`} href="/app/exams/quiz"><span className={styles.quickIcon}><Brain size={24} weight="duotone" /></span><span><strong>Quick practice</strong><small>Five adaptive questions</small></span><ArrowRight className={styles.quickArrow} size={19} weight="bold" /></Link>
          <Link className={`${styles.quickCard} ${styles.quickMint}`} href="/app/materials"><span className={styles.quickIcon}><FileArrowUp size={24} weight="duotone" /></span><span><strong>Add material</strong><small>PDF, DOCX, or text</small></span><ArrowRight className={styles.quickArrow} size={19} weight="bold" /></Link>
        </div>
      </section>

      <div className={styles.contentGrid} data-dashboard-section>
        <main className={styles.mainColumn}>
          <section className={styles.focusCard} aria-labelledby="focus-title">
            <div className={styles.focusTopline}><span><Target size={17} weight="fill" /> Recommended next</span><Suspense fallback={<FocusStateSkeleton />}><FocusExamState /></Suspense></div>
            <div className={styles.focusBody}>
              <Suspense fallback={<FocusContentSkeleton />}><FocusExamContent /></Suspense>
              <div className={styles.focusMascot} aria-hidden="true"><Image src="/mascots/welcome-mascot-v4.png" alt="" width={941} height={1672} sizes="(max-width: 680px) 107px, (max-width: 900px) 160px, 184px" /></div>
            </div>
          </section>

          <section aria-labelledby="materials-title">
            <div className={styles.sectionTitle}><div><span>Your library</span><h2 id="materials-title">Recent materials</h2></div><Link href="/app/materials">View all <ArrowRight size={15} /></Link></div>
            <div className={styles.materialList}><Suspense fallback={<MaterialsSkeleton />}><RecentMaterials /></Suspense></div>
          </section>
        </main>

        <aside className={styles.sideColumn} aria-label="Study overview">
          <section className={styles.progressCard}>
            <div className={styles.sectionTitle}><div><span>Your progress</span><h2>Study snapshot</h2></div><Link href="/app/progress" aria-label="View progress"><ArrowRight size={17} /></Link></div>
            <Suspense fallback={<ProgressSkeleton />}><ProgressSnapshot /></Suspense>
          </section>

          <section className={styles.reviewCard}>
            <span className={styles.reviewIcon}><Brain size={24} weight="duotone" /></span>
            <Suspense fallback={<ReviewSkeleton />}><ReviewRecommendation /></Suspense>
          </section>

          <Suspense fallback={<LatestResultSkeleton />}><LatestResult /></Suspense>
        </aside>
      </div>
    </DashboardMotion>
  );
}

function formattedDate() { return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date()); }
