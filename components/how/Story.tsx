'use client';

import { AnimatePresence, motion, useInView } from 'motion/react';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { ChunkScene, EmbedScene, FetchScene, FilterScene, RetrieveScene } from './Scenes';

interface Chapter {
  n: string;
  title: string;
  lede: string;
  body: string;
  facts: string[];
  file: string;
  Scene: ComponentType<{ active: boolean }>;
}

const CHAPTERS: Chapter[] = [
  {
    n: '01',
    title: 'Fetch the whole repo in one request',
    lede: 'No git clone, no per-file API calls.',
    body: 'grepless downloads the default branch as a single gzip tarball and streams it through a small hand-written tar reader. The first header, a pax global record, carries the exact commit SHA, so every link it gives you is a permalink.',
    facts: ['1 HTTP request per repo', '60 MB compressed cap', 'commit SHA from the pax header'],
    file: 'lib/github.ts',
    Scene: FetchScene,
  },
  {
    n: '02',
    title: 'Throw away everything that isn’t code',
    lede: 'Dependencies and build output would drown the signal.',
    body: 'Before a file is even read into memory, its path is checked against ignore rules for dependencies, build output, lockfiles, generated files and binaries. Survivors are sniffed for null bytes and minified one-liners.',
    facts: ['node_modules · vendor · dist · .next', 'lockfiles, *.min.js, *.map, *.d.ts', '200 KB per-file cap'],
    file: 'lib/languages.ts',
    Scene: FilterScene,
  },
  {
    n: '03',
    title: 'Split along the syntax tree',
    lede: 'Chunks are functions, not arbitrary line windows.',
    body: 'tree-sitter parses 13 languages. The walker keeps each function, method and class as one chunk, merges tiny neighbours (imports, constants) and splits oversized nodes along their children. Every chunk remembers its qualified name, like Ky.#retryFromError.',
    facts: ['13 grammars in WASM', '≤ 1,500 chars per chunk', 'qualified symbol names'],
    file: 'lib/chunker.ts',
    Scene: ChunkScene,
  },
  {
    n: '04',
    title: 'Embed every chunk, in-house',
    lede: 'gte-small runs inside the serverless function.',
    body: 'Each chunk, prefixed with its path and humanised symbol name, becomes a 384-dimension unit vector from an int8-quantised ONNX model. The browser drives three workers that claim batches with FOR UPDATE SKIP LOCKED, so no request runs long and a closed tab only pauses the job.',
    facts: ['384 dims · cosine', '≈ 12 chunks/s on the free tier', '0 API keys'],
    file: 'lib/embedder.ts · lib/indexer.ts',
    Scene: EmbedScene,
  },
  {
    n: '05',
    title: 'Rank by meaning and by name',
    lede: 'Hybrid retrieval, fused without tuning score scales.',
    body: 'Your question is embedded with the same model. Postgres returns the 40 nearest chunks from an HNSW index and the 40 best full-text matches, where symbol and path words outweigh body words. Reciprocal Rank Fusion merges the two lists, and each hit explains which list found it and why.',
    facts: ['pgvector HNSW (iterative scan)', 'weighted tsvector (A/D)', 'RRF k = 60, keyword ×0.6'],
    file: 'lib/search.ts',
    Scene: RetrieveScene,
  },
];

export function Story() {
  const [active, setActive] = useState(0);
  const Scene = CHAPTERS[active].Scene;

  return (
    <div className="relative grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
      {/* Desktop: the scene is pinned while the chapters scroll past. */}
      <div className="sticky top-28 hidden h-[calc(100svh-9rem)] max-h-[40rem] lg:block">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            className="h-full"
            initial={{ opacity: 0, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
            transition={{ duration: 0.45 }}
          >
            <Scene active />
          </motion.div>
        </AnimatePresence>
        <div className="absolute -right-8 top-1/2 flex -translate-y-1/2 flex-col gap-2" aria-hidden="true">
          {CHAPTERS.map((c, i) => (
            <motion.span
              key={c.n}
              className="w-1.5 rounded-full bg-brand"
              animate={{ height: i === active ? 28 : 8, opacity: i === active ? 1 : 0.3 }}
            />
          ))}
        </div>
      </div>

      <div>
        {CHAPTERS.map((c, i) => (
          <ChapterBlock key={c.n} chapter={c} onActive={() => setActive(i)} />
        ))}
      </div>
    </div>
  );
}

function ChapterBlock({ chapter, onActive }: { chapter: Chapter; onActive: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { margin: '-45% 0px -45% 0px' });
  const seen = useInView(ref, { once: true, margin: '-20%' });
  useEffect(() => {
    if (inView) onActive();
  }, [inView, onActive]);
  const { Scene } = chapter;

  return (
    <section ref={ref} id={`step-${chapter.n}`} className="flex min-h-[85svh] scroll-mt-28 flex-col justify-center py-12 lg:py-0">
      <motion.p
        initial={{ opacity: 0, x: -20 }}
        animate={seen ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="font-display text-[7rem] font-light leading-none tracking-[-0.06em] text-outline sm:text-[9rem]"
        aria-hidden="true"
      >
        {chapter.n}
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={seen ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, delay: 0.1 }}
      >
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-brand">{chapter.lede}</p>
        <h2 className="mt-3 font-display text-4xl font-light leading-[1.02] tracking-[-0.035em] sm:text-5xl">{chapter.title}</h2>
        <p className="mt-5 max-w-xl leading-relaxed text-dim">{chapter.body}</p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {chapter.facts.map((f) => (
            <li key={f} className="rounded-full bg-surface px-3 py-1.5 font-mono text-xs ring-1 ring-line">
              {f}
            </li>
          ))}
        </ul>
        <p className="mt-5 font-mono text-xs text-faint">source → {chapter.file}</p>
      </motion.div>
      <div className="mt-8 lg:hidden">
        <Scene active={inView || seen} />
      </div>
    </section>
  );
}
