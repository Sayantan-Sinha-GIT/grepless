'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Reveal } from '../fx/motion';

export const STAGES = [
  { n: '01', title: 'Fetch', meta: 'one tarball · streamed', color: 'var(--sky)' },
  { n: '02', title: 'Filter', meta: 'no deps · no binaries', color: 'var(--pink)' },
  { n: '03', title: 'Chunk', meta: 'tree-sitter AST', color: 'var(--brand)' },
  { n: '04', title: 'Embed', meta: 'gte-small · 384-d', color: 'var(--lime)' },
  { n: '05', title: 'Retrieve', meta: 'HNSW ⊕ full-text · RRF', color: 'var(--brand-hi)' },
];

export function PipelineStrip() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <Reveal>
          <h2 className="max-w-xl font-display text-4xl font-light leading-[1.02] tracking-[-0.035em] sm:text-5xl">
            From URL to answer in <span className="text-gradient italic">five</span> steps.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <Link
            href="/how-it-works"
            className="group inline-flex items-center gap-2 rounded-full bg-text px-5 py-2.5 text-sm font-semibold text-bg"
          >
            See how it works
            <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">
              →
            </span>
          </Link>
        </Reveal>
      </div>

      <div className="relative mt-12">
        {/* The beam that runs through every stage. */}
        <svg className="absolute left-0 right-0 top-[2.1rem] hidden h-2 w-full md:block" preserveAspectRatio="none" viewBox="0 0 1000 8" aria-hidden="true">
          <line x1="40" y1="4" x2="960" y2="4" stroke="var(--line-strong)" strokeWidth="1.5" strokeDasharray="4 6" />
          <motion.line
            x1="40"
            y1="4"
            x2="960"
            y2="4"
            stroke="url(#beam)"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 2.2, ease: [0.65, 0, 0.35, 1] }}
          />
          <defs>
            <linearGradient id="beam" x1="0" x2="1">
              <stop offset="0" stopColor="var(--sky)" />
              <stop offset="0.5" stopColor="var(--brand)" />
              <stop offset="1" stopColor="var(--lime)" />
            </linearGradient>
          </defs>
        </svg>

        <ol className="relative grid gap-3 md:grid-cols-5">
          {STAGES.map((s, i) => (
            <motion.li
              key={s.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.25 + i * 0.35, type: 'spring', stiffness: 160, damping: 20 }}
              className="flex items-center gap-4 md:flex-col md:items-start"
            >
              <span className="relative flex h-[4.2rem] w-[4.2rem] shrink-0 items-center justify-center rounded-full bg-surface font-mono text-sm shadow-[0_18px_40px_-20px_rgb(var(--shadow-rgb)/0.6)] ring-1 ring-line">
                <motion.span
                  className="absolute inset-0 rounded-full"
                  style={{ boxShadow: `0 0 0 2px ${s.color} inset` }}
                  initial={{ opacity: 0, scale: 0.6 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.45 + i * 0.35 }}
                />
                <span style={{ color: s.color }} className="font-semibold">
                  {s.n}
                </span>
              </span>
              <div>
                <p className="font-display text-xl font-medium tracking-tight">{s.title}</p>
                <p className="mt-0.5 font-mono text-xs text-faint">{s.meta}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
