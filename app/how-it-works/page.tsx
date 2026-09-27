import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/chrome/PageShell';
import { Reveal, SplitText } from '@/components/fx/motion';
import { Architecture } from '@/components/how/Architecture';
import { Story } from '@/components/how/Story';

export const metadata: Metadata = {
  title: 'How it works',
  description: 'How grepless turns a GitHub repo into a searchable vector index: tarball streaming, tree-sitter chunking, local embeddings and hybrid retrieval.',
};

const NUMBERS = [
  ['384', 'dimensions per chunk'],
  ['13', 'tree-sitter grammars'],
  ['~50 ms', 'warm search latency'],
  ['0', 'API keys needed'],
];

export default function HowItWorksPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 pt-32 sm:px-6 sm:pt-40">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">How it works</p>
        </Reveal>
        <h1 className="mt-4 max-w-5xl font-display text-[clamp(2.75rem,7.5vw,6.75rem)] font-light leading-[0.92] tracking-[-0.05em]">
          <SplitText text="How grepless reads a codebase." highlight={['reads']} />
        </h1>
        <Reveal delay={0.3}>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-dim">
            Five stages, all running on free infrastructure. Scroll through them: each one is real code in the
            repository, linked below its description.
          </p>
        </Reveal>
        <Reveal delay={0.4}>
          <nav aria-label="Chapters" className="mt-8 flex flex-wrap gap-2">
            {['Fetch', 'Filter', 'Chunk', 'Embed', 'Retrieve'].map((t, i) => (
              <a
                key={t}
                href={`#step-0${i + 1}`}
                className="group flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm ring-1 ring-line transition hover:ring-brand"
              >
                <span className="font-mono text-[11px] text-brand">0{i + 1}</span>
                {t}
              </a>
            ))}
          </nav>
        </Reveal>

        <div className="mt-20">
          <Story />
        </div>
      </div>

      <div className="mt-24 space-y-28">
        <Architecture />

        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-px overflow-hidden rounded-[2.25rem] bg-line sm:grid-cols-2 lg:grid-cols-4">
            {NUMBERS.map(([v, k], i) => (
              <Reveal key={k} delay={i * 0.08} className="bg-surface p-8">
                <p className="font-display text-6xl font-light tracking-[-0.05em]">{v}</p>
                <p className="mt-2 text-sm text-dim">{k}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <Reveal>
            <h2 className="font-display text-4xl font-light tracking-[-0.04em] sm:text-6xl">
              Seen enough? <span className="text-gradient italic">Try it.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/" className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-on-brand transition hover:brightness-110">
                Index a repo
              </Link>
              <Link href="/r/sindresorhus/ky" className="rounded-full bg-surface px-6 py-3 text-sm font-semibold ring-1 ring-line transition hover:ring-brand">
                Search a demo repo
              </Link>
            </div>
          </Reveal>
        </section>
      </div>
    </PageShell>
  );
}
