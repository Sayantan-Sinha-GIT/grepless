'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { compact, fmt, timeAgo } from '@/lib/format';
import { rememberRepo } from '@/lib/recent';
import type { PublicRepo } from '@/lib/repos';
import type { SearchHit } from '@/lib/search';
import { IndexProgress } from './IndexProgress';
import { ResultCard } from './ResultCard';
import { GitHubIcon } from './SiteHeader';
import { StatusBadge } from './StatusBadge';

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

type Sample = { t: number; done: number };

export function RepoWorkspace({
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
  const [langs, setLangs] = useState<string[]>([]);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ tookMs: number; partial: boolean; query: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSearched = useRef(false);

  const id = repo.id;

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
        window.history.replaceState(null, '', url);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setSearching(false);
      }
    },
    [id],
  );

  const canSearch = repo.embeddedChunks > 0;

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
  const busy = repo.status === 'queued' || repo.status === 'fetching' || repo.status === 'indexing';
  const githubUrl = `https://github.com/${repo.owner}/${repo.name}`;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
      {/* Repo header */}
      <div className="flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate font-mono text-xl sm:text-2xl">
              <span className="text-muted">{repo.owner}/</span>
              <span className="font-semibold">{repo.name}</span>
            </h1>
            <StatusBadge status={repo.status} />
          </div>
          {repo.description && <p className="mt-2 max-w-2xl text-muted">{repo.description}</p>}
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-faint">
            {repo.stars != null && <Stat label="stars" value={`★ ${compact(repo.stars)}`} />}
            {repo.totalFiles > 0 && <Stat label="files" value={`${fmt(repo.totalFiles)} files`} />}
            {repo.totalChunks > 0 && <Stat label="chunks" value={`${fmt(repo.totalChunks)} chunks`} />}
            {repo.commitSha && (
              <Stat
                label="commit"
                value={
                  <a
                    href={`${githubUrl}/commit/${repo.commitSha}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono hover:text-accent"
                  >
                    @{repo.commitSha.slice(0, 7)}
                  </a>
                }
              />
            )}
            {repo.indexedAt && repo.status === 'ready' && <Stat label="indexed" value={`indexed ${timeAgo(repo.indexedAt)}`} />}
          </dl>
        </div>
        <div className="flex shrink-0 gap-2">
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-muted hover:border-line-strong hover:text-fg"
          >
            <GitHubIcon /> GitHub
          </a>
          <button
            type="button"
            onClick={reindex}
            disabled={busy}
            title="Download the latest commit and re-embed only files that changed"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-fg hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshIcon /> Re-index
          </button>
        </div>
      </div>

      {(busy || repo.status === 'error') && (
        <IndexProgress repo={repo} samples={samples} error={driveError} onRetry={retry} />
      )}
      {!busy && repo.status === 'ready' && repo.statusMessage && (
        <p className="mt-4 text-sm text-muted">{repo.statusMessage}</p>
      )}
      {!busy && driveError && repo.status !== 'error' && <p className="mt-4 text-sm text-danger">{driveError}</p>}

      {/* Search */}
      <section className="mt-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query, langs);
          }}
          className={`flex items-center gap-2 rounded-xl border bg-raised p-2 transition ${
            canSearch ? 'border-line-strong focus-within:border-accent' : 'border-line opacity-60'
          }`}
        >
          <SearchIcon />
          <label htmlFor="q" className="sr-only">
            Ask about this codebase
          </label>
          <input
            id="q"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!canSearch}
            placeholder={canSearch ? 'Ask about this codebase, e.g. where do we handle auth retries?' : 'Search unlocks as soon as the first chunks are embedded…'}
            autoComplete="off"
            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint disabled:cursor-not-allowed"
          />
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-faint sm:inline">/</kbd>
          <button
            type="submit"
            disabled={!canSearch || searching || !query.trim()}
            className="h-10 shrink-0 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!canSearch}
                onClick={() => {
                  setQuery(s);
                  runSearch(s, langs);
                }}
                className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-fg disabled:opacity-40"
              >
                {s}
              </button>
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
                    className={`rounded-md px-2 py-0.5 text-xs ring-1 transition ${
                      on ? 'bg-accent-soft text-accent ring-accent' : 'text-muted ring-line hover:ring-line-strong'
                    }`}
                  >
                    {lang} <span className="text-faint">{n}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8" aria-live="polite">
          {searchError && <p className="text-sm text-danger">{searchError}</p>}
          {searching && !hits && <ResultsSkeleton />}
          {hits && meta && (
            <>
              <p className="mb-4 text-sm text-muted">
                {hits.length ? `Top ${hits.length} matches` : 'No matches'} for{' '}
                <span className="text-fg">“{meta.query}”</span>
                <span className="text-faint"> · {meta.tookMs} ms</span>
                {meta.partial && (
                  <span className="text-warn">
                    {' '}
                    · searching {Math.round((repo.embeddedChunks / Math.max(1, repo.totalChunks)) * 100)}% of the index so far
                  </span>
                )}
              </p>
              <div className={`flex flex-col gap-4 transition-opacity ${searching ? 'opacity-50' : ''}`}>
                {hits.map((hit, i) => (
                  <ResultCard
                    key={hit.id}
                    hit={hit}
                    rank={i + 1}
                    owner={repo.owner}
                    name={repo.name}
                    commitSha={repo.commitSha}
                    query={meta.query}
                    explain={explain}
                  />
                ))}
              </div>
            </>
          )}
          {!hits && !searching && canSearch && (
            <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
              Ask a question in plain English, or pick a suggestion above. Results show the matching function, why it
              matched, and a link to the exact lines on GitHub.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-44 animate-pulse rounded-xl border border-line bg-raised" />
      ))}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" className="ml-2 h-5 w-5 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m13 13 4 4" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M16 10a6 6 0 1 1-1.8-4.3M16 4v3.5h-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
