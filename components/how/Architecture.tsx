'use client';

import { motion } from 'motion/react';
import { Reveal } from '../fx/motion';

const NODES = [
  {
    title: 'Your browser',
    meta: 'drives the job',
    items: ['POST /api/repos', '3 embed workers', 'search · explain'],
    tone: 'var(--sky)',
  },
  {
    title: 'Vercel functions',
    meta: 'Mumbai · bom1',
    items: ['prepare: tar → AST chunks', 'embed: gte-small ONNX', 'search: hybrid SQL'],
    tone: 'var(--brand)',
  },
  {
    title: 'Supabase Postgres',
    meta: 'Mumbai · ap-south-1',
    items: ['chunks.embedding vector(384)', 'HNSW + GIN indexes', 'RLS · least-privilege role'],
    tone: 'var(--lime)',
  },
];

export function Architecture() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <Reveal>
        <h2 className="max-w-3xl font-display text-4xl font-light leading-[1.02] tracking-[-0.035em] sm:text-6xl">
          Three moving parts, <span className="text-dim">all on free tiers.</span>
        </h2>
      </Reveal>
      <div className="relative mt-12 grid gap-4 md:grid-cols-3">
        <svg className="pointer-events-none absolute inset-x-0 top-1/2 hidden h-4 -translate-y-1/2 md:block" viewBox="0 0 1000 16" preserveAspectRatio="none" aria-hidden="true">
          {[0, 1].map((i) => (
            <line
              key={i}
              x1={i === 0 ? 300 : 640}
              y1="8"
              x2={i === 0 ? 360 : 700}
              y2="8"
              stroke="var(--brand)"
              strokeWidth="3"
              strokeDasharray="6 8"
              style={{ animation: 'dash 3s linear infinite' }}
            />
          ))}
        </svg>
        {NODES.map((n, i) => (
          <Reveal key={n.title} delay={i * 0.12}>
            <motion.div whileHover={{ y: -6 }} className="sheet relative h-full overflow-hidden p-6">
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: n.tone }} />
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">{n.meta}</p>
              <p className="mt-2 font-display text-2xl font-medium tracking-tight">{n.title}</p>
              <ul className="mt-5 space-y-2">
                {n.items.map((it) => (
                  <li key={it} className="flex items-center gap-2 font-mono text-xs text-dim">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: n.tone }} />
                    {it}
                  </li>
                ))}
              </ul>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
