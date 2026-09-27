'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import { useMemo, useRef } from 'react';
import { RepoInput } from '../RepoInput';
import { CountUp, SplitText, useTypewriter } from '../fx/motion';
import { CLUSTERS } from './demoData';
import { VectorField } from './VectorField';

export function Hero({ stats }: { stats: { repos: number; chunks: number; searches: number } }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const wordY = useTransform(scrollYProgress, [0, 1], ['0%', '40%']);
  const fieldScale = useTransform(scrollYProgress, [0, 1], [1, 1.3]);
  const fieldOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const headY = useTransform(scrollYProgress, [0, 1], ['0%', '-18%']);
  const queries = useMemo(() => CLUSTERS.map((c) => c.query), []);
  const { text, index } = useTypewriter(queries, { holdMs: 2600 });

  return (
    <section ref={ref} className="relative isolate overflow-hidden pb-24 pt-28 sm:pb-32 sm:pt-36">
      {/* Giant wordmark behind everything, drifting on scroll. */}
      <motion.div
        aria-hidden="true"
        style={{ y: wordY }}
        className="pointer-events-none absolute inset-x-0 bottom-[-7vw] -z-10 select-none text-center font-display text-[26vw] font-bold leading-none tracking-[-0.06em] text-brand/[0.06]"
      >
        grepless
      </motion.div>

      {/* The vector space: full-bleed behind the copy on phones, right half on desktop. */}
      <motion.div
        style={{ scale: fieldScale, opacity: fieldOpacity }}
        className="absolute inset-y-0 right-[-15%] -z-10 w-[130%] opacity-50 sm:right-0 sm:w-[72%] sm:opacity-100 lg:w-[58%]"
      >
        <VectorField active={index} className="h-full w-full" />
      </motion.div>

      <motion.div style={{ y: headY }} className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass mb-8 inline-flex items-center gap-2.5 rounded-full py-1.5 pl-2 pr-4 text-xs font-medium text-dim"
        >
          <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-lime">
            <span className="absolute inset-0 rounded-full bg-lime" style={{ animation: 'pulse-ring 1.8s ease-out infinite' }} />
            <span className="relative h-1.5 w-1.5 rounded-full bg-on-lime" />
          </span>
          Semantic code search · free · no sign-in
        </motion.p>

        <h1 className="max-w-5xl font-display text-[clamp(2.75rem,7.4vw,7.25rem)] font-light leading-[0.92] tracking-[-0.05em]">
          <SplitText text="Search code by meaning," delay={0.25} highlight={['meaning']} />
          <br />
          <SplitText text="not by name." delay={0.55} className="text-dim" />
        </h1>

        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1fr_22rem]">
          <div className="max-w-xl">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.8 }}
              className="text-lg leading-relaxed text-dim text-pretty"
            >
              Paste any public GitHub repo. grepless splits it into functions and classes, embeds every one, and
              finds the code you describe even when you don&apos;t know what it&apos;s called.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.8 }}
              className="mt-8"
            >
              <RepoInput />
            </motion.div>

            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 }}
              className="mt-12 grid max-w-lg grid-cols-3 gap-4"
            >
              {[
                { label: 'repos indexed', value: stats.repos },
                { label: 'chunks embedded', value: stats.chunks },
                { label: 'searches run', value: stats.searches },
              ].map((s) => (
                <div key={s.label} className="border-l border-line-strong pl-3">
                  <dt className="text-xs text-faint">{s.label}</dt>
                  <dd className="mt-1 font-display text-2xl font-medium tracking-tight sm:text-3xl">
                    <CountUp value={s.value} />
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>

          {/* The live query that drives the vector field. */}
          <motion.div
            initial={{ opacity: 0, y: 30, rotate: -3 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: 1.1, type: 'spring', stiffness: 120, damping: 18 }}
            className="glass hidden rounded-3xl p-5 lg:block"
            style={{ animation: 'float-y 6s ease-in-out infinite' }}
          >
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" /> query → embedding
            </p>
            <p className="mt-3 min-h-[3.75rem] font-display text-xl leading-snug">
              {text}
              <span className="ml-0.5 inline-block h-5 w-[2px] translate-y-0.5 animate-pulse bg-brand" />
            </p>
            <div className="mt-4 grid grid-cols-8 gap-1" aria-hidden="true">
              {Array.from({ length: 16 }, (_, i) => (
                <motion.span
                  key={`${index}-${i}`}
                  className="h-5 rounded-[5px] bg-brand"
                  initial={{ opacity: 0.1 }}
                  animate={{ opacity: [0.1, 0.25 + ((i * 37 + index * 11) % 70) / 100, 0.35 + ((i * 53 + index * 7) % 60) / 100] }}
                  transition={{ duration: 0.9, delay: i * 0.03 }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-faint">
              <span>gte-small · 384-d</span>
              <span>k = 7 nearest</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
