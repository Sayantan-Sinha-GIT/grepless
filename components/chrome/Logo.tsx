// The mark: a lens over two "approximately equal" waves — search by meaning, not exact match.
export function LogoMark({ size = 30, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="gl-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-hi)" />
          <stop offset="1" stopColor="var(--brand)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#gl-mark)" />
      <circle cx="28" cy="28" r="13" fill="none" stroke="var(--on-brand)" strokeWidth="5" />
      <path d="M38 38 49 49" stroke="var(--on-brand)" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M21 25.5c2.3-2.2 4.7-2.2 7 0s4.7 2.2 7 0M21 31.5c2.3-2.2 4.7-2.2 7 0s4.7 2.2 7 0"
        fill="none"
        stroke="var(--lime)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-display font-semibold tracking-tight ${className}`}>grepless</span>;
}
