import type { Metadata } from 'next';
import { Avatar } from '@/components/auth/AccountMenu';
import { LockScene } from '@/components/auth/LockScene';
import { SignInButton } from '@/components/auth/SignInButton';
import { PageShell } from '@/components/chrome/PageShell';
import { Reveal, SplitText } from '@/components/fx/motion';
import { MyRepos } from '@/components/me/MyRepos';
import { getViewer } from '@/lib/auth';
import { withTimeout } from '@/lib/db';
import { appConfig, authEnabled, installUrl, REVOKE_URL } from '@/lib/githubApp';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your repos',
  description: 'Sign in with GitHub to index and search your private repositories on grepless.',
};

const ERRORS: Record<string, string> = {
  cancelled: 'Sign-in was cancelled on GitHub. Nothing was shared.',
  state: 'That sign-in link expired or was opened in another tab. Please try again.',
  github: 'GitHub did not complete the sign-in. Please try again in a moment.',
  disabled: 'Sign-in is not switched on for this copy of grepless yet.',
};

const TRUST = [
  {
    title: 'Read-only',
    body: 'grepless asks GitHub for read access to code and basic repo details. It cannot push, delete, or change anything.',
  },
  {
    title: 'You choose',
    body: 'Give access to all your repositories or pick a few, on GitHub’s own page. Change it any time.',
  },
  {
    title: 'Private stays private',
    body: 'A private repo’s index is shown only to people GitHub says can read it. grepless re-checks that every hour.',
  },
];

export default async function MePage({ searchParams }: PageProps<'/me'>) {
  const sp = await searchParams;
  const enabled = authEnabled();
  const viewer = enabled ? await withTimeout(getViewer(), 4000, null, 'viewer') : null;
  const slug = appConfig()?.slug;
  const error = typeof sp.error === 'string' ? (ERRORS[sp.error] ?? ERRORS.github) : null;

  if (viewer && slug) {
    return (
      <PageShell>
        <div className="mx-auto max-w-6xl px-4 pt-32 sm:px-6 sm:pt-40">
          <Reveal className="flex items-center gap-4">
            <div className="relative">
              <div aria-hidden="true" className="absolute -inset-1.5 rounded-[1.4rem] bg-gradient-to-br from-brand to-lime opacity-60 blur-md" />
              <Avatar url={viewer.avatarUrl} login={viewer.login} className="relative h-14 w-14 rounded-[1.2rem] ring-4 ring-bg" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{viewer.name ?? viewer.login}</p>
              <p className="truncate font-mono text-xs uppercase tracking-[0.2em] text-brand">Signed in as @{viewer.login}</p>
            </div>
          </Reveal>
          <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <h1 className="max-w-4xl font-display text-[clamp(2.5rem,6.5vw,5.5rem)] font-light leading-[0.93] tracking-[-0.05em]">
              <SplitText text="Your repos, ready to question." highlight={['question']} />
            </h1>
            <Reveal delay={0.25} className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
              <a
                href={installUrl(slug)}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-text px-4 text-sm font-semibold text-bg transition hover:opacity-85"
              >
                Add or remove repos
              </a>
              <a
                href={REVOKE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center rounded-full bg-surface px-4 text-sm text-dim ring-1 ring-line transition hover:text-danger hover:ring-danger/40"
              >
                Revoke access ↗
              </a>
            </Reveal>
          </div>

          <div className="mt-12">
            <MyRepos installUrl={installUrl(slug)} justInstalled={sp.installed === '1'} />
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 pt-32 sm:px-6 sm:pt-40">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">Your repos</p>
            </Reveal>
            <h1 className="mt-4 font-display text-[clamp(2.75rem,7vw,6rem)] font-light leading-[0.93] tracking-[-0.05em]">
              <SplitText text="Search your private code too." highlight={['private']} />
            </h1>
            <Reveal delay={0.3}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-dim">
                Sign in with GitHub, pick the repositories grepless may read, and ask them questions in plain English.
                Public or private, work or personal.
              </p>
            </Reveal>
            {error && (
              <Reveal delay={0.1}>
                <p role="alert" className="mt-6 max-w-xl rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </p>
              </Reveal>
            )}
            <Reveal delay={0.4} className="mt-9 flex flex-wrap items-center gap-4">
              {enabled ? (
                <>
                  <SignInButton next="/me" size="lg" />
                  <p className="text-sm text-faint">Free · read-only · revoke any time</p>
                </>
              ) : (
                <p className="text-sm text-faint">Sign-in is not switched on for this copy of grepless yet.</p>
              )}
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <div className="sheet-ink relative overflow-hidden p-4 sm:p-8">
              <LockScene className="relative h-auto w-full" />
            </div>
          </Reveal>
        </div>

        <div className="mt-24 grid gap-4 md:grid-cols-3">
          {TRUST.map((t, i) => (
            <Reveal key={t.title} delay={i * 0.08}>
              <div className="sheet h-full rounded-3xl p-6">
                <span className="font-mono text-xs text-brand">0{i + 1}</span>
                <p className="mt-4 font-display text-2xl font-light tracking-tight">{t.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-dim">{t.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
