'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useInView } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { highlight } from 'sugar-high';
import type { SearchHit } from '@/lib/search';
import { Reveal } from '../fx/motion';

const QUERIES = [
  'how is the delay between retries calculated?',
  'abort a request after a timeout',
  'merge headers from two requests',
];

interface DemoRepo {
  id: string;
  owner: string;
  name: string;
  commitSha: string | null;
}

export function LiveDemo({ repo }: { repo: DemoRepo | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-120px' });
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [typed, setTyped] = useState('');
  const [results, setResults] = useState<Record<number, SearchHit[] | 'error'>>({});
  const [took, setTook] = useState<Record<number, number>>({});
  const requested = useRef(new Set<number>());

  // Type the active query, then fetch (once per query).
  useEffect(() => {
    if (!inView) return;
    const full = QUERIES[active];
    let i = 0;
    setTyped('');
    const id = setInterval(() => {
      i++;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 28);
    if (repo && !requested.current.has(active)) {
      requested.current.add(active);
      const idx = active;
      fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId: repo.id, query: full }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { hits: SearchHit[]; tookMs: number }) => {
          setResults((prev) => ({ ...prev, [idx]: d.hits.slice(0, 3) }));
          setTook((prev) => ({ ...prev, [idx]: d.tookMs }));
        })
        .catch(() => setResults((prev) => ({ ...prev, [idx]: 'error' })));
    }
    return () => clearInterval(id);
  }, [active, inView, repo]);

  // Auto-advance until the visitor picks a query themselves.
  useEffect(() => {
    if (!inView || pinned) return;
    const id = setTimeout(() => setActive((a) => (a + 1) % QUERIES.length), 7500);
    return () => clearTimeout(id);
  }, [active, inView, pinned]);

  const current = results[active];
  const typingDone = typed.length === QUERIES[active].length;

  return (
    <section className="mx-auto max-w-6xl px-3 sm:px-6">
      <div ref={ref} className="sheet-ink relative overflow-hidden px-5 py-12 sm:px-12 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full opacity-40 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #6b4ef0, transparent 65%)' }}
        />
        <div className="relative grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Reveal>
              <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-lime">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 rounded-full bg-lime" style={{ animation: 'pulse-ring 1.6s ease-out infinite' }} />
                  <span className="relative h-2 w-2 rounded-full bg-lime" />
                </span>
                Live · real results
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-5 font-display text-4xl font-light leading-[1.02] tracking-[-0.035em] sm:text-6xl">
                Ask a real codebase a real question.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-sm text-ink-dim">
                These results come from the live index of{' '}
                <span className="font-mono text-on-ink">{repo ? `${repo.owner}/${repo.name}` : 'a demo repo'}</span>{' '}
                right now. None of them are canned.
              </p>
            </Reveal>
            <div className="mt-8 flex flex-col gap-2" role="tablist" aria-label="Example questions">
              {QUERIES.map((q, i) => (
                <button
                  key={q}
                  type="button"
                  role="tab"
                  aria-selected={active === i}
                  onClick={() => {
                    setPinned(true);
                    setActive(i);
                  }}
                  className={`group relative overflow-hidden rounded-2xl px-4 py-3 text-left text-sm transition-colors ${
                    active === i ? 'text-on-ink' : 'text-ink-dim hover:text-on-ink'
                  }`}
                >
                  {active === i && (
                    <motion.span layoutId="demo-tab" className="absolute inset-0 rounded-2xl bg-ink-2 ring-1 ring-ink-line" />
                  )}
                  <span className="relative flex items-center gap-3">
                    <span className="font-mono text-[11px] text-ink-dim">0{i + 1}</span>
                    {q}
                  </span>
                  {active === i && !pinned && inView && (
                    <motion.span
                      key={`bar-${i}`}
                      className="absolute bottom-0 left-0 h-[2px] bg-lime"
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 7.5, ease: 'linear' }}
                    />
                  )}
                </button>
              ))}
            </div>
            {repo && (
              <Link
                href={`/r/${repo.owner}/${repo.name}`}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-semibold text-on-lime transition hover:brightness-105"
              >
                Open the {repo.name} workspace <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-3 rounded-full bg-ink-2 px-5 py-3.5 ring-1 ring-ink-line">
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-ink-dim" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m13 13 4 4" strokeLinecap="round" />
              </svg>
              <span className="min-w-0 flex-1 truncate font-mono text-sm">
                {typed}
                <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-lime" />
              </span>
              <span className="hidden shrink-0 font-mono text-[11px] text-ink-dim sm:inline">
                {typingDone && took[active] != null ? `${took[active]} ms` : 'hybrid · RRF'}
              </span>
            </div>

            <div className="mt-4 flex min-h-[24rem] flex-col gap-3">
              <AnimatePresence mode="popLayout">
                {!repo || current === 'error' ? (
                  <motion.p
                    key="unavailable"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-2xl border border-dashed border-ink-line p-8 text-center text-sm text-ink-dim"
                  >
                    The demo index is warming up. Paste a repo above to try it on your own code.
                  </motion.p>
                ) : !current || !typingDone ? (
                  [0, 1, 2].map((i) => (
                    <motion.div
                      key={`sk-${active}-${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="h-28 rounded-2xl bg-ink-2 ring-1 ring-ink-line"
                      style={{
                        backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.6s linear infinite',
                      }}
                    />
                  ))
                ) : (
                  current.map((hit, i) => (
                    <DemoHit key={`${active}-${hit.id}`} hit={hit} rank={i} repo={repo} />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DemoHit({ hit, rank, repo }: { hit: SearchHit; rank: number; repo: DemoRepo }) {
  const lines = useMemo(() => {
    const all = hit.content.split('\n');
    const hlStart = hit.highlightLines[0] ? hit.highlightLines[0] - hit.startLine : 0;
    const from = Math.max(0, Math.min(hlStart - 1, all.length - 5));
    return { from, html: highlight(all.slice(from, from + 5).join('\n')).split('\n') };
  }, [hit]);
  const url = `https://github.com/${repo.owner}/${repo.name}/blob/${repo.commitSha ?? 'HEAD'}/${hit.path}#L${hit.startLine}-L${hit.endLine}`;
  const strength = Math.max(0.08, Math.min(1, (hit.similarity - 0.7) / 0.22));

  return (
    <motion.a
      layout
      href={url}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ delay: rank * 0.09, type: 'spring', stiffness: 260, damping: 26 }}
      className="code-ink group block overflow-hidden rounded-2xl ring-1 ring-ink-line transition hover:ring-brand"
    >
      <div className="flex items-center justify-between gap-3 border-b border-ink-line px-4 py-2.5">
        <p className="min-w-0 truncate font-mono text-xs">
          <span className="text-ink-dim">#{rank + 1} </span>
          <span className="text-on-ink">{hit.path}</span>
          <span className="text-ink-dim">:{hit.startLine}</span>
        </p>
        <span className="flex shrink-0 items-center gap-2">
          <span className="h-1 w-12 overflow-hidden rounded-full bg-ink-2">
            <motion.span
              className="block h-full rounded-full bg-lime"
              initial={{ width: 0 }}
              animate={{ width: `${strength * 100}%` }}
              transition={{ delay: 0.3 + rank * 0.09, duration: 0.8 }}
            />
          </span>
          <span className="font-mono text-[11px] text-ink-dim">{hit.similarity.toFixed(2)}</span>
        </span>
      </div>
      {hit.symbol && (
        <p className="px-4 pt-2.5 font-mono text-[11px] text-brand-hi">
          {hit.kind} {hit.symbol.split(', ')[0]}
        </p>
      )}
      <div className="overflow-hidden px-1 py-2 font-mono text-[11.5px] leading-[1.65]">
        {lines.html.map((html, i) => (
          <div key={i} className="code-line" data-hl={hit.highlightLines.includes(hit.startLine + lines.from + i)} style={{ ['--i' as string]: i }}>
            <span className="ln">{hit.startLine + lines.from + i}</span>
            <span className="src truncate" dangerouslySetInnerHTML={{ __html: html || ' ' }} />
          </div>
        ))}
      </div>
    </motion.a>
  );
}
