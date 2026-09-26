export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--accent)" />
      <circle cx="28" cy="28" r="14" fill="none" stroke="var(--accent-ink)" strokeWidth="5" />
      <path d="M38.5 38.5 50 50" stroke="var(--accent-ink)" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M20.5 25.5c2.5-2.4 5-2.4 7.5 0s5 2.4 7.5 0M20.5 32c2.5-2.4 5-2.4 7.5 0s5 2.4 7.5 0"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
