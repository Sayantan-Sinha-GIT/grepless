'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { rememberRepo } from '@/lib/recent';
import { useAuth } from './auth/AuthContext';
import { SignInButton } from './auth/SignInButton';
import { Magnetic } from './fx/motion';

const EXAMPLES = ['sindresorhus/ky', 'psf/requests', 'expressjs/express'];

export function RepoInput({
  autoFocus = false,
  examples = true,
  tone = 'default',
}: {
  autoFocus?: boolean;
  examples?: boolean;
  tone?: 'default' | 'ink';
}) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const auth = useAuth();
  const [shake, setShake] = useState(0);
  const inputId = `repo-url-${useId()}`;

  async function submit(input: string) {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    setNeedsAuth(false);
    try {
      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNeedsAuth(Boolean(data.needsAuth));
        throw new Error(data.error ?? 'Could not add that repository.');
      }
      rememberRepo(data.repo.owner, data.repo.name);
      router.push(`/r/${data.repo.owner}/${data.repo.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that repository.');
      setShake((s) => s + 1);
      setBusy(false);
    }
  }

  const ink = tone === 'ink';

  return (
    <div className="w-full">
      <motion.div
        key={shake}
        animate={shake ? { x: [0, -10, 9, -6, 4, 0] } : undefined}
        transition={{ duration: 0.45 }}
        className="glow-frame rounded-full"
      >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className={`relative flex w-full items-center gap-2 rounded-full p-1.5 pl-5 ${
          ink ? 'bg-ink-2 text-on-ink' : 'bg-surface shadow-[0_24px_60px_-30px_rgb(var(--shadow-rgb)/0.45)]'
        }`}
      >
        <label htmlFor={inputId} className="sr-only">
          GitHub repository URL
        </label>
        <GitHubGlyph className={`h-5 w-5 shrink-0 ${ink ? 'text-ink-dim' : 'text-faint'}`} />
        <span className={`hidden shrink-0 font-mono text-sm sm:inline ${ink ? 'text-ink-dim' : 'text-faint'}`}>
          github.com/
        </span>
        <input
          id={inputId}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="owner/repo"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          className={`h-12 min-w-0 flex-1 bg-transparent font-mono text-[15px] outline-none ${
            ink ? 'placeholder:text-ink-dim/70' : 'text-text placeholder:text-faint'
          }`}
        />
        <Magnetic strength={0.25}>
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="group flex h-12 shrink-0 items-center gap-2 rounded-full bg-brand pl-5 pr-2 text-sm font-semibold text-on-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="hidden sm:inline">{busy ? 'Opening…' : 'Index repo'}</span>
            <span className="sm:hidden">{busy ? '…' : 'Go'}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-on-brand/15 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-rotate-45">
              {busy ? <Spinner /> : <ArrowIcon />}
            </span>
          </button>
        </Magnetic>
      </form>
      </motion.div>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="err"
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex flex-wrap items-center gap-3 pl-5"
          >
            <p className="text-sm text-danger">{error}</p>
            {needsAuth && auth.enabled && !auth.viewer && <SignInButton size="sm" next="/me" />}
          </motion.div>
        ) : examples ? (
          <motion.div
            key="examples"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`mt-4 flex flex-wrap items-center gap-2 pl-2 text-sm ${ink ? 'text-ink-dim' : 'text-dim'}`}
          >
            <span>Try</span>
            {EXAMPLES.map((ex, i) => (
              <motion.button
                key={ex}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 + i * 0.08 }}
                whileHover={{ y: -2 }}
                onClick={() => submit(ex)}
                className={`rounded-full px-3 py-1 font-mono text-xs ring-1 transition-colors ${
                  ink
                    ? 'text-on-ink ring-ink-line hover:ring-lime hover:text-lime'
                    : 'bg-surface/70 text-text ring-line hover:text-brand hover:ring-brand'
                }`}
              >
                {ex}
              </motion.button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 10h11M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M10 3a7 7 0 1 1-7 7" strokeLinecap="round" />
    </svg>
  );
}

function GitHubGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
