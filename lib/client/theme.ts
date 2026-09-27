'use client';

// The theme lives on <html data-theme>. The boot script in the layout sets it
// before first paint (stored choice, else the OS setting); this module reads it
// with useSyncExternalStore so nothing is copied into React state.
import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY as KEY } from '../themeScript';

export type Theme = 'light' | 'dark';
const EVENT = 'grepless-theme-change';

function read(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => 'dark');
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // private mode: the choice just isn't remembered
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Switches theme with a circular reveal that grows from (x, y). */
export function setTheme(next: Theme, origin?: { x: number; y: number }) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduce || !origin) {
    apply(next);
    return;
  }
  const root = document.documentElement;
  root.classList.add('theme-vt');
  const { x, y } = origin;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const vt = doc.startViewTransition(() => apply(next));
  vt.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 750, easing: 'cubic-bezier(0.7, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => {});
  vt.finished.finally(() => root.classList.remove('theme-vt'));
}

/** Reads a CSS custom property (for canvas drawing that must follow the theme). */
export function cssVar(name: string, fallback = '#888'): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
