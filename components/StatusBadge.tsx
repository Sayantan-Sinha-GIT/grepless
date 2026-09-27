import type { RepoStatus } from '@/lib/repos';

const STYLES: Record<RepoStatus, { label: string; tone: string; live: boolean }> = {
  queued: { label: 'Queued', tone: 'text-dim bg-bg-deep', live: false },
  fetching: { label: 'Fetching', tone: 'text-warn bg-warn/10', live: true },
  indexing: { label: 'Indexing', tone: 'text-warn bg-warn/10', live: true },
  ready: { label: 'Ready', tone: 'text-ok bg-ok/10', live: false },
  error: { label: 'Error', tone: 'text-danger bg-danger/10', live: false },
};

export function StatusBadge({ status }: { status: RepoStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.tone}`}>
      <span className="relative flex h-1.5 w-1.5">
        {s.live && <span className="absolute inset-0 rounded-full bg-current" style={{ animation: 'pulse-ring 1.4s ease-out infinite' }} />}
        <span className="relative h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {s.label}
    </span>
  );
}
