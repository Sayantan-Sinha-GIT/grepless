'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { rememberRepo } from '@/lib/recent';

const EXAMPLES = ['sindresorhus/ky', 'psf/requests', 'expressjs/express'];

export function RepoInput({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(input: string) {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not add that repository.');
      rememberRepo(data.repo.owner, data.repo.name);
      router.push(`/r/${data.repo.owner}/${data.repo.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that repository.');
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="flex w-full flex-col gap-2 rounded-xl border border-line-strong bg-raised p-2 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_20px_60px_-30px_rgba(0,0,0,0.6)] focus-within:border-accent sm:flex-row sm:items-center"
      >
        <label htmlFor="repo-url" className="sr-only">
          GitHub repository URL
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-1 px-2">
          <span className="shrink-0 font-mono text-sm text-faint">github.com/</span>
          <input
            id="repo-url"
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="owner/repo"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            className="h-11 min-w-0 flex-1 bg-transparent font-mono text-[15px] text-fg outline-none placeholder:text-faint"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="h-11 shrink-0 rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Opening…' : 'Index repo'}
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted">
          <span>Try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => submit(ex)}
              className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-fg hover:border-accent hover:text-accent"
            >
              {ex}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}
