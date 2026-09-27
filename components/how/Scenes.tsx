'use client';

// One animated scene per pipeline stage. Each loops while `active`.
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

function useTicker(active: boolean, ms: number, n: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setI((x) => (x + 1) % n), ms);
    return () => clearInterval(id);
  }, [active, ms, n]);
  return i;
}

const Frame = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div className="sheet-ink relative flex h-full min-h-[22rem] w-full flex-col overflow-hidden p-6">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-[0.35]"
      style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    />
    <p className="relative font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim">{label}</p>
    <div className="relative flex flex-1 items-center justify-center">{children}</div>
  </div>
);

// ── 01 Fetch ───────────────────────────────────────────────────────────
const STREAM = ['src/index.ts', 'src/auth.py', 'lib/router.go', 'README.md', 'src/retry.rs', 'app/page.tsx', 'core/Ky.ts'];

export function FetchScene({ active }: { active: boolean }) {
  return (
    <Frame label="GET codeload.github.com/…/tar.gz/HEAD">
      <div className="relative flex w-full items-center gap-6">
        <motion.div
          className="relative z-10 flex h-36 w-32 shrink-0 flex-col justify-between rounded-2xl bg-ink-2 p-3 ring-1 ring-ink-line"
          animate={active ? { y: [0, -6, 0] } : {}}
          transition={{ duration: 2.4, repeat: Infinity }}
        >
          <div className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-lime" />
            <span className="h-2 w-2 rounded-full bg-brand-hi" />
          </div>
          <div>
            <p className="font-mono text-[11px] text-on-ink">repo.tar.gz</p>
            <p className="mt-1 font-mono text-[9.5px] leading-snug text-ink-dim">
              pax: comment=
              <br />
              0d59458a0a58…
            </p>
          </div>
        </motion.div>
        <div className="relative h-40 flex-1 overflow-hidden">
          {active &&
            STREAM.map((f, i) => (
              <motion.span
                key={f}
                className="absolute left-0 rounded-lg bg-ink-2 px-2.5 py-1 font-mono text-[11px] text-on-ink ring-1 ring-ink-line"
                style={{ top: `${(i % 4) * 25 + 4}%` }}
                initial={{ x: '-20%', opacity: 0 }}
                animate={{ x: ['-10%', '260%'], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, delay: i * 0.45, ease: 'linear' }}
              >
                {f}
              </motion.span>
            ))}
        </div>
      </div>
    </Frame>
  );
}

// ── 02 Filter ──────────────────────────────────────────────────────────
const CANDIDATES = [
  { path: 'src/client.ts', ok: true },
  { path: 'node_modules/lodash/…', ok: false, why: 'dependency' },
  { path: 'src/auth/retry.py', ok: true },
  { path: 'package-lock.json', ok: false, why: 'lockfile' },
  { path: 'assets/logo.png', ok: false, why: 'binary' },
  { path: 'lib/router.go', ok: true },
  { path: 'dist/bundle.min.js', ok: false, why: 'minified' },
];

export function FilterScene({ active }: { active: boolean }) {
  const i = useTicker(active, 900, CANDIDATES.length);
  const c = CANDIDATES[i];
  return (
    <Frame label="checkPath() → checkContent()">
      <div className="relative flex w-full max-w-sm flex-col items-center">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={i}
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={c.ok ? { y: 120, opacity: 0 } : { x: 160, rotate: 18, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className={`rounded-xl px-3 py-1.5 font-mono text-xs ring-1 ${c.ok ? 'bg-brand/20 text-on-ink ring-brand-hi/50' : 'bg-danger/15 text-on-ink ring-danger/50'}`}
          >
            {c.path}
            {!c.ok && <span className="ml-2 text-danger">✕ {c.why}</span>}
          </motion.div>
        </AnimatePresence>
        <div className="mt-6 grid w-full grid-cols-12 gap-1" aria-hidden="true">
          {Array.from({ length: 12 }, (_, k) => (
            <span key={k} className="h-2 rounded-full bg-on-ink/15" />
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] text-ink-dim">the sieve: 30+ ignore rules, 200 KB cap, binary + minified sniffing</p>
        <div className="mt-6 flex flex-wrap justify-center gap-1.5">
          {CANDIDATES.filter((x) => x.ok).map((x, k) => (
            <motion.span
              key={x.path}
              animate={{ opacity: active ? 1 : 0.3 }}
              transition={{ delay: k * 0.1 }}
              className="rounded-lg bg-lime/15 px-2 py-1 font-mono text-[10.5px] text-lime"
            >
              ✓ {x.path}
            </motion.span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// ── 03 Chunk ───────────────────────────────────────────────────────────
const TREE = [
  { depth: 0, label: 'program' },
  { depth: 1, label: 'import_statement' },
  { depth: 1, label: 'class_declaration · Client' },
  { depth: 2, label: 'method · retry', chunk: 'var(--brand-hi)' },
  { depth: 2, label: 'method · refresh', chunk: 'var(--pink)' },
  { depth: 1, label: 'export · createClient', chunk: 'var(--lime)' },
];

export function ChunkScene({ active }: { active: boolean }) {
  const step = useTicker(active, 700, TREE.length + 3);
  return (
    <Frame label="tree-sitter → chunks">
      <div className="grid w-full gap-4 sm:grid-cols-2">
        <ul className="font-mono text-[11.5px]">
          {TREE.map((n, i) => (
            <motion.li
              key={n.label}
              initial={false}
              animate={{ opacity: step > i ? 1 : 0.2, x: step > i ? 0 : -8 }}
              className="flex items-center gap-2 py-1"
              style={{ paddingLeft: n.depth * 18 }}
            >
              <span className="text-ink-dim">{n.depth ? '└' : '◆'}</span>
              <span className={n.chunk ? 'text-on-ink' : 'text-ink-dim'}>{n.label}</span>
              {n.chunk && step > i && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="h-2 w-2 rounded-full"
                  style={{ background: n.chunk }}
                />
              )}
            </motion.li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          {TREE.filter((n) => n.chunk).map((n, i) => (
            <motion.div
              key={n.label}
              initial={false}
              animate={{ opacity: step > TREE.indexOf(n) ? 1 : 0, y: step > TREE.indexOf(n) ? 0 : 12 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              className="rounded-xl bg-ink-2 p-3 ring-1"
              style={{ boxShadow: `0 0 0 1px ${n.chunk} inset` }}
            >
              <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: n.chunk }}>
                chunk {i + 1}
              </p>
              <p className="mt-1 font-mono text-xs text-on-ink">{n.label.split(' · ')[1]}</p>
              <div className="mt-2 space-y-1">
                <span className="block h-1.5 w-4/5 rounded-full bg-on-ink/15" />
                <span className="block h-1.5 w-3/5 rounded-full bg-on-ink/10" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// ── 04 Embed ───────────────────────────────────────────────────────────
const DOTS = Array.from({ length: 42 }, (_, i) => {
  const cluster = i % 3;
  const cx = [28, 66, 44][cluster];
  const cy = [34, 42, 72][cluster];
  const a = (i * 137.5 * Math.PI) / 180;
  const r = 4 + ((i * 7) % 11);
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.8, cluster };
});
const CLUSTER_COLORS = ['var(--brand-hi)', 'var(--pink)', 'var(--lime)'];

export function EmbedScene({ active }: { active: boolean }) {
  const [vec, setVec] = useState('[0.021, -0.113, 0.087, …]');
  useEffect(() => {
    if (!active) return;
    let n = 1;
    const id = setInterval(() => {
      n++;
      const v = Array.from({ length: 3 }, (_, k) => (Math.sin(n * (k + 1.7)) * 0.2).toFixed(3));
      setVec(`[${v.join(', ')}, … ×381]`);
    }, 450);
    return () => clearInterval(id);
  }, [active]);
  return (
    <Frame label="gte-small · mean-pooled · normalised">
      <div className="flex w-full flex-col items-center gap-4">
        <svg viewBox="0 0 100 100" className="h-52 w-full max-w-sm">
          <line x1="6" y1="94" x2="98" y2="94" stroke="rgba(255,255,255,0.15)" strokeWidth="0.4" />
          <line x1="6" y1="94" x2="6" y2="4" stroke="rgba(255,255,255,0.15)" strokeWidth="0.4" />
          {DOTS.map((d, i) => (
            <motion.circle
              key={i}
              r="1.5"
              fill={CLUSTER_COLORS[d.cluster]}
              initial={false}
              animate={
                active
                  ? { cx: d.x, cy: d.y, opacity: 1 }
                  : { cx: 10 + (i % 7) * 12, cy: 90, opacity: 0.25 }
              }
              transition={{ delay: active ? i * 0.025 : 0, type: 'spring', stiffness: 80, damping: 14 }}
            />
          ))}
          {active && (
            <motion.circle
              cx="40"
              cy="40"
              r="2.4"
              fill="white"
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 1], scale: [0, 1.25, 1] }}
              transition={{ delay: 1.4 }}
            />
          )}
        </svg>
        <p className="rounded-xl bg-ink-2 px-3 py-2 font-mono text-[11px] text-lime ring-1 ring-ink-line">{vec}</p>
      </div>
    </Frame>
  );
}

// ── 05 Retrieve ────────────────────────────────────────────────────────
export function RetrieveScene({ active }: { active: boolean }) {
  const phase = useTicker(active, 1600, 3);
  const fused = [
    { name: 'calculateRetryTimingDelay', s: 2, k: 2 },
    { name: 'Ky.#calculateRetryDelay', s: 4, k: 1 },
    { name: 'Ky.#calculateDelay', s: 1, k: 14 },
  ];
  return (
    <Frame label="score = 1/(60+rank_sem) + 0.6 · 1/(60+rank_kw)">
      <div className="w-full max-w-md">
        <div className="rounded-full bg-ink-2 px-4 py-2 font-mono text-xs text-on-ink ring-1 ring-ink-line">
          “how is the delay between retries calculated?”
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-[10.5px]">
          {[
            { t: 'HNSW · cosine', items: ['#calculateDelay', 'calcRetryTiming', 'raceBodyRead', '#calcRetryDelay'], c: 'text-brand-hi' },
            { t: 'GIN · ts_rank_cd', items: ['#calcRetryDelay', 'calcRetryTiming', 'retryFromError', 'retry-timing.md'], c: 'text-lime' },
          ].map((col) => (
            <div key={col.t} className="rounded-2xl bg-ink-2 p-3 ring-1 ring-ink-line">
              <p className={`text-[9.5px] uppercase tracking-widest ${col.c}`}>{col.t}</p>
              {col.items.map((it, i) => (
                <motion.p
                  key={it}
                  animate={{ opacity: phase >= 1 ? 0.35 : 1 }}
                  className="mt-1.5 truncate text-on-ink"
                >
                  {i + 1}. {it}
                </motion.p>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1.5">
          {fused.map((f, i) => (
            <motion.div
              key={f.name}
              initial={false}
              animate={{ opacity: phase >= 1 ? 1 : 0, y: phase >= 1 ? 0 : -10 }}
              transition={{ delay: phase >= 1 ? i * 0.15 : 0 }}
              className="flex items-center justify-between rounded-xl bg-on-ink px-3 py-2 font-mono text-[11px] text-ink"
            >
              <span className="truncate">
                {i + 1}. {f.name}
              </span>
              <span className="shrink-0 opacity-60">
                sem #{f.s} · kw #{f.k}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </Frame>
  );
}
