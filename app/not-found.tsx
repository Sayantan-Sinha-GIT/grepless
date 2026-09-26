import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="mt-2 text-2xl font-semibold">That page doesn&apos;t exist</h1>
      <p className="mt-3 text-muted">Check the repository name, or start from the home page.</p>
      <Link href="/" className="mt-6 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
        Go home
      </Link>
    </main>
  );
}
