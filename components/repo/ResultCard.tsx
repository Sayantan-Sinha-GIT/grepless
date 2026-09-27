'use client';

import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { highlight } from 'sugar-high';
import type { SearchHit } from '@/lib/search';
import { spotlightHandlers } from '../fx/motion';

function blobUrl(owner: string, name: string, sha: string | null, path: string, start: number, end: number) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `https://github.com/${owner}/${name}/blob/${sha ?? 'HEAD'}/${encoded}#L${start}${end !== start ? `-L${end}` : ''}`;
}

// gte-small similarities for related code sit roughly in 0.72–0.92, so the ring
// is scaled to that band; the raw cosine value is printed inside it.
function strength(sim: number) {
  return Math.max(0.06, Math.min(1, (sim - 0.7) / 0.22));
}

const KIND_TONE: Record<string, string> = {
  function: 'text-brand bg-brand-soft',
  method: 'text-brand bg-brand-soft',
  class: 'text-pink bg-pink/10',
  interface: 'text-sky bg-sky/10',
  type: 'text-sky bg-sky/10',
  test: 'text-warn bg-warn/10',
  section: 'text-dim bg-bg-deep',
  variable: 'text-zest bg-lime/15',
};

/** Wraps the quoted terms (“retry”) of a reason in marker highlights. */
function ReasonText({ text }: { text: string }) {
  const parts = text.split(/(“[^”]+”)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('“') ? (
          <mark key={i} className="marker font-medium">
            {p.slice(1, -1)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function SimilarityRing({ value, delay }: { value: number; delay: number }) {
  const s = strength(value);
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center" title={`cosine similarity ${value.toFixed(3)}`}>
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <circle cx="22" cy="22" r="18" fill="none" stroke="var(--line-strong)" strokeWidth="3" />
        <motion.circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke="var(--brand)"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: s }}
          transition={{ delay: delay + 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="font-mono text-[10.5px] font-semibold">{value.toFixed(2)}</span>
    </span>
  );
}

export function ResultCard({
  hit,
  rank,
  owner,
  name,
  commitSha,
  query,
  explain: explainOn,
}: {
  hit: SearchHit;
  rank: number;
  owner: string;
  name: string;
  commitSha: string | null;
  query: string;
  explain: boolean;
}) {
  const codeRef = useRef<HTMLDivElement>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = useMemo(() => highlight(hit.content).split('\n'), [hit.content]);
  const hl = useMemo(() => new Set(hit.highlightLines), [hit.highlightLines]);
  const dir = hit.path.includes('/') ? hit.path.slice(0, hit.path.lastIndexOf('/') + 1) : '';
  const file = hit.path.slice(dir.length);
  const url = blobUrl(owner, name, commitSha, hit.path, hit.startLine, hit.endLine);
  const firstHl = hit.highlightLines[0];
  const delay = Math.min(rank, 6) * 0.07;

  useEffect(() => {
    const box = codeRef.current;
    if (!box || !firstHl) return;
    const row = box.querySelector<HTMLElement>(`[data-line="${firstHl}"]`);
    if (row && row.offsetTop > box.clientHeight - 60) box.scrollTop = row.offsetTop - 48;
  }, [firstHl]);

  async function explain() {
    setExplaining(true);
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkId: hit.id, query }),
      });
      const data = await res.json();
      setExplanation(res.ok ? data.explanation : (data.error ?? 'Explanation unavailable.'));
      setProvider(res.ok && data.provider ? data.provider : null);
    } catch {
      setExplanation('Explanation unavailable.');
    } finally {
      setExplaining(false);
    }
  }

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 36, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, transition: { duration: 0.2 } }}
      transition={{ delay, type: 'spring', stiffness: 220, damping: 26 }}
      className="group relative grid gap-4 md:grid-cols-[4.5rem_1fr]"
    >
      <div aria-hidden="true" className="hidden select-none pt-3 font-display text-6xl font-light leading-none tracking-[-0.06em] text-outline md:block">
        {String(rank + 1).padStart(2, '0')}
      </div>

      <div {...spotlightHandlers()} className="sheet spotlight min-w-0 overflow-hidden rounded-[1.75rem]">
        <header className="flex flex-col gap-3 px-5 pb-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <a href={url} target="_blank" rel="noreferrer" className="block truncate font-mono text-[13.5px] hover:underline">
              <span className="text-faint md:hidden">#{rank + 1} </span>
              <span className="text-dim">{dir}</span>
              <span className="font-semibold text-text">{file}</span>
              <span className="text-faint">
                :{hit.startLine}–{hit.endLine}
              </span>
            </a>
            {hit.symbol && (
              <p className="mt-1.5 flex min-w-0 items-center gap-2 text-xs">
                <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono font-semibold ${KIND_TONE[hit.kind] ?? 'text-dim bg-bg-deep'}`}>
                  {hit.kind}
                </span>
                <span className="truncate font-mono text-dim">{hit.symbol}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden font-mono text-[11px] text-faint sm:inline">
              {hit.semanticRank ? `sem #${hit.semanticRank}` : 'sem —'} · {hit.keywordRank ? `kw #${hit.keywordRank}` : 'kw —'}
            </span>
            <SimilarityRing value={hit.similarity} delay={delay} />
          </div>
        </header>

        <p className="flex gap-3 border-t border-line px-5 py-3 text-sm leading-relaxed text-dim">
          <span className="mt-0.5 shrink-0 self-start rounded-md bg-lime px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-on-lime">
            why
          </span>
          <span>
            <ReasonText text={hit.reason} />
          </span>
        </p>

        <div ref={codeRef} className="code-ink relative max-h-[26rem] overflow-auto py-3 font-mono text-[12.5px] leading-[1.65]">
          {lines.map((html, i) => {
            const n = hit.startLine + i;
            const on = hl.has(n);
            return (
              <div
                key={n}
                className="code-line"
                data-line={n}
                data-hl={on}
                style={on ? { ['--i' as string]: hit.highlightLines.indexOf(n) } : undefined}
              >
                <span className="ln">{n}</span>
                <span className="src" dangerouslySetInnerHTML={{ __html: html || ' ' }} />
              </div>
            );
          })}
        </div>

        <footer className="flex flex-wrap items-center gap-2 px-4 py-3 text-xs">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-text px-3.5 py-1.5 font-semibold text-bg transition hover:opacity-85"
          >
            Open on GitHub <span aria-hidden="true">↗</span>
          </a>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(`${hit.path}:${hit.startLine}`).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              });
            }}
            className="rounded-full px-3.5 py-1.5 text-dim ring-1 ring-line transition hover:text-text hover:ring-line-strong"
          >
            {copied ? 'Copied ✓' : 'Copy path'}
          </button>
          {explainOn && (
            <button
              type="button"
              onClick={explain}
              disabled={explaining || !!explanation}
              className="group/ex inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-brand ring-1 ring-brand/40 transition hover:bg-brand-soft disabled:opacity-70"
            >
              <motion.span
                animate={explaining ? { rotate: 360 } : { rotate: 0 }}
                transition={explaining ? { duration: 1.2, repeat: Infinity, ease: 'linear' } : {}}
              >
                ✦
              </motion.span>
              <span className={explaining ? 'shimmer-text' : ''}>{explaining ? 'Thinking…' : 'Explain'}</span>
            </button>
          )}
          {explanation && (
            <motion.p
              initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              className="w-full rounded-2xl bg-brand-soft px-4 py-3 text-sm leading-relaxed text-text"
            >
              {explanation}
              {provider && (
                <span className="ml-2 font-mono text-[11px] text-faint">
                  via {provider === 'gemini' ? 'Gemini' : provider === 'groq' ? 'Groq' : 'AI Gateway'}
                </span>
              )}
            </motion.p>
          )}
        </footer>
      </div>
    </motion.article>
  );
}
