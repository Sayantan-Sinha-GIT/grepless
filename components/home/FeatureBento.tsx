'use client';

import { motion, useInView } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Reveal, TiltCard } from '../fx/motion';

export function FeatureBento() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="max-w-2xl">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">Under the hood</p>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-4 font-display text-4xl font-light leading-[1.02] tracking-[-0.035em] sm:text-6xl">
            A real retrieval system, <span className="text-dim">not a wrapper around chat.</span>
          </h2>
        </Reveal>
      </div>

      <div className="mt-12 grid auto-rows-[minmax(17rem,auto)] gap-4 md:grid-cols-3">
        <Tile className="md:col-span-2" delay={0} title="Chunks follow the syntax tree" body="tree-sitter parses 13 languages. Each function, method and class becomes one searchable chunk that keeps its qualified name.">
          <AstDemo />
        </Tile>
        <Tile delay={0.05} title="Hybrid ranking" body="Vector top-40 and full-text top-40, fused with Reciprocal Rank Fusion.">
          <RrfDemo />
        </Tile>
        <Tile delay={0.1} title="Says why it matched" body="Meaning, keywords or both, which words you share, and the lines to read.">
          <WhyDemo />
        </Tile>
        <Tile delay={0.15} title="Model runs in-house" body="gte-small runs inside the serverless function, so there's no embedding API and no key.">
          <ModelDemo />
        </Tile>
        <Tile delay={0.2} title="Re-index only what changed" body="Files are hashed. A new commit re-embeds only files whose content changed.">
          <DiffDemo />
        </Tile>
      </div>
    </section>
  );
}

function Tile({
  title,
  body,
  children,
  className = '',
  delay,
}: {
  title: string;
  body: string;
  children: ReactNode;
  className?: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay} className={className}>
      <TiltCard max={4} className="sheet flex h-full flex-col overflow-hidden p-6">
        <div className="relative flex min-h-[9.5rem] flex-1 items-center justify-center">{children}</div>
        <h3 className="mt-5 font-display text-xl font-medium tracking-tight">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-dim">{body}</p>
      </TiltCard>
    </Reveal>
  );
}

/** Ticks through 0..n-1 while the element is on screen. */
function useCycle(n: number, ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-40px' });
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setStep((s) => (s + 1) % n), ms);
    return () => clearInterval(id);
  }, [inView, n, ms]);
  return { ref, step, inView };
}

// ── 1. AST chunking ─────────────────────────────────────────────────────
const CODE = [
  { t: 'import { sleep } from "./time"', k: 'imp' },
  { t: '', k: '' },
  { t: 'export class Client {', k: 'a' },
  { t: '  async retry(fn, tries = 3) {', k: 'b' },
  { t: '    for (let i = 0; i < tries; i++) {', k: 'b' },
  { t: '      try { return await fn() }', k: 'b' },
  { t: '      catch { await sleep(2 ** i * 100) }', k: 'b' },
  { t: '    }', k: 'b' },
  { t: '  }', k: 'b' },
  { t: '  refresh(token) {', k: 'c' },
  { t: '    return this.auth.renew(token)', k: 'c' },
  { t: '  }', k: 'c' },
  { t: '}', k: 'a' },
];
const CHUNKS = [
  { from: 0, to: 0, label: 'imports', color: 'var(--faint)' },
  { from: 3, to: 8, label: 'method Client.retry', color: 'var(--brand)' },
  { from: 9, to: 11, label: 'method Client.refresh', color: 'var(--pink)' },
];

function AstDemo() {
  const { ref, step } = useCycle(CHUNKS.length + 2, 1300);
  return (
    <div ref={ref} className="code-ink relative w-full max-w-xl overflow-hidden rounded-2xl p-4 font-mono text-[11.5px] leading-[1.75] sm:text-[12.5px]">
      {CODE.map((line, i) => (
        <div key={i} className="relative flex gap-4 whitespace-pre">
          <span className="w-4 shrink-0 select-none text-right text-[#5a556e]">{i + 1}</span>
          <span className="overflow-hidden text-ellipsis whitespace-pre text-on-ink/85">{line.t || ' '}</span>
        </div>
      ))}
      {CHUNKS.map((c, i) => {
        const shown = step > i;
        return (
          <motion.div
            key={c.label}
            className="pointer-events-none absolute left-2 right-2 rounded-lg"
            style={{
              top: `calc(1rem + ${c.from} * 1.75em)`,
              height: `calc(${c.to - c.from + 1} * 1.75em)`,
              boxShadow: `0 0 0 1.5px ${c.color} inset`,
              background: `color-mix(in oklab, ${c.color} 12%, transparent)`,
            }}
            initial={false}
            animate={{ opacity: shown ? 1 : 0, scale: shown ? 1 : 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <span
              className="absolute -top-2.5 right-3 rounded-full px-2 py-0.5 text-[10px] font-medium text-ink"
              style={{ background: c.color }}
            >
              {c.label}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── 2. Reciprocal Rank Fusion ────────────────────────────────────────────
const SEM = ['retryDelay', 'backoff', 'shouldRetry'];
const KEY = ['shouldRetry', 'retryAfter', 'retryDelay'];
const FUSED = ['retryDelay', 'shouldRetry', 'backoff'];

function RrfDemo() {
  const { ref, step } = useCycle(3, 1700);
  const merged = step >= 1;
  return (
    <div ref={ref} className="grid w-full grid-cols-2 gap-2 font-mono text-[11px]">
      {[
        { name: 'semantic', items: SEM, tone: 'bg-brand-soft text-brand' },
        { name: 'keyword', items: KEY, tone: 'bg-lime/25 text-zest' },
      ].map((col) => (
        <div key={col.name} className="flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-widest text-faint">{col.name}</p>
          {col.items.map((it, i) => (
            <motion.span
              key={it}
              animate={{ opacity: merged ? 0.35 : 1, x: merged ? (col.name === 'semantic' ? 6 : -6) : 0 }}
              transition={{ delay: i * 0.05 }}
              className={`truncate rounded-lg px-2 py-1 ${col.tone}`}
            >
              {i + 1}. {it}
            </motion.span>
          ))}
        </div>
      ))}
      <div className="col-span-2 mt-2 flex flex-col gap-1.5">
        <p className="text-[10px] uppercase tracking-widest text-faint">fused · 1/(60+rank)</p>
        {FUSED.map((it, i) => (
          <motion.span
            key={it}
            initial={false}
            animate={{ opacity: merged ? 1 : 0, y: merged ? 0 : -8 }}
            transition={{ delay: merged ? 0.2 + i * 0.12 : 0, type: 'spring', stiffness: 300, damping: 24 }}
            className="flex justify-between rounded-lg bg-text px-2 py-1 text-bg"
          >
            <span>
              {i + 1}. {it}
            </span>
            <span className="opacity-60">{(0.0325 - i * 0.0011).toFixed(4)}</span>
          </motion.span>
        ))}
      </div>
    </div>
  );
}

// ── 3. Why this matched ─────────────────────────────────────────────────
const WHY = ['Matched', 'on', 'meaning', 'and', 'keywords:', 'shares', '“retry”', 'and', '“delay”', '—', 'see', 'lines', '151–153.'];
const HOT = new Set([2, 4, 6, 8, 11, 12]);

function WhyDemo() {
  const { ref, step } = useCycle(HOT.size + 3, 650);
  const hotList = [...HOT];
  return (
    <div ref={ref} className="text-center font-display text-lg leading-relaxed">
      {WHY.map((w, i) => {
        const on = hotList.indexOf(i) > -1 && hotList.indexOf(i) < step;
        return (
          <span key={i} className="relative mx-[0.12em] inline-block">
            <motion.span
              className="absolute inset-x-[-0.12em] bottom-[0.12em] -z-10 h-[0.5em] origin-left rounded-sm bg-lime/70"
              initial={false}
              animate={{ scaleX: on ? 1 : 0 }}
              transition={{ duration: 0.35 }}
            />
            <span className={on ? 'text-text' : 'text-dim'}>{w}</span>
          </span>
        );
      })}
    </div>
  );
}

// ── 4. Model runs in-house ───────────────────────────────────────────────
function ModelDemo() {
  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
      >
        <circle cx="50" cy="50" r="46" fill="none" stroke="var(--line-strong)" strokeDasharray="2 5" />
        <circle cx="50" cy="4" r="3" fill="var(--lime)" />
      </motion.svg>
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute inset-3"
        animate={{ rotate: -360 }}
        transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
      >
        <circle cx="50" cy="50" r="46" fill="none" stroke="var(--brand)" strokeWidth="2" strokeDasharray="40 250" strokeLinecap="round" />
      </motion.svg>
      <div className="text-center">
        <p className="font-mono text-[11px] text-faint">gte-small</p>
        <p className="font-display text-3xl font-medium tracking-tight">384</p>
        <p className="font-mono text-[10px] text-faint">dims · int8</p>
      </div>
      <span className="absolute -bottom-1 rounded-full bg-lime px-2.5 py-0.5 text-[10px] font-semibold text-on-lime">0 API keys</span>
    </div>
  );
}

// ── 5. Incremental re-index ──────────────────────────────────────────────
const FILES = [
  { path: 'src/auth.ts', changed: false },
  { path: 'src/retry.ts', changed: true },
  { path: 'src/http/client.ts', changed: false },
  { path: 'src/parse.ts', changed: true },
];

function DiffDemo() {
  const { ref, step } = useCycle(4, 1400);
  return (
    <div ref={ref} className="flex w-full flex-col gap-1.5 font-mono text-[11px]">
      {FILES.map((f, i) => {
        const done = step >= 2;
        return (
          <motion.div
            key={f.path}
            className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ring-1 ring-line"
            animate={{
              backgroundColor: f.changed && step === 1 ? 'color-mix(in oklab, var(--lime) 30%, transparent)' : 'rgba(0,0,0,0)',
            }}
            transition={{ delay: i * 0.05 }}
          >
            <span className="truncate">{f.path}</span>
            <span className={f.changed ? 'text-zest' : 'text-faint'}>
              {f.changed ? (done ? 're-embedded' : step === 1 ? 'hash changed' : 'a91f…') : done ? 'kept ✓' : 'c03e…'}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
