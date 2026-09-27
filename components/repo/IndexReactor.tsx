'use client';

import { AnimatePresence, motion, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { fmt } from '@/lib/format';
import type { PublicRepo } from '@/lib/repos';
import { useAuth } from '../auth/AuthContext';
import { SignInButton } from '../auth/SignInButton';

export type Sample = { t: number; done: number };

const STAGES = [
  { key: 'queued', label: 'Queued', hint: 'Waiting for a free indexing slot' },
  { key: 'fetching', label: 'Fetch & chunk', hint: 'Downloading the tarball and parsing files with tree-sitter' },
  { key: 'indexing', label: 'Embed', hint: 'Turning every chunk into a 384-d vector with gte-small' },
  { key: 'ready', label: 'Ready', hint: 'Searchable' },
] as const;

function rate(samples: Sample[]): number | null {
  if (samples.length < 3) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const r = (last.done - first.done) / ((last.t - first.t) / 1000);
  return r > 0 ? r : null;
}

function etaText(perSecond: number | null, remaining: number): string {
  if (!perSecond || remaining <= 0) return 'measuring speed…';
  const s = Math.round(remaining / perSecond);
  if (s < 60) return `about ${Math.max(5, Math.round(s / 5) * 5)} s left`;
  return `about ${Math.round(s / 60)} min left`;
}

export function IndexReactor({
  repo,
  samples,
  error,
  onRetry,
}: {
  repo: PublicRepo;
  samples: Sample[];
  error: string | null;
  onRetry: () => void;
}) {
  const auth = useAuth();
  const [log, setLog] = useState<{ id: number; text: string }[]>([]);
  const lastLogged = useRef({ status: '', embedded: -1, id: 0 });

  // A running log derived from the progress updates.
  useEffect(() => {
    const prev = lastLogged.current;
    const lines: string[] = [];
    if (repo.status !== prev.status) {
      if (repo.status === 'queued') lines.push(repo.statusMessage ?? 'Queued: waiting for a free slot');
      if (repo.status === 'fetching') lines.push(repo.statusMessage ?? 'Downloading repository from GitHub');
      if (repo.status === 'indexing')
        lines.push(`Parsed ${fmt(repo.totalFiles)} files into ${fmt(repo.totalChunks)} chunks (${fmt(repo.skippedFiles)} skipped)`);
      if (repo.status === 'ready') lines.push('Index complete. Search away.');
    }
    if (repo.status === 'indexing' && repo.embeddedChunks > prev.embedded && repo.embeddedChunks > 0) {
      lines.push(`Embedded ${fmt(repo.embeddedChunks)} / ${fmt(repo.totalChunks)} chunks`);
    }
    if (!lines.length) return;
    prev.status = repo.status;
    prev.embedded = repo.embeddedChunks;
    setLog((l) => [...l, ...lines.map((text) => ({ id: ++prev.id, text }))].slice(-5));
  }, [repo.status, repo.embeddedChunks, repo.totalChunks, repo.totalFiles, repo.skippedFiles, repo.statusMessage]);

  const pct =
    repo.status === 'indexing' && repo.totalChunks
      ? Math.min(100, (repo.embeddedChunks / repo.totalChunks) * 100)
      : repo.status === 'fetching'
        ? 6
        : repo.status === 'ready'
          ? 100
          : 1;
  const spring = useSpring(pct, { stiffness: 60, damping: 20 });
  useEffect(() => spring.set(pct), [pct, spring]);
  const dash = useTransform(spring, (v) => `${(v / 100) * 553} 553`);
  const label = useTransform(spring, (v) => `${Math.floor(v)}`);

  if (repo.status === 'error') {
    return (
      <motion.div
        role="alert"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="sheet mt-8 flex flex-col gap-5 p-8 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger">
            <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M10 6v5M10 14h.01M8.6 2.9 1.9 14.5A1.6 1.6 0 0 0 3.3 17h13.4a1.6 1.6 0 0 0 1.4-2.5L11.4 2.9a1.6 1.6 0 0 0-2.8 0Z" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <p className="font-display text-xl font-medium">Indexing failed</p>
            <p className="mt-1 max-w-xl text-sm text-dim">{repo.statusMessage ?? 'Something went wrong while indexing.'}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {auth.enabled && !auth.viewer && /sign in with GitHub/i.test(repo.statusMessage ?? '') && <SignInButton />}
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-full bg-surface px-5 py-2.5 text-sm font-semibold ring-1 ring-line transition hover:ring-brand"
          >
            Try again
          </button>
        </div>
      </motion.div>
    );
  }

  const activeIndex = STAGES.findIndex((s) => s.key === repo.status);
  const perSecond = rate(samples);

  return (
    <motion.section
      aria-label="Indexing progress"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="sheet-ink relative mt-8 overflow-hidden p-6 sm:p-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full opacity-50 blur-[90px]"
        style={{ background: 'radial-gradient(circle, #6b4ef0, transparent 70%)' }}
      />
      <div className="relative grid items-center gap-10 md:grid-cols-[auto_1fr]">
        {/* The reactor: progress ring, orbiting chunks, particles streaming in. */}
        <div className="relative mx-auto h-56 w-56 sm:h-64 sm:w-64" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          >
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                style={{
                  background: i % 3 === 0 ? 'var(--lime)' : i % 3 === 1 ? 'var(--brand-hi)' : 'var(--pink)',
                  transform: `rotate(${i * 36}deg) translateY(-${118 + (i % 2) * 8}px)`,
                  opacity: 0.8,
                }}
              />
            ))}
          </motion.div>
          <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
            <defs>
              <linearGradient id="reactor-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--lime)" />
                <stop offset="0.5" stopColor="#a996ff" />
                <stop offset="1" stopColor="var(--pink)" />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
            <motion.circle
              cx="100"
              cy="100"
              r="88"
              fill="none"
              stroke="url(#reactor-grad)"
              strokeWidth="10"
              strokeLinecap="round"
              style={{ strokeDasharray: dash }}
            />
            <circle cx="100" cy="100" r="72" fill="none" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 6" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-display text-6xl font-light tracking-[-0.05em] tabular-nums">
              <motion.span>{label}</motion.span>
              <span className="text-2xl text-ink-dim">%</span>
            </p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim">{STAGES[Math.max(0, activeIndex)]?.label}</p>
          </div>
          {repo.status === 'indexing' &&
            Array.from({ length: 8 }, (_, i) => (
              <motion.span
                key={i}
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-2 w-3 rounded-[3px] bg-brand-hi"
                initial={{ x: 180, y: (i - 4) * 22, opacity: 0, scale: 1 }}
                animate={{ x: [180, 0], y: [(i - 4) * 22, 0], opacity: [0, 1, 0], scale: [1, 0.3] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2, ease: 'easeIn' }}
              />
            ))}
        </div>

        <div className="min-w-0">
          <ol className="flex flex-col gap-3">
            {STAGES.map((s, i) => {
              const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo';
              return (
                <li key={s.key} className="flex items-start gap-3">
                  <span
                    className={`relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${
                      state === 'done'
                        ? 'bg-lime text-on-lime'
                        : state === 'active'
                          ? 'bg-brand-hi text-ink'
                          : 'bg-ink-2 text-ink-dim ring-1 ring-ink-line'
                    }`}
                  >
                    {state === 'active' && (
                      <span className="absolute inset-0 rounded-full bg-brand-hi" style={{ animation: 'pulse-ring 1.6s ease-out infinite' }} />
                    )}
                    <span className="relative">{state === 'done' ? '✓' : i + 1}</span>
                  </span>
                  <div>
                    <p className={`font-medium ${state === 'todo' ? 'text-ink-dim' : 'text-on-ink'}`}>{s.label}</p>
                    {state === 'active' && <p className="text-sm text-ink-dim">{repo.statusMessage ?? s.hint}</p>}
                  </div>
                </li>
              );
            })}
          </ol>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['files', fmt(repo.totalFiles)],
              ['skipped', fmt(repo.skippedFiles)],
              ['chunks', fmt(repo.totalChunks)],
              ['speed', perSecond ? `${perSecond.toFixed(1)}/s` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-ink-2 px-3 py-2.5 ring-1 ring-ink-line">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim">{k}</dt>
                <dd className="mt-0.5 font-display text-xl tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 rounded-2xl bg-ink-2 p-3 font-mono text-[11.5px] ring-1 ring-ink-line" aria-live="polite">
            <div className="mb-2 flex items-center justify-between text-ink-dim">
              <span>log</span>
              <span>{repo.status === 'indexing' ? etaText(perSecond, repo.totalChunks - repo.embeddedChunks) : ''}</span>
            </div>
            <ul className="flex min-h-[6.5rem] flex-col justify-end gap-1">
              <AnimatePresence initial={false}>
                {log.map((l, i) => (
                  <motion.li
                    key={l.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: i === log.length - 1 ? 1 : 0.5, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="truncate"
                  >
                    <span className="text-lime">›</span> {l.text}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
          {repo.status === 'indexing' && (
            <p className="mt-4 text-xs leading-relaxed text-ink-dim">
              You can search already: results cover the part that&apos;s embedded. Keep this tab open to finish. If you
              close it, indexing resumes the next time anyone opens this page.
            </p>
          )}
          {error && <p className="mt-3 text-xs text-warn">{error}</p>}
        </div>
      </div>
    </motion.section>
  );
}
