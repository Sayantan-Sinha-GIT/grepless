'use client';

import Lenis from 'lenis';
import { MotionConfig } from 'motion/react';
import { useEffect } from 'react';

// Smooth, weighted scrolling (skipped for reduced motion and on touch, where
// native scrolling already feels right) plus a global motion policy.
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.11, anchors: { offset: -90 } });
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    return () => lenis.destroy();
  }, []);

  return (
    <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
      {children}
    </MotionConfig>
  );
}
