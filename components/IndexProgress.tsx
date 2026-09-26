'use client';

import { fmt } from '@/lib/format';
import type { PublicRepo } from '@/lib/repos';

type Sample = { t: number; done: number };

const STAGES = [
  { key: 'queued', label: 'Queued' },
  { key: 'fetching', label: 'Fetch & chunk' },
  { key: 'indexing', label: 'Embed' },
  { key: 'ready', label: 'Ready' },
] as const;

function eta(samples: Sample[], remaining: number): string | null {
  if (samples.length < 3 || remaining <= 0) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const rate = (last.done - first.done) / ((last.t - first.t) / 1000);
  if (!(rate > 0)) return null;
  const s = Math.round(remaining / rate);
  if (s < 60) return `about ${Math.max(5, Math.round(s / 5) * 5)} s left`;
  return `about ${Math.round(s / 60)} min left`;
}

export function IndexProgress({
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
  if (repo.status === 'error') {
    return (
      <div role="alert" className="mt-6 rounded-xl border border-danger/40 bg-danger/5 p-5">
        <p className="font-medium text-danger">Indexing failed</p>
        <p className="mt-1 text-sm text-muted">{repo.statusMessage ?? 'Something went wrong while indexing.'}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-line-strong px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
        >
          Try again
        </button>
      </div>
    );
  }

  const activeIndex = STAGES.findIndex((s) => s.key === repo.status);
  const pct =
    repo.status === 'indexing' && repo.totalChunks
      ? Math.min(100, (repo.embeddedChunks / repo.totalChunks) * 100)
      : repo.status === 'fetching'
        ? 8
        : 2;
  const remaining = repo.totalChunks - repo.embeddedChunks;
  const eta_ = repo.status === 'indexing' ? eta(samples, remaining) : null;

  return (
    <div className="mt-6 rounded-xl border border-line bg-raised p-5">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
        {STAGES.map((s, i) => {
          const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo';
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] ${
                  state === 'done'
                    ? 'bg-ok/15 text-ok'
                    : state === 'active'
                      ? 'bg-accent text-accent-ink'
                      : 'bg-inset text-faint ring-1 ring-line'
                }`}
              >
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span className={state === 'todo' ? 'text-faint' : 'text-fg'}>{s.label}</span>
              {i < STAGES.length - 1 && <span className="mx-1 h-px w-6 bg-line-strong" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      <div
        className="mt-5 h-2 overflow-hidden rounded-full bg-inset ring-1 ring-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Indexing progress"
      >
        <div className="progress-live h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-fg">
          {repo.status === 'queued' && (repo.statusMessage ?? 'Waiting for a free indexing slot…')}
          {repo.status === 'fetching' && (repo.statusMessage ?? 'Downloading and parsing…')}
          {repo.status === 'indexing' && (
            <>
              Embedded <span className="font-mono">{fmt(repo.embeddedChunks)}</span> of{' '}
              <span className="font-mono">{fmt(repo.totalChunks)}</span> chunks
              <span className="text-muted"> · {Math.floor(pct)}%</span>
            </>
          )}
        </p>
        <p className="text-xs text-faint">
          {eta_ ?? (repo.status === 'indexing' ? 'measuring speed…' : '')}
          {repo.totalFiles > 0 && ` · ${fmt(repo.totalFiles)} files parsed, ${fmt(repo.skippedFiles)} skipped`}
        </p>
      </div>
      {repo.status === 'indexing' && (
        <p className="mt-3 text-xs text-muted">
          You can start searching now; results cover the part of the index that is ready. Keep this tab open to
          finish (if you close it, indexing resumes the next time anyone opens this page).
        </p>
      )}
      {error && <p className="mt-3 text-xs text-warn">{error}</p>}
    </div>
  );
}
