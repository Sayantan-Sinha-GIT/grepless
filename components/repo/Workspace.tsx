'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { ViewTransition, useCallback, useEffect, useRef, useState } from 'react';
import { compact, fmt, timeAgo } from '@/lib/format';
import { languageColor } from '@/lib/client/languageColors';
import { rememberRepo } from '@/lib/recent';
import type { PublicRepo } from '@/lib/repos';
import type { SearchHit } from '@/lib/search';
import { GitHubIcon } from '../chrome/SiteHeader';
import { Magnetic, useTypewriter } from '../fx/motion';
import { VisibilityPill } from '../me/MyRepos';
import { StatusBadge } from '../StatusBadge';
import { IndexReactor, type Sample } from './IndexReactor';
import { ResultCard } from './ResultCard';

const WORKERS = 3;
const SUGGESTIONS = [
  'where are errors handled?',
  'how is configuration loaded?',
  'retry logic with backoff',
  'authentication and tokens',
  'where are HTTP requests made?',
  'entry point of the program',
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Request failed (${res.status})`), { status: res.status });
  return data as T;
}

export function Workspace({
  initialRepo,
  initialQuery,
  explain,
}: {
  initialRepo: PublicRepo;
  initialQuery: string;
  explain: boolean;
}) {
  const [repo, setRepo] = useState(initialRepo);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [samples, setSamples] = useState<Sample[]>([]);

  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const [langs, setLangs] = useState<string[]>([]);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ tookMs: number; partial: boolean; query: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSearched = useRef(false);

  const id = repo.id;
  const canSearch = repo.embeddedChunks > 0;
  const { text: typedPlaceholder } = useTypewriter(SUGGESTIONS, { enabled: canSearch && !focused && !query, holdMs: 1600 });

  useEffect(() => rememberRepo(repo.owner, repo.name), [repo.owner, repo.name]);

  const accept = useCallback((next: PublicRepo) => {
    setRepo((prev) =>
      // Parallel workers can answer out of order; never let progress go backwards mid-run.
      prev.status === 'indexing' && next.status === 'indexing' && next.embeddedChunks < prev.embeddedChunks
        ? prev
        : next,
    );
    if (next.status === 'indexing') setSamples((s) => [...s.slice(-30), { t: Date.now(), done: next.embeddedChunks }]);
  }, []);

  // Drives the index forward: prepare (download + chunk), then parallel embed loops.
  useEffect(() => {
    let cancelled = false;
    let current = repo;
    const update = (r: PublicRepo) => {
      current = r;
      if (!cancelled) accept(r);
    };

    async function run() {
      let failures = 0;
      while (!cancelled) {
        try {
          if (current.status === 'queued' || current.status === 'fetching') {
            const res = await api<{ outcome: string; repo: PublicRepo }>(`/api/repos/${id}/prepare`, { method: 'POST' });
            update(res.repo);
            if (res.outcome === 'busy') await sleep(8000);
            else if (res.outcome === 'in-progress' && res.repo.status === 'fetching') {
              await sleep(3000);
              update((await api<{ repo: PublicRepo }>(`/api/repos/${id}`)).repo);
            }
          } else if (current.status === 'indexing') {
            await Promise.all(
              Array.from({ length: WORKERS }, async (_, i) => {
                await sleep(i * 400);
                while (!cancelled && current.status === 'indexing') {
                  const res = await api<{ repo: PublicRepo }>(`/api/repos/${id}/embed`, { method: 'POST' });
                  update(res.repo);
                }
              }),
            );
          } else {
            return;
          }
          failures = 0;
          setDriveError(null);
        } catch (err) {
          failures++;
          const message = err instanceof Error ? err.message : 'Network error';
          setDriveError(`${message}. Retrying…`);
          if (failures > 6) {
            setDriveError(`${message}. Indexing paused. Reload the page to resume.`);
            return;
          }
          await sleep(Math.min(20_000, 1500 * 2 ** failures));
          try {
            update((await api<{ repo: PublicRepo }>(`/api/repos/${id}`)).repo);
          } catch {
            // keep last known state
          }
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, runKey]);

  const runSearch = useCallback(
    async (q: string, languages: string[]) => {
      const text = q.trim();
      if (!text) return;
      setSearching(true);
      setSearchError(null);
      try {
        const res = await api<{ hits: SearchHit[]; tookMs: number; partial: boolean }>('/api/search', {
          method: 'POST',
          body: JSON.stringify({ repoId: id, query: text, languages }),
        });
        setHits(res.hits);
        setMeta({ tookMs: res.tookMs, partial: res.partial, query: text });
        const url = new URL(window.location.href);
        url.searchParams.set('q', text);
        window.history.replaceState(window.history.state, '', url);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setSearching(false);
      }
    },
    [id],
  );

  useEffect(() => {
    if (!autoSearched.current && initialQuery && canSearch) {
      autoSearched.current = true;
      runSearch(initialQuery, []);
    }
  }, [initialQuery, canSearch, runSearch]);

  // "/" focuses the search box, like GitHub.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === '/' && !/input|textarea/i.test(target.tagName) && !target.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function reindex() {
    try {
      const res = await api<{ repo: PublicRepo }>(`/api/repos/${id}/reindex`, { method: 'POST' });
      setSamples([]);
      setRepo(res.repo);
      setRunKey((k) => k + 1);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Could not start a re-index');
    }
  }

  async function retry() {
    try {
      const res = await api<{ repo: PublicRepo }>('/api/repos', {
        method: 'POST',
        body: JSON.stringify({ url: `${repo.owner}/${repo.name}` }),
      });
      setDriveError(null);
      setRepo(res.repo);
      setRunKey((k) => k + 1);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Could not retry');
    }
  }

  const languages = Object.entries(repo.languages).sort((a, b) => b[1] - a[1]);
  const langTotal = languages.reduce((s, [, n]) => s + n, 0) || 1;
  const busy = repo.status === 'queued' || repo.status === 'fetching' || repo.status === 'indexing';
  const githubUrl = `https://github.com/${repo.owner}/${repo.name}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-28 sm:px-6 sm:pt-32">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <section className="relative">
        <motion.nav
          aria-label="Breadcrumb"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 font-mono text-xs text-faint"
        >
          <Link href="/explore" className="hover:text-brand">
            explore
          </Link>
          <span>/</span>
          <span>{repo.owner}</span>
          <span>/</span>
          <span className="text-dim">{repo.name}</span>
        </motion.nav>

        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-5">
            <motion.img
              initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.1 }}
              src={`https://github.com/${repo.owner}.png?size=160`}
              alt=""
              width={72}
              height={72}
              className="h-16 w-16 shrink-0 rounded-[1.4rem] bg-bg-deep object-cover shadow-[0_18px_40px_-18px_rgb(var(--shadow-rgb)/0.6)] ring-1 ring-line sm:h-[4.5rem] sm:w-[4.5rem]"
            />
            <div className="min-w-0">
              <p className="font-mono text-sm text-faint">{repo.owner}</p>
              <ViewTransition name={`repo-${repo.id}`} share="morph" default="none">
                <h1 className="break-words font-display text-[clamp(2.5rem,7vw,5.5rem)] font-light leading-[0.95] tracking-[-0.05em]">
                  {repo.name}
                </h1>
              </ViewTransition>
              {repo.description && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-3 max-w-2xl text-dim text-pretty"
                >
                  {repo.description}
                </motion.p>
              )}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex shrink-0 flex-wrap items-center gap-2"
          >
            {repo.isPrivate && <VisibilityPill isPrivate />}
            <StatusBadge status={repo.status} />
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm font-medium ring-1 ring-line transition hover:ring-line-strong"
            >
              <GitHubIcon /> GitHub
            </a>
            <Magnetic strength={0.2}>
              <button
                type="button"
                onClick={reindex}
                disabled={busy}
                title="Download the latest commit and re-embed only files that changed"
                className="group inline-flex h-10 items-center gap-2 rounded-full bg-text px-4 text-sm font-semibold text-bg transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-500 group-hover:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M16 10a6 6 0 1 1-1.8-4.3M16 4v3.5h-3.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Re-index
              </button>
            </Magnetic>
          </motion.div>
        </div>

        <motion.dl
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mt-8 flex flex-wrap gap-2 text-xs"
        >
          {[
            repo.stars != null && ['stars', `★ ${compact(repo.stars)}`],
            repo.totalFiles > 0 && ['files', `${fmt(repo.totalFiles)} files`],
            repo.totalChunks > 0 && ['chunks', `${fmt(repo.totalChunks)} chunks`],
            repo.indexedAt && repo.status === 'ready' && ['indexed', `indexed ${timeAgo(repo.indexedAt)}`],
            repo.searchCount > 0 && ['searches', `${fmt(repo.searchCount)} searches`],
          ]
            .filter((x): x is [string, string] => Array.isArray(x))
            .map(([k, v]) => (
              <div key={k} className="rounded-full bg-surface/80 px-3 py-1.5 text-dim ring-1 ring-line">
                <dt className="sr-only">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          {repo.commitSha && (
            <a
              href={`${githubUrl}/commit/${repo.commitSha}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-surface/80 px-3 py-1.5 font-mono text-dim ring-1 ring-line hover:text-brand"
            >
              @{repo.commitSha.slice(0, 7)}
            </a>
          )}
        </motion.dl>

        {languages.length > 0 && (
          <div className="mt-6">
            <div className="flex h-2 overflow-hidden rounded-full bg-bg-deep">
              {languages.map(([lang, n], i) => (
                <motion.span
                  key={lang}
                  title={`${lang}: ${n} files`}
                  style={{ background: languageColor(lang) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(n / langTotal) * 100}%` }}
                  transition={{ delay: 0.4 + i * 0.08, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Indexing ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {(busy || repo.status === 'error') && (
          <IndexReactor key="reactor" repo={repo} samples={samples} error={driveError} onRetry={retry} />
        )}
      </AnimatePresence>
      {!busy && repo.status === 'ready' && repo.statusMessage && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 text-sm text-dim">
          {repo.statusMessage}
        </motion.p>
      )}
      {!busy && driveError && repo.status !== 'error' && <p className="mt-4 text-sm text-danger">{driveError}</p>}

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <section className="mt-12">
        <div className="sticky top-[5.25rem] z-30">
          <div className={`glow-frame rounded-[1.75rem] ${canSearch ? '' : 'opacity-60'}`} data-active={searching}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runSearch(query, langs);
              }}
              className="relative flex items-center gap-2 rounded-[1.75rem] bg-surface p-2 pl-5 shadow-[0_30px_70px_-35px_rgb(var(--shadow-rgb)/0.6)]"
            >
              <motion.svg
                viewBox="0 0 20 20"
                className="h-5 w-5 shrink-0 text-brand"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
                animate={searching ? { rotate: [0, 12, -12, 0], scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 0.8, repeat: searching ? Infinity : 0 }}
              >
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m13 13 4 4" strokeLinecap="round" />
              </motion.svg>
              <label htmlFor="q" className="sr-only">
                Ask about this codebase
              </label>
              <div className="relative min-w-0 flex-1">
                <input
                  id="q"
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  disabled={!canSearch}
                  autoComplete="off"
                  className="h-12 w-full bg-transparent text-base outline-none disabled:cursor-not-allowed sm:text-[17px]"
                />
                {!query && (
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center truncate text-base text-faint sm:text-[17px]">
                    {canSearch ? (focused ? 'Ask about this codebase…' : typedPlaceholder || 'Ask about this codebase…') : 'Search unlocks as soon as the first chunks are embedded…'}
                  </span>
                )}
              </div>
              <kbd className="hidden rounded-md px-2 py-1 font-mono text-[11px] text-faint ring-1 ring-line sm:inline">/</kbd>
              <button
                type="submit"
                disabled={!canSearch || searching || !query.trim()}
                className="h-12 shrink-0 rounded-[1.25rem] bg-brand px-5 text-sm font-semibold text-on-brand transition hover:brightness-110 disabled:opacity-50"
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s, i) => (
              <motion.button
                key={s}
                type="button"
                disabled={!canSearch}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                whileHover={{ y: -2 }}
                onClick={() => {
                  setQuery(s);
                  runSearch(s, langs);
                }}
                className="rounded-full bg-surface/70 px-3 py-1.5 text-xs text-dim ring-1 ring-line transition-colors hover:text-brand hover:ring-brand disabled:opacity-40"
              >
                {s}
              </motion.button>
            ))}
          </div>
          {languages.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 md:justify-end" role="group" aria-label="Filter by language">
              <span className="text-xs text-faint">Language</span>
              {languages.slice(0, 8).map(([lang, n]) => {
                const on = langs.includes(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const next = on ? langs.filter((l) => l !== lang) : [...langs, lang];
                      setLangs(next);
                      if (meta) runSearch(meta.query, next);
                    }}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 transition ${
                      on ? 'bg-brand text-on-brand ring-brand' : 'text-dim ring-line hover:ring-line-strong'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: languageColor(lang) }} />
                    {lang} <span className={on ? 'opacity-70' : 'text-faint'}>{n}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-10" aria-live="polite">
          {searchError && <p className="text-sm text-danger">{searchError}</p>}
          {searching && !hits && <ResultsSkeleton />}
          {hits && meta && (
            <>
              <motion.p key={meta.query} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-6 text-sm text-dim">
                {hits.length ? `Top ${hits.length} matches` : 'No matches'} for{' '}
                <span className="font-medium text-text">“{meta.query}”</span>
                <span className="font-mono text-faint"> · {meta.tookMs} ms</span>
                {meta.partial && (
                  <span className="text-warn">
                    {' '}
                    · searching {Math.round((repo.embeddedChunks / Math.max(1, repo.totalChunks)) * 100)}% of the index so far
                  </span>
                )}
              </motion.p>
              <div className={`flex flex-col gap-8 transition-opacity ${searching ? 'opacity-40' : ''}`}>
                <AnimatePresence mode="popLayout">
                  {hits.map((hit, i) => (
                    <ResultCard
                      key={`${meta.query}-${hit.id}`}
                      hit={hit}
                      rank={i}
                      owner={repo.owner}
                      name={repo.name}
                      commitSha={repo.commitSha}
                      query={meta.query}
                      explain={explain}
                    />
                  ))}
                </AnimatePresence>
              </div>
              {hits.length === 0 && (
                <p className="sheet p-10 text-center text-dim">
                  Nothing close enough. Try describing what the code does in other words, or clear the language filter.
                </p>
              )}
            </>
          )}
          {!hits && !searching && canSearch && <EmptyState />}
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="sheet relative flex flex-col items-center overflow-hidden px-6 py-14 text-center"
    >
      <svg viewBox="0 0 240 120" className="h-28 w-56" aria-hidden="true">
        {[
          [30, 60], [60, 30], [70, 88], [100, 55], [130, 25], [150, 80], [180, 50], [210, 90], [200, 25],
        ].map(([x, y], i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r={i === 3 ? 6 : 3.5}
            fill={i === 3 ? 'var(--lime)' : 'var(--brand)'}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0.4, 1, 0.4], scale: 1 }}
            transition={{ opacity: { duration: 2.4, repeat: Infinity, delay: i * 0.2 }, scale: { delay: i * 0.05 } }}
          />
        ))}
        {[[30, 60], [60, 30], [70, 88], [130, 25], [150, 80]].map(([x, y], i) => (
          <motion.line
            key={i}
            x1={100}
            y1={55}
            x2={x}
            y2={y}
            stroke="var(--brand)"
            strokeOpacity="0.4"
            strokeWidth="1.2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.4 + i * 0.12, duration: 0.6 }}
          />
        ))}
      </svg>
      <p className="mt-4 font-display text-2xl font-light tracking-tight">Ask it anything.</p>
      <p className="mt-2 max-w-md text-sm text-dim">
        Describe what the code does, in plain English. Results show the matching function, why it matched, and a
        link to the exact lines on GitHub.
      </p>
    </motion.div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid gap-4 md:grid-cols-[4.5rem_1fr]">
          <div className="hidden md:block" />
          <div className="skeleton h-56 rounded-[1.75rem]" />
        </div>
      ))}
    </div>
  );
}
