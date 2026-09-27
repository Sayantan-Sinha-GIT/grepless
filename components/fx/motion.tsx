'use client';

// Small motion primitives shared by every page.
import { animate, motion, useInView, useMotionValue, useSpring, type HTMLMotionProps } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;

/** Fades + rises into view once, when scrolled to. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className = '',
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

/** Headline that rises word by word from behind a mask. */
export function SplitText({
  text,
  className = '',
  delay = 0,
  stagger = 0.06,
  highlight,
  highlightClassName = 'text-gradient italic',
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  highlight?: string[];
  highlightClassName?: string;
}) {
  const words = text.split(' ');
  return (
    <span className={className} aria-label={text} role="text">
      {words.map((word, i) => {
        const hot = highlight?.includes(word.replace(/[^\w’']/g, ''));
        return (
          <span key={i} aria-hidden="true" className="inline-block overflow-hidden pb-[0.12em] align-bottom">
            <motion.span
              className={`inline-block ${hot ? highlightClassName : ''}`}
              initial={{ y: '110%', rotate: 4 }}
              whileInView={{ y: '0%', rotate: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: EASE, delay: delay + i * stagger }}
            >
              {word}
            </motion.span>
            {i < words.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </span>
  );
}

/** Pulls toward the cursor while hovered, springs back on leave. */
export function Magnetic({
  children,
  strength = 0.35,
  className = '',
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 16 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 16 });
  return (
    <motion.div
      ref={ref}
      className={`inline-flex ${className}`}
      style={{ x, y }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * strength);
        y.set((e.clientY - r.top - r.height / 2) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/** Counts up to `value` the first time it scrolls into view. */
export function CountUp({
  value,
  duration = 1.8,
  format = (n: number) => Math.round(n).toLocaleString('en-US'),
  className = '',
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, { duration, ease: EASE, onUpdate: setShown });
    return () => controls.stop();
  }, [inView, value, duration]);
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {format(inView ? shown : 0)}
    </span>
  );
}

/** Sets --mx / --my for the .spotlight CSS on pointer move. */
export function spotlightHandlers() {
  return {
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
      e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
    },
  };
}

/** Card that tilts in 3D toward the cursor. */
export function TiltCard({
  children,
  className = '',
  max = 7,
  ...rest
}: { children: ReactNode; className?: string; max?: number } & Omit<HTMLMotionProps<'div'>, 'children'>) {
  const rx = useSpring(0, { stiffness: 200, damping: 18 });
  const ry = useSpring(0, { stiffness: 200, damping: 18 });
  return (
    <motion.div
      className={`spotlight spotlight-ring ${className}`}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
        if (e.pointerType !== 'mouse') return;
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        ry.set(px * max * 2);
        rx.set(-py * max * 2);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Types through `phrases` in a loop: type, hold, delete, next. */
export function useTypewriter(phrases: string[], { enabled = true, typeMs = 42, holdMs = 1800 } = {}) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'typing' | 'holding' | 'deleting'>('typing');

  useEffect(() => {
    if (!enabled || phrases.length === 0) return;
    const full = phrases[index % phrases.length];
    let timer: ReturnType<typeof setTimeout>;
    if (phase === 'typing') {
      if (text.length < full.length) timer = setTimeout(() => setText(full.slice(0, text.length + 1)), typeMs);
      else timer = setTimeout(() => setPhase('holding'), 10);
    } else if (phase === 'holding') {
      timer = setTimeout(() => setPhase('deleting'), holdMs);
    } else if (text.length > 0) {
      timer = setTimeout(() => setText(text.slice(0, -1)), typeMs / 2.5);
    } else {
      timer = setTimeout(() => {
        setIndex((i) => (i + 1) % phrases.length);
        setPhase('typing');
      }, 250);
    }
    return () => clearTimeout(timer);
  }, [enabled, phrases, index, text, phase, typeMs, holdMs]);

  return { text, index: index % Math.max(1, phrases.length), phase };
}
