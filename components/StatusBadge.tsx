import type { RepoStatus } from '@/lib/repos';

const STYLES: Record<RepoStatus, { label: string; dot: string; text: string }> = {
  queued: { label: 'Queued', dot: 'bg-faint', text: 'text-muted' },
  fetching: { label: 'Fetching', dot: 'bg-warn animate-pulse', text: 'text-warn' },
  indexing: { label: 'Indexing', dot: 'bg-warn animate-pulse', text: 'text-warn' },
  ready: { label: 'Ready', dot: 'bg-ok', text: 'text-ok' },
  error: { label: 'Error', dot: 'bg-danger', text: 'text-danger' },
};

export function StatusBadge({ status }: { status: RepoStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
