'use client';

import { motion } from 'motion/react';

// A query point drifting in empty space, with no neighbours to wire up to.
const STARS = Array.from({ length: 36 }, (_, i) => ({
  x: (i * 83) % 100,
  y: (i * 47 + 13) % 100,
  r: 0.6 + ((i * 7) % 5) * 0.25,
}));

export function LostScene({ code }: { code: string }) {
  return (
    <div className="relative mx-auto h-64 w-full max-w-xl sm:h-80" aria-hidden="true">
      <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full">
        {STARS.map((s, i) => (
          <motion.circle
            key={i}
            cx={s.x}
            cy={(s.y * 60) / 100}
            r={s.r * 0.5}
            fill="var(--brand)"
            animate={{ opacity: [0.15, 0.7, 0.15] }}
            transition={{ duration: 2 + (i % 5) * 0.6, repeat: Infinity, delay: i * 0.08 }}
          />
        ))}
        <motion.g
          animate={{ x: [0, 6, -4, 0], y: [0, -3, 2, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        >
          <circle cx="50" cy="30" r="2.2" fill="var(--lime)" />
          <motion.circle
            cx="50"
            cy="30"
            r="2"
            fill="none"
            stroke="var(--lime)"
            strokeWidth="0.4"
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            animate={{ scale: [1, 6], opacity: [0.8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          {[-40, 20, 140, 220].map((deg, i) => (
            <motion.line
              key={deg}
              x1="50"
              y1="30"
              x2={50 + Math.cos((deg * Math.PI) / 180) * 18}
              y2={30 + Math.sin((deg * Math.PI) / 180) * 18}
              stroke="var(--brand)"
              strokeWidth="0.35"
              strokeDasharray="1 1.5"
              animate={{ pathLength: [0, 1, 0], opacity: [0, 0.8, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.4 }}
            />
          ))}
        </motion.g>
      </svg>
      <p className="absolute inset-0 flex items-center justify-center font-display text-[9rem] font-bold leading-none tracking-[-0.07em] text-outline sm:text-[13rem]">
        {code}
      </p>
    </div>
  );
}
