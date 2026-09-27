import Link from 'next/link';
import { PageShell } from '@/components/chrome/PageShell';
import { Marquee } from '@/components/fx/Marquee';
import { Reveal } from '@/components/fx/motion';
import { FeatureBento } from '@/components/home/FeatureBento';
import { Hero } from '@/components/home/Hero';
import { LiveDemo } from '@/components/home/LiveDemo';
import { PipelineStrip } from '@/components/home/PipelineStrip';
import { RepoCard } from '@/components/RepoCard';
import { RepoInput } from '@/components/RepoInput';
import { languageColor } from '@/lib/client/languageColors';
import { withTimeout } from '@/lib/db';
import { getRepoBySlug, getSiteStats, listRecentRepos, publicRepo, type PublicRepo, type SiteStats } from '@/lib/repos';

export const dynamic = 'force-dynamic';

const LANGUAGES = ['TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C#', 'C++', 'Ruby', 'PHP', 'JavaScript', 'Shell', 'CSS', 'Markdown'];

const EMPTY_STATS: SiteStats = { repos: 0, chunks: 0, searches: 0, files: 0 };

async function loadHome() {
  // The landing page must render even if the database is slow: each piece
  // falls back independently after a few seconds.
  const [recent, stats, demo] = await Promise.all([
    withTimeout(listRecentRepos(6), 6000, [], 'recent repos'),
    withTimeout(getSiteStats(), 6000, EMPTY_STATS, 'site stats'),
    withTimeout(getRepoBySlug('sindresorhus', 'ky'), 6000, null, 'demo repo'),
  ]);
  return {
    recent: recent.map(publicRepo) as PublicRepo[],
    stats,
    demo:
      demo && demo.embedded_chunks > 0
        ? { id: demo.id, owner: demo.owner, name: demo.name, commitSha: demo.commit_sha }
        : null,
  };
}

export default async function Home() {
  const { recent, stats, demo } = await loadHome();

  return (
    <PageShell>
      <Hero stats={stats} />

      <div className="relative -mx-[5vw] -mt-6 w-[110vw] rotate-[-2deg] border-y border-line bg-surface/70 py-4 backdrop-blur-md">
        <Marquee duration={45}>
          {LANGUAGES.map((l) => (
            <span key={l} className="mx-6 flex items-center gap-3 font-display text-2xl font-light tracking-tight sm:text-3xl">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: languageColor(l) }} />
              {l}
            </span>
          ))}
        </Marquee>
      </div>

      <div className="mt-28 space-y-28 sm:mt-36 sm:space-y-36">
        <LiveDemo repo={demo} />
        <FeatureBento />
        <PipelineStrip />

        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <Reveal>
              <h2 className="font-display text-4xl font-light tracking-[-0.035em] sm:text-5xl">Recently indexed</h2>
            </Reveal>
            <Reveal delay={0.05}>
              <Link href="/explore" className="text-sm font-medium text-brand hover:underline">
                Explore all →
              </Link>
            </Reveal>
          </div>
          {recent.length ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((r, i) => (
                <Reveal key={r.id} delay={i * 0.06}>
                  <RepoCard repo={r} />
                </Reveal>
              ))}
            </div>
          ) : (
            <p className="sheet mt-8 p-10 text-center text-dim">Nothing indexed yet. Paste a repo above to be the first.</p>
          )}
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <div className="sheet relative overflow-hidden px-6 py-16 text-center sm:px-16 sm:py-24">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{
                  background:
                    'radial-gradient(60% 80% at 50% 110%, color-mix(in oklab, var(--brand) 35%, transparent), transparent 70%)',
                }}
              />
              <h2 className="relative mx-auto max-w-3xl font-display text-4xl font-light leading-[1.02] tracking-[-0.04em] sm:text-7xl">
                Your repo, <span className="text-gradient italic">searchable</span> in about a minute.
              </h2>
              <p className="relative mx-auto mt-5 max-w-lg text-dim">
                No sign-in, no API key, no install. Paste a public GitHub repo and start asking.
              </p>
              <div className="relative mx-auto mt-10 max-w-xl text-left">
                <RepoInput examples={false} />
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </PageShell>
  );
}
