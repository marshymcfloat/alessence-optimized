export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  return (
    <span className={`status status-${normalized}`}>
      <span className="dot" aria-hidden="true" />
      {normalized.charAt(0).toUpperCase() + normalized.slice(1)}
    </span>
  );
}
