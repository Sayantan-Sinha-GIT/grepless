import type { Metadata } from 'next';
import { PageShell } from '@/components/chrome/PageShell';
import { ExploreGrid } from '@/components/explore/ExploreGrid';
import { CountUp, Reveal, SplitText } from '@/components/fx/motion';
import { RepoInput } from '@/components/RepoInput';
import { withTimeout } from '@/lib/db';
import { getSiteStats, listAllRepos, publicRepo, type SiteStats } from '@/lib/repos';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Every public GitHub repository indexed on grepless, ready to search by meaning.',
};

const EMPTY: SiteStats = { repos: 0, chunks: 0, searches: 0, files: 0 };

export default async function ExplorePage() {
  const [repos, stats] = await Promise.all([
    withTimeout(listAllRepos(200), 6000, [], 'all repos'),
    withTimeout(getSiteStats(), 6000, EMPTY, 'site stats'),
  ]);

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 pt-32 sm:px-6 sm:pt-40">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">Explore</p>
            </Reveal>
            <h1 className="mt-4 font-display text-[clamp(2.75rem,7vw,6rem)] font-light leading-[0.93] tracking-[-0.05em]">
              <SplitText text="Every repo, ready to question." highlight={['question']} />
            </h1>
          </div>
          <Reveal delay={0.2}>
            <dl className="grid grid-cols-3 gap-3">
              {[
                ['repos', stats.repos],
                ['files', stats.files],
                ['chunks', stats.chunks],
              ].map(([k, v]) => (
                <div key={k as string} className="sheet rounded-3xl p-4">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{k}</dt>
                  <dd className="mt-1 font-display text-3xl font-medium tracking-tight">
                    <CountUp value={v as number} />
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mt-10 max-w-2xl">
          <RepoInput examples={false} />
        </Reveal>

        <div className="mt-14">
          <ExploreGrid repos={repos.map(publicRepo)} />
        </div>
      </div>
    </PageShell>
  );
}
