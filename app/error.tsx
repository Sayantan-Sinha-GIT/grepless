'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { LostScene } from '@/components/chrome/LostScene';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 pt-32 text-center sm:px-6 sm:pt-36">
      <LostScene code="500" />
      <h1 className="font-display text-4xl font-light tracking-[-0.04em] sm:text-6xl">Something broke mid-search.</h1>
      <p className="mx-auto mt-4 max-w-md text-dim">
        The server hit an unexpected error. It&apos;s usually temporary. Try again, and if it keeps happening, come
        back in a minute.
      </p>
      <div className="mt-10 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-on-brand transition hover:brightness-110"
        >
          Try again
        </button>
        <Link href="/" className="rounded-full bg-surface px-6 py-3 text-sm font-semibold ring-1 ring-line transition hover:ring-brand">
          Go home
        </Link>
      </div>
      {error.digest && <p className="mt-6 font-mono text-xs text-faint">ref {error.digest}</p>}
    </main>
  );
}
