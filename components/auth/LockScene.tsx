'use client';

import { motion } from 'motion/react';

// A padlock at the centre of a ring of repos. On a loop, a key point flies in,
// the shackle lifts, and the repos light up and wire themselves to the lock:
// "sign in once, and your private code joins the vector space".
const NODES = Array.from({ length: 9 }, (_, i) => {
  const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
  return { x: 200 + Math.cos(a) * 128, y: 150 + Math.sin(a) * 104, private: i % 3 !== 1 };
});

const LOOP = 5.5;
const times = [0, 0.18, 0.3, 0.8, 1];

export function LockScene({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="lock-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <motion.circle
        cx="200"
        cy="150"
        r="120"
        fill="url(#lock-glow)"
        animate={{ opacity: [0.25, 0.25, 0.9, 0.9, 0.25] }}
        transition={{ duration: LOOP, times, repeat: Infinity }}
      />

      {/* Orbit rings */}
      {[128, 96].map((r, i) => (
        <motion.ellipse
          key={r}
          cx="200"
          cy="150"
          rx={r}
          ry={r * 0.81}
          fill="none"
          stroke="var(--ink-line)"
          strokeWidth="1"
          strokeDasharray="2 6"
          style={{ transformOrigin: '200px 150px' }}
          animate={{ rotate: i ? -360 : 360 }}
          transition={{ duration: 60 + i * 20, repeat: Infinity, ease: 'linear' }}
        />
      ))}

      {/* Beams from the lock to each repo, drawn once unlocked */}
      {NODES.map((n, i) => (
        <motion.line
          key={`beam-${i}`}
          x1="200"
          y1="150"
          x2={n.x}
          y2={n.y}
          stroke={n.private ? 'var(--lime)' : 'var(--brand)'}
          strokeWidth="1.2"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: [0, 0, 1, 1, 0], opacity: [0, 0, 0.7, 0.7, 0] }}
          transition={{ duration: LOOP, times, repeat: Infinity, delay: i * 0.04 }}
        />
      ))}

      {/* Repos */}
      {NODES.map((n, i) => (
        <motion.g
          key={`node-${i}`}
          style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          animate={{ scale: [1, 1, 1.18, 1.18, 1] }}
          transition={{ duration: LOOP, times, repeat: Infinity, delay: 0.2 + i * 0.05 }}
        >
          <rect x={n.x - 17} y={n.y - 12} width="34" height="24" rx="7" fill="var(--ink-2)" stroke="var(--ink-line)" />
          <motion.rect
            x={n.x - 11}
            y={n.y - 5}
            height="3"
            rx="1.5"
            width="22"
            fill={n.private ? 'var(--lime)' : 'var(--brand)'}
            animate={{ opacity: [0.25, 0.25, 1, 1, 0.25] }}
            transition={{ duration: LOOP, times, repeat: Infinity, delay: 0.2 + i * 0.05 }}
          />
          <rect x={n.x - 11} y={n.y + 2} height="3" rx="1.5" width="14" fill="var(--ink-dim)" opacity="0.35" />
        </motion.g>
      ))}

      {/* Key point flying in */}
      <motion.circle
        r="5"
        cx="360"
        cy="40"
        fill="var(--lime)"
        initial={{ cx: 360, cy: 40, opacity: 0 }}
        animate={{ cx: [360, 205, 200, 200, 360], cy: [40, 160, 164, 164, 40], opacity: [0, 1, 0, 0, 0] }}
        transition={{ duration: LOOP, times: [0, 0.16, 0.2, 0.9, 1], repeat: Infinity }}
      />

      {/* Padlock */}
      <motion.path
        d="M180 140 v-18 a20 20 0 0 1 40 0 v18"
        fill="none"
        stroke="var(--on-ink)"
        strokeWidth="7"
        strokeLinecap="round"
        animate={{ y: [0, 0, -14, -14, 0], rotate: [0, 0, -18, -18, 0] }}
        style={{ transformOrigin: '220px 140px' }}
        transition={{ duration: LOOP, times, repeat: Infinity, ease: [0.34, 1.56, 0.64, 1] }}
      />
      <rect x="168" y="136" width="64" height="50" rx="14" fill="var(--brand)" />
      <circle cx="200" cy="157" r="6" fill="var(--on-brand)" />
      <motion.circle
        cx="200"
        cy="157"
        r="6"
        fill="var(--lime)"
        animate={{ opacity: [0, 0, 1, 1, 0] }}
        transition={{ duration: LOOP, times, repeat: Infinity }}
      />
      <rect x="197.5" y="160" width="5" height="13" rx="2.5" fill="var(--on-brand)" />
    </svg>
  );
}
