'use client';

import { usePathname } from 'next/navigation';
import { GitHubIcon } from '../chrome/SiteHeader';
import { Magnetic } from '../fx/motion';

/**
 * A plain link (not a fetch): sign-in is a full-page trip to GitHub and back.
 * `next` defaults to the current page so people land where they started.
 */
export function SignInButton({
  next,
  size = 'md',
  label = 'Sign in with GitHub',
  className = '',
}: {
  next?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}) {
  const pathname = usePathname();
  const href = `/api/auth/login?next=${encodeURIComponent(next ?? pathname ?? '/me')}`;
  const sizes = {
    sm: 'h-9 gap-2 px-4 text-sm',
    md: 'h-11 gap-2.5 px-5 text-sm',
    lg: 'h-14 gap-3 pl-6 pr-2 text-base',
  }[size];

  const link = (
    <a
      href={href}
      className={`group relative inline-flex items-center overflow-hidden rounded-full bg-text font-semibold text-bg transition hover:opacity-90 ${sizes} ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-bg/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      <GitHubIcon className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />
      <span className="whitespace-nowrap">{label}</span>
      {size === 'lg' && (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bg/15 transition-transform duration-300 group-hover:-rotate-45">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 10h11M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </a>
  );
  return size === 'lg' ? <Magnetic strength={0.2}>{link}</Magnetic> : link;
}
