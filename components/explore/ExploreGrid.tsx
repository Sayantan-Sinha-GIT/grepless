'use client';

import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import type { PublicRepo } from '@/lib/repos';
import { RepoCard } from '../RepoCard';

type Sort = 'recent' | 'searched' | 'largest' | 'stars';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'searched', label: 'Most searched' },
  { key: 'largest', label: 'Largest' },
  { key: 'stars', label: 'Stars' },
];

export function ExploreGrid({ repos }: { repos: PublicRepo[] }) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [lang, setLang] = useState<string | null>(null);

  const languages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of repos) {
      const top = Object.entries(r.languages).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (top) counts.set(top, (counts.get(top) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [repos]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = repos.filter((r) => {
      if (q && !`${r.owner}/${r.name} ${r.description ?? ''}`.toLowerCase().includes(q)) return false;
      if (lang) {
        const top = Object.entries(r.languages).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (top !== lang) return false;
      }
      return true;
    });
    const by: Record<Sort, (a: PublicRepo, b: PublicRepo) => number> = {
      recent: (a, b) => (b.indexedAt ?? b.updatedAt).localeCompare(a.indexedAt ?? a.updatedAt),
      searched: (a, b) => b.searchCount - a.searchCount,
      largest: (a, b) => b.totalChunks - a.totalChunks,
      stars: (a, b) => (b.stars ?? 0) - (a.stars ?? 0),
    };
    return [...list].sort(by[sort]);
  }, [repos, filter, sort, lang]);

  return (
    <div>
      <div className="glass sticky top-[5.25rem] z-20 flex flex-col gap-3 rounded-[1.75rem] p-2 sm:flex-row sm:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-[1.4rem] bg-surface px-4 ring-1 ring-line focus-within:ring-brand">
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4" strokeLinecap="round" />
          </svg>
          <span className="sr-only">Filter repositories</span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name or description…"
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </label>
        <LayoutGroup id="sort">
          <div className="flex shrink-0 gap-1 overflow-x-auto rounded-[1.4rem] bg-bg-deep p-1" role="tablist" aria-label="Sort">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={sort === s.key}
                onClick={() => setSort(s.key)}
                className={`relative whitespace-nowrap rounded-[1.1rem] px-3.5 py-2 text-xs font-medium transition-colors ${
                  sort === s.key ? 'text-text' : 'text-dim hover:text-text'
                }`}
              >
                {sort === s.key && (
                  <motion.span layoutId="sort-pill" className="absolute inset-0 rounded-[1.1rem] bg-surface shadow-sm ring-1 ring-line" />
                )}
                <span className="relative">{s.label}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </div>

      {languages.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setLang(null)}
            className={`rounded-full px-3 py-1 text-xs ring-1 transition ${lang === null ? 'bg-brand text-on-brand ring-brand' : 'text-dim ring-line'}`}
          >
            All
          </button>
          {languages.map(([l, n]) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(lang === l ? null : l)}
              className={`rounded-full px-3 py-1 text-xs ring-1 transition ${lang === l ? 'bg-brand text-on-brand ring-brand' : 'text-dim ring-line hover:ring-line-strong'}`}
            >
              {l} <span className="opacity-60">{n}</span>
            </button>
          ))}
        </div>
      )}

      <motion.div layout className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {shown.map((r, i) => (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ delay: Math.min(i, 9) * 0.04, type: 'spring', stiffness: 260, damping: 26 }}
            >
              <RepoCard repo={r} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {shown.length === 0 && (
        <p className="sheet mt-8 p-10 text-center text-dim">
          {repos.length ? 'No repos match that filter.' : 'Nothing indexed yet.'}
        </p>
      )}
    </div>
  );
}
