'use client';

import Link from 'next/link';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { compact, fmt, timeAgo } from '@/lib/format';
import { languageColor } from '@/lib/client/languageColors';
import type { GrantedRepo, Installation } from '@/lib/githubApp';
import type { PublicRepo } from '@/lib/repos';
import { Avatar } from '../auth/AccountMenu';
import { SignInButton } from '../auth/SignInButton';
import { Magnetic, TiltCard } from '../fx/motion';
import { StatusBadge } from '../StatusBadge';

type Row = GrantedRepo & { index: PublicRepo | null };
type Tab = 'all' | 'private' | 'public' | 'indexed';
type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; expired: boolean }
  | { kind: 'ready'; installations: Installation[]; repos: Row[] };

const PAGE = 60;

export function MyRepos({ installUrl, justInstalled }: { installUrl: string; justInstalled: boolean }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [limit, setLimit] = useState(PAGE);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/me/repos', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ kind: 'error', message: data.error ?? 'Could not load your repos.', expired: res.status === 401 });
        return;
      }
      setState({ kind: 'ready', installations: data.installations, repos: data.repos });
    } catch {
      setState({ kind: 'error', message: 'Network error. Check your connection and try again.', expired: false });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const repos = state.kind === 'ready' ? state.repos : [];
  const counts = useMemo(
    () => ({
      all: repos.length,
      private: repos.filter((r) => r.isPrivate).length,
      public: repos.filter((r) => !r.isPrivate).length,
      indexed: repos.filter((r) => r.index).length,
    }),
    [repos],
  );
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return repos.filter((r) => {
      if (tab === 'private' && !r.isPrivate) return false;
      if (tab === 'public' && r.isPrivate) return false;
      if (tab === 'indexed' && !r.index) return false;
      return !q || `${r.owner}/${r.name} ${r.description ?? ''}`.toLowerCase().includes(q);
    });
  }, [repos, filter, tab]);

  if (state.kind === 'loading') return <Skeleton />;

  if (state.kind === 'error') {
    return (
      <div className="sheet flex flex-col items-center gap-5 p-10 text-center">
        <p className="max-w-md text-dim">{state.message}</p>
        {state.expired ? (
          <SignInButton next="/me" label="Sign in again" />
        ) : (
          <button type="button" onClick={load} className="h-11 rounded-full bg-brand px-5 text-sm font-semibold text-on-brand">
            Try again
          </button>
        )}
      </div>
    );
  }

  if (state.installations.length === 0) return <InstallCta installUrl={installUrl} />;

  return (
    <div>
      <AnimatePresence>
        {justInstalled && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="mb-6 flex items-center gap-4 rounded-[1.75rem] bg-lime p-4 pr-6 text-on-lime"
            role="status"
          >
            <motion.span
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.2 }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-on-lime text-lime"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <motion.path
                  d="M5 10.5l3 3 7-7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                />
              </svg>
            </motion.span>
            <p className="text-sm font-medium">
              Access granted. {fmt(counts.all)} {counts.all === 1 ? 'repo is' : 'repos are'} ready to index. Pick one below.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-2">
        {state.installations.map((i) => (
          <a
            key={i.id}
            href={i.settingsUrl}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3.5 text-sm ring-1 ring-line transition hover:ring-brand"
          >
            <Avatar url={i.accountAvatar} login={i.account} className="h-7 w-7" />
            <span className="font-medium">{i.account}</span>
            <span className="text-xs text-faint">{i.selection === 'all' ? 'all repos' : 'selected repos'}</span>
            <span className="text-xs text-brand opacity-60 transition group-hover:opacity-100" aria-hidden="true">
              manage ↗
            </span>
          </a>
        ))}
        <a
          href={installUrl}
          className="flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm text-dim border border-dashed border-line-strong transition hover:border-brand hover:text-brand"
        >
          <span aria-hidden="true">+</span> Add an account or organization
        </a>
      </div>

      <div className="glass sticky top-[5.25rem] z-20 mt-6 flex flex-col gap-3 rounded-[1.75rem] p-2 sm:flex-row sm:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-[1.4rem] bg-surface px-4 ring-1 ring-line focus-within:ring-brand">
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4" strokeLinecap="round" />
          </svg>
          <span className="sr-only">Filter your repositories</span>
          <input
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Filter your repos…"
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </label>
        <LayoutGroup id="me-tabs">
          <div className="flex shrink-0 gap-1 overflow-x-auto rounded-[1.4rem] bg-bg-deep p-1" role="tablist" aria-label="Show">
            {(['all', 'private', 'public', 'indexed'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  setLimit(PAGE);
                }}
                className={`relative whitespace-nowrap rounded-[1.1rem] px-3.5 py-2 text-xs font-medium capitalize transition-colors ${
                  tab === t ? 'text-text' : 'text-dim hover:text-text'
                }`}
              >
                {tab === t && (
                  <motion.span layoutId="me-tab-pill" className="absolute inset-0 rounded-[1.1rem] bg-surface shadow-sm ring-1 ring-line" />
                )}
                <span className="relative">
                  {t} <span className="text-faint">{counts[t]}</span>
                </span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </div>

      <motion.div layout className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {shown.slice(0, limit).map((r, i) => (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ delay: Math.min(i, 9) * 0.04, type: 'spring', stiffness: 260, damping: 26 }}
            >
              <GrantedCard repo={r} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {shown.length > limit && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="h-11 rounded-full bg-surface px-6 text-sm font-medium ring-1 ring-line transition hover:ring-brand"
          >
            Show {Math.min(PAGE, shown.length - limit)} more
          </button>
        </div>
      )}
      {shown.length === 0 && (
        <p className="sheet mt-8 p-10 text-center text-dim">
          {repos.length ? 'No repos match that filter.' : 'grepless can’t see any repos yet. Add some with the button above.'}
        </p>
      )}
    </div>
  );
}

function GrantedCard({ repo }: { repo: Row }) {
  const ix = repo.index;
  const pct = ix && ix.totalChunks ? Math.round((ix.embeddedChunks / ix.totalChunks) * 100) : 0;
  return (
    <TiltCard max={5} className="sheet group h-full rounded-3xl">
      <Link href={`/r/${repo.owner}/${repo.name}`} className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-faint">{repo.owner}</p>
            <p className="truncate font-display text-lg font-semibold tracking-tight transition-colors group-hover:text-brand">
              {repo.name}
            </p>
          </div>
          <VisibilityPill isPrivate={repo.isPrivate} />
        </div>

        <p className="line-clamp-2 min-h-[2.6rem] text-sm leading-relaxed text-dim">
          {repo.description ?? 'No description on GitHub.'}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
          {repo.language && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: languageColor(repo.language) }} />
              {repo.language}
            </span>
          )}
          {repo.stars > 0 && <span>★ {compact(repo.stars)}</span>}
          {repo.pushedAt && <span>pushed {timeAgo(repo.pushedAt)}</span>}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
          {ix ? (
            <span className="flex items-center gap-2 text-xs text-dim">
              <StatusBadge status={ix.status} />
              {ix.status === 'ready' ? `${fmt(ix.totalChunks)} chunks` : ix.status === 'indexing' ? `${pct}%` : ''}
            </span>
          ) : (
            <span className="text-xs text-faint">Not indexed yet</span>
          )}
          <span className="flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand transition group-hover:bg-brand group-hover:text-on-brand">
            {ix && ix.embeddedChunks > 0 ? 'Search' : 'Index'}
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </span>
        </div>
      </Link>
    </TiltCard>
  );
}

export function VisibilityPill({ isPrivate }: { isPrivate: boolean }) {
  return isPrivate ? (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-lime">
      <LockIcon /> Private
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-medium text-dim ring-1 ring-line">
      Public
    </span>
  );
}

export function LockIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="2" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" strokeLinecap="round" />
    </svg>
  );
}

function InstallCta({ installUrl }: { installUrl: string }) {
  const steps = [
    ['Open GitHub', 'The button below takes you to GitHub’s own page for grepless.'],
    ['Pick your repos', 'Choose “All repositories” to search everything, or select just a few.'],
    ['Click Install', 'GitHub sends you straight back here with your repos listed.'],
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="sheet-ink relative overflow-hidden p-8 sm:p-12"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full opacity-40 blur-[100px]"
        style={{ background: 'radial-gradient(circle, var(--brand) 0%, transparent 65%)' }}
      />
      <p className="relative font-mono text-xs uppercase tracking-[0.2em] text-lime">One more step</p>
      <h2 className="relative mt-4 max-w-2xl font-display text-4xl font-light leading-[1.02] tracking-[-0.04em] sm:text-5xl">
        Choose which repos grepless may read.
      </h2>
      <ol className="relative mt-10 grid gap-4 md:grid-cols-3">
        {steps.map(([title, body], i) => (
          <motion.li
            key={title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="rounded-3xl p-5 ring-1 ring-ink-line"
          >
            <span className="font-mono text-xs text-lime">0{i + 1}</span>
            <p className="mt-3 font-medium">{title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-dim">{body}</p>
          </motion.li>
        ))}
      </ol>
      <div className="relative mt-10">
        <Magnetic strength={0.2}>
          <a
            href={installUrl}
            className="group inline-flex h-14 items-center gap-3 rounded-full bg-lime pl-6 pr-2 text-base font-semibold text-on-lime transition hover:brightness-105"
          >
            Choose repos on GitHub
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-on-lime/10 transition-transform duration-300 group-hover:-rotate-45">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 10h11M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </a>
        </Magnetic>
      </div>
    </motion.div>
  );
}

function Skeleton() {
  return (
    <div>
      <div className="skeleton h-9 w-72 rounded-full" />
      <div className="skeleton mt-6 h-[3.75rem] rounded-[1.75rem]" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-52 rounded-3xl" style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
    </div>
  );
}
