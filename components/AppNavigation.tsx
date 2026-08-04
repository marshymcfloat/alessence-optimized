"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  BookOpenText,
  ChartLineUp,
  ClipboardText,
  House,
  NotePencil,
  SignOut,
} from "@phosphor-icons/react";
import { Brand } from "./Brand";
import styles from "./AppNavigation.module.css";

const items = [
  { href: "/app", label: "Home", icon: House, exact: true, tone: "purple" },
  { href: "/app/materials", label: "Materials", icon: BookOpenText, exact: false, tone: "blue" },
  { href: "/app/exams", label: "Exams", icon: ClipboardText, exact: false, tone: "coral" },
  { href: "/app/progress", label: "Progress", icon: ChartLineUp, exact: false, tone: "mint" },
] as const;

function NavLinks() {
  const pathname = usePathname();
  return items.map((item) => {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        className={`nav-link ${styles.navLink} ${styles[item.tone]} ${active ? `active ${styles.active}` : ""}`}
        href={item.href}
        aria-current={active ? "page" : undefined}
        key={item.href}
      >
        <span className={styles.iconWrap}><Icon size={20} weight={active ? "fill" : "regular"} aria-hidden="true" /></span>
        <span>{item.label}</span>
        <ArrowRight className={styles.linkArrow} size={15} weight="bold" aria-hidden="true" />
      </Link>
    );
  });
}

type AppNavigationProps = {
  user: { name: string; email: string };
};

export function AppNavigation({ user }: AppNavigationProps) {
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <>
      <aside className={`desktop-rail ${styles.rail}`}>
        <div className={styles.brandArea}>
          <Brand />
          <span>Study companion</span>
        </div>

        <Link className={styles.createCard} href="/app/exams/new">
          <span className={styles.createIcon}><NotePencil size={21} weight="duotone" /></span>
          <span><strong>Create an exam</strong><small>From your materials</small></span>
          <ArrowRight size={16} weight="bold" />
        </Link>

        <div className={styles.navGroup}>
          <p>Workspace</p>
          <nav aria-label="Primary"><NavLinks /></nav>
        </div>

        <div className={styles.account}>
          <span className={styles.avatar}>{initials(user.name)}</span>
          <span className={styles.accountCopy}><strong>{user.name}</strong><small>{user.email}</small></span>
          <button className={styles.signOut} type="button" onClick={signOut} aria-label="Sign out" title="Sign out">
            <SignOut size={18} />
          </button>
        </div>
      </aside>
      <nav className={`mobile-nav ${styles.mobileNav}`} aria-label="Primary"><NavLinks /></nav>
    </>
  );
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A";
}
