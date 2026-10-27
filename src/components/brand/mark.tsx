export function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="none" stroke="currentColor" strokeOpacity="0.45" />
      <path d="M9 8v16M23 8v16M9 8h14" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="16" cy="17" r="1.6" fill="currentColor" />
    </svg>
  );
}
