export function BotanicalBook() {
  return (
    <svg width="112" height="84" viewBox="0 0 112 84" fill="none" aria-hidden="true">
      <path d="M15 62c17-5 29-4 41 5 12-9 24-10 41-5V20c-16-4-29-1-41 8-12-9-25-12-41-8v42Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M56 28v39M79 49c1-14-4-25-15-34M75 37c8-2 13-7 16-14M72 29c-4-8-3-15 2-22M78 49c8 2 14 7 18 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <BotanicalBook />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
