import Link from 'next/link';
import { LockScene } from './LockScene';
import { SignInButton } from './SignInButton';

// Shown instead of a repo page when this visitor may not see it. The wording
// is the same whether the repo is private or does not exist, like GitHub's 404.
export function PrivateGate({ slug, signedIn, message }: { slug: string; signedIn: boolean; message: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-32 text-center sm:px-6 sm:pt-36">
      <div className="sheet-ink mx-auto max-w-md overflow-hidden p-4">
        <LockScene className="h-auto w-full" />
      </div>
      <p className="mt-10 font-mono text-sm text-faint">{slug}</p>
      <h1 className="mt-2 font-display text-4xl font-light tracking-[-0.04em] sm:text-6xl">
        {signedIn ? 'Not one of yours.' : 'Private, or nowhere.'}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-dim">{message}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {signedIn ? (
          <Link href="/me" className="rounded-full bg-text px-5 py-2.5 text-sm font-semibold text-bg transition hover:opacity-85">
            Open your repos
          </Link>
        ) : (
          <SignInButton size="md" />
        )}
        <Link href="/explore" className="rounded-full bg-surface px-5 py-2.5 text-sm font-semibold ring-1 ring-line transition hover:ring-brand">
          Explore public repos
        </Link>
      </div>
    </div>
  );
}
