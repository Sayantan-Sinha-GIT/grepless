import Link from 'next/link';
import { compact, fmt, timeAgo } from '@/lib/format';
import type { PublicRepo } from '@/lib/repos';
import { StatusBadge } from './StatusBadge';

export function RepoCard({ repo }: { repo: PublicRepo }) {
  const pct = repo.totalChunks ? Math.round((repo.embeddedChunks / repo.totalChunks) * 100) : 0;
  const langs = Object.keys(repo.languages).slice(0, 3);
  return (
    <Link
      href={`/r/${repo.owner}/${repo.name}`}
      className="group flex flex-col gap-3 rounded-xl border border-line bg-raised p-4 transition hover:border-line-strong hover:bg-inset"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate font-mono text-sm">
          <span className="text-muted">{repo.owner}/</span>
          <span className="font-semibold text-fg group-hover:text-accent">{repo.name}</span>
        </p>
        <StatusBadge status={repo.status} />
      </div>
      <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted">{repo.description ?? 'No description'}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
        {repo.status === 'ready' ? (
          <span>{fmt(repo.totalChunks)} chunks</span>
        ) : repo.status === 'indexing' ? (
          <span>{pct}% embedded</span>
        ) : null}
        {repo.stars != null && <span>★ {compact(repo.stars)}</span>}
        {langs.length > 0 && <span>{langs.join(' · ')}</span>}
        {repo.indexedAt && <span className="ml-auto">{timeAgo(repo.indexedAt)}</span>}
      </div>
    </Link>
  );
}
