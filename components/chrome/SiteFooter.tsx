'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { LogoMark } from './Logo';
import { SOURCE_URL } from './SiteHeader';

const LETTERS = 'grepless'.split('');

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-32 max-w-[88rem] px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="sheet-ink relative overflow-hidden px-6 pb-6 pt-14 sm:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-1/2 left-1/2 h-[40rem] w-[60rem] -translate-x-1/2 rounded-full opacity-50 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #6b4ef0 0%, transparent 60%)' }}
        />
        <div className="relative grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <LogoMark size={40} />
            <p className="mt-5 max-w-sm font-display text-2xl font-light leading-snug">
              Semantic code search that shows its working.
            </p>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim">Pages</p>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                ['/', 'Home'],
                ['/explore', 'Explore repos'],
                ['/how-it-works', 'How it works'],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-on-ink/80 transition hover:text-lime">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim">Built with</p>
            <ul className="mt-4 flex flex-wrap gap-2 text-xs">
              {['tree-sitter', 'gte-small', 'ONNX Runtime', 'pgvector HNSW', 'Supabase', 'Next.js 16', 'Vercel'].map((t) => (
                <li key={t} className="rounded-full px-3 py-1 text-on-ink/80 ring-1 ring-ink-line">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p aria-hidden="true" className="relative mt-16 flex select-none justify-center overflow-hidden font-display text-[21vw] font-bold leading-[1] tracking-[-0.06em] pb-[0.08em] sm:text-[17vw] xl:text-[15rem]">
          {LETTERS.map((l, i) => (
            <motion.span
              key={i}
              className="inline-block bg-gradient-to-b from-on-ink/90 to-on-ink/10 bg-clip-text text-transparent"
              initial={{ y: '100%' }}
              whileInView={{ y: '0%' }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: '-8%' }}
            >
              {l}
            </motion.span>
          ))}
        </p>

        <div className="relative mt-6 flex flex-col gap-3 border-t border-ink-line pt-5 text-xs text-ink-dim sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Sayantan Sinha · MIT licensed</p>
          <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="transition hover:text-lime">
            github.com/Sayantan-Sinha-GIT/grepless ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
