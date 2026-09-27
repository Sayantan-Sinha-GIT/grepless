'use client';

import { motion } from 'motion/react';
import { setTheme, useTheme } from '@/lib/client/theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useTheme();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTheme(dark ? 'light' : 'dark', { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
      className={`relative flex h-9 w-[4.25rem] shrink-0 items-center rounded-full bg-bg-deep p-1 ring-1 ring-line transition-colors hover:ring-line-strong ${className}`}
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-2.5 text-faint">
        <SunIcon />
        <MoonIcon />
      </span>
      <motion.span
        className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-surface text-brand shadow-[0_4px_14px_-4px_rgb(var(--shadow-rgb)/0.5)]"
        animate={{ x: dark ? 32 : 0, rotate: dark ? 360 : 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      >
        {dark ? <MoonIcon /> : <SunIcon />}
      </motion.span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="10" cy="10" r="3.4" />
      <path
        d="M10 2.2v1.9M10 15.9v1.9M2.2 10h1.9M15.9 10h1.9M4.5 4.5l1.3 1.3M14.2 14.2l1.3 1.3M4.5 15.5l1.3-1.3M14.2 5.8l1.3-1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M16.5 12.3A6.8 6.8 0 0 1 7.7 3.5a6.8 6.8 0 1 0 8.8 8.8Z" strokeLinejoin="round" />
    </svg>
  );
}
