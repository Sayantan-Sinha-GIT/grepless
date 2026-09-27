'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react';
import { useEffect, useState } from 'react';
import { LogoMark, Wordmark } from './Logo';
import { ThemeToggle } from './ThemeToggle';

export const SOURCE_URL = 'https://github.com/Sayantan-Sinha-GIT/grepless';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/how-it-works', label: 'How it works' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    // Freeze the page (and the smooth scroller) behind the full-screen menu.
    const lenis = (window as unknown as { __lenis?: { stop(): void; start(): void } }).__lenis;
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (open) lenis?.stop();
    else lenis?.start();
  }, [open]);

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-4 sm:pt-4"
        style={{ viewTransitionName: 'site-header' }}
      >
        <motion.nav
          aria-label="Main"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.1 }}
          className={`flex w-full max-w-6xl items-center justify-between gap-3 rounded-full py-2 pl-2 pr-2 transition-[background,box-shadow,max-width] duration-500 sm:pl-3 ${
            scrolled || open ? 'glass max-w-5xl' : 'bg-transparent'
          }`}
        >
          <Link href="/" className="group flex items-center gap-2.5 rounded-full pr-2" aria-label="grepless home">
            <motion.span whileHover={{ rotate: -12, scale: 1.08 }} transition={{ type: 'spring', stiffness: 400, damping: 12 }}>
              <LogoMark size={34} />
            </motion.span>
            <Wordmark className="text-[17px]" />
          </Link>

          <div className="hidden items-center gap-1 rounded-full bg-surface/60 p-1 ring-1 ring-line md:flex">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    active ? 'text-on-brand' : 'text-dim hover:text-text'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-brand"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden h-9 items-center gap-2 rounded-full bg-text px-4 text-sm font-medium text-bg transition hover:opacity-85 sm:flex"
            >
              <GitHubIcon />
              Source
            </a>
            <button
              type="button"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface ring-1 ring-line md:hidden"
            >
              <MenuIcon open={open} />
            </button>
          </div>
        </motion.nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-menu"
            initial={{ clipPath: 'circle(0% at 92% 4%)' }}
            animate={{ clipPath: 'circle(150% at 92% 4%)' }}
            exit={{ clipPath: 'circle(0% at 92% 4%)' }}
            transition={{ duration: 0.6, ease: [0.7, 0, 0.2, 1] }}
            className="fixed inset-0 z-40 flex flex-col justify-between bg-ink px-6 pb-10 pt-28 text-on-ink md:hidden"
          >
            <nav aria-label="Mobile" className="flex flex-col gap-2">
              {NAV.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.07, type: 'spring', stiffness: 220, damping: 24 }}
                >
                  <Link
                    href={item.href}
                    className="flex items-baseline gap-4 font-display text-5xl font-light tracking-tight"
                  >
                    <span className="font-mono text-xs text-ink-dim">0{i + 1}</span>
                    <span className={isActive(pathname, item.href) ? 'text-lime' : ''}>{item.label}</span>
                  </Link>
                </motion.div>
              ))}
            </nav>
            <motion.a
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              href={SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-ink-dim"
            >
              <GitHubIcon /> Source on GitHub
            </motion.a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <motion.path
        d="M3 7h14"
        initial={false}
        animate={{ d: open ? 'M5 5L15 15' : 'M3 7L17 7' }}
        strokeLinecap="round"
        transition={{ duration: 0.25 }}
      />
      <motion.path
        d="M3 13h14"
        initial={false}
        animate={{ d: open ? 'M15 5L5 15' : 'M3 13L17 13' }}
        strokeLinecap="round"
        transition={{ duration: 0.25 }}
      />
    </svg>
  );
}

export function GitHubIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
