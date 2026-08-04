import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { BookOpenText, Check, LockKey } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/features/auth/session";
import { Brand } from "@/components/Brand";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  let authenticated = false;
  try {
    await requireUser();
    authenticated = true;
  } catch {}
  if (authenticated) redirect("/app");

  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.intro}>
        <div className={styles.brandRow}><Brand /><span><LockKey size={14} weight="fill" /> Private workspace</span></div>
        <div className={styles.introCopy}>
          <p className={styles.kicker}><BookOpenText size={16} weight="fill" /> Your personal study space</p>
          <h1>Turn your readings into focused practice.</h1>
          <p>Build exams from material you trust, review weak topics, and keep every study session in one quiet place.</p>
          <div className={styles.features} aria-label="Workspace features">
            <span><Check size={14} weight="bold" /> Source-grounded questions</span>
            <span><Check size={14} weight="bold" /> Personal progress</span>
          </div>
        </div>
        <div className={styles.mascot} aria-hidden="true">
          <Image src="/mascots/greet-mascot.png" alt="" width={378} height={675} priority />
        </div>
        <p className={styles.sideNote}>A study workspace made for one learner.</p>
      </section>

      <section className={styles.formSide}>
        <div className={styles.formCard}>
          <div className={styles.formHeading}><span>Welcome back</span><h2>Continue where you left off.</h2><p>Sign in with the account connected to this workspace.</p></div>
          <LoginForm />
          <p className={styles.privateNote}><LockKey size={14} /> Registration is disabled. Only the configured account can sign in.</p>
        </div>
      </section>
    </main>
  );
}
