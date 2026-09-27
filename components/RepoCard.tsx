'use client';

import Link from 'next/link';
import { ViewTransition } from 'react';
import { compact, fmt, timeAgo } from '@/lib/format';
import { languageColor } from '@/lib/client/languageColors';
import type { PublicRepo } from '@/lib/repos';
import { TiltCard } from './fx/motion';
import { StatusBadge } from './StatusBadge';

export function RepoCard({ repo }: { repo: PublicRepo }) {
  const pct = repo.totalChunks ? Math.round((repo.embeddedChunks / repo.totalChunks) * 100) : 0;
  const langs = Object.entries(repo.languages).sort((a, b) => b[1] - a[1]);
  const total = langs.reduce((s, [, n]) => s + n, 0) || 1;

  return (
    <TiltCard max={5} className="sheet group h-full rounded-3xl">
      <Link href={`/r/${repo.owner}/${repo.name}`} className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://github.com/${repo.owner}.png?size=80`}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              className="h-10 w-10 shrink-0 rounded-xl bg-bg-deep object-cover ring-1 ring-line"
            />
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-faint">{repo.owner}</p>
              <ViewTransition name={`repo-${repo.id}`} share="morph" default="none">
                <p className="truncate font-display text-lg font-semibold tracking-tight transition-colors group-hover:text-brand">
                  {repo.name}
                </p>
              </ViewTransition>
            </div>
          </div>
          <StatusBadge status={repo.status} />
        </div>

        <p className="line-clamp-2 min-h-[2.6rem] text-sm leading-relaxed text-dim">
          {repo.description ?? 'No description on GitHub.'}
        </p>

        {langs.length > 0 && (
          <div className="flex h-1.5 overflow-hidden rounded-full bg-bg-deep">
            {langs.slice(0, 5).map(([lang, n]) => (
              <span key={lang} style={{ width: `${(n / total) * 100}%`, background: languageColor(lang) }} />
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
          {repo.status === 'ready' ? (
            <span className="font-medium text-text">{fmt(repo.totalChunks)} chunks</span>
          ) : repo.status === 'indexing' ? (
            <span className="font-medium text-warn">{pct}% embedded</span>
          ) : null}
          {repo.stars != null && <span>★ {compact(repo.stars)}</span>}
          {langs[0] && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: languageColor(langs[0][0]) }} />
              {langs[0][0]}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 transition-transform duration-300 group-hover:translate-x-0.5">
            {repo.indexedAt ? timeAgo(repo.indexedAt) : ''}
            <span className="text-brand opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
              →
            </span>
          </span>
        </div>
      </Link>
    </TiltCard>
  );
}
