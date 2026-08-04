"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, EnvelopeSimple, Eye, EyeSlash, LockSimple } from "@phosphor-icons/react";
import styles from "./login.module.css";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Sign in failed.");
      router.replace("/app");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign in failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={styles.form}>
      <label className={styles.field} htmlFor="email">
        <span>Email address</span>
        <div className={styles.inputControl}><EnvelopeSimple size={19} /><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required autoFocus /></div>
      </label>
      <label className={styles.field} htmlFor="password">
        <span>Password</span>
        <div className={styles.inputControl}><LockSimple size={19} /><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}</button></div>
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.submit} disabled={pending}>{pending ? "Signing in…" : "Sign in"}<ArrowRight size={18} weight="bold" /></button>
    </form>
  );
}
