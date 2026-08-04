"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel" role="alert">
      <p className="eyebrow">Connection interrupted</p>
      <h1>We couldn’t load this page.</h1>
      <p className="muted">Check your connection and try again.</p>
      <button className="button" onClick={reset}>Try again</button>
    </div>
  );
}
