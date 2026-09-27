import Link from 'next/link';
import { LostScene } from '@/components/chrome/LostScene';
import { PageShell } from '@/components/chrome/PageShell';
import { RepoInput } from '@/components/RepoInput';

export default function NotFound() {
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-4 pt-32 text-center sm:px-6 sm:pt-36">
        <LostScene code="404" />
        <h1 className="font-display text-4xl font-light tracking-[-0.04em] sm:text-6xl">This vector points nowhere.</h1>
        <p className="mx-auto mt-4 max-w-md text-dim">
          We searched every neighbour and found no page here. Index a repo instead, or head back home.
        </p>
        <div className="mx-auto mt-10 max-w-xl text-left">
          <RepoInput />
        </div>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" className="rounded-full bg-text px-5 py-2.5 text-sm font-semibold text-bg transition hover:opacity-85">
            Go home
          </Link>
          <Link href="/explore" className="rounded-full bg-surface px-5 py-2.5 text-sm font-semibold ring-1 ring-line transition hover:ring-brand">
            Explore repos
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
