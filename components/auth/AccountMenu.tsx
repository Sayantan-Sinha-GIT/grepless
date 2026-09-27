'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

/** Avatar button with a small animated menu: your repos, manage access, sign out. */
export function AccountMenu() {
  const { viewer, installUrl } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const menuId = useId();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!viewer) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Account menu for ${viewer.login}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-brand/60 transition hover:ring-brand"
      >
        <Avatar url={viewer.avatarUrl} login={viewer.login} className="h-full w-full" />
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-lime ring-2 ring-bg" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            initial={{ opacity: 0, y: -8, scale: 0.94, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, scale: 0.96, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            style={{ transformOrigin: 'top right' }}
            className="sheet absolute right-0 top-12 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl p-2"
          >
            <div className="flex items-center gap-3 rounded-2xl bg-bg-deep p-3">
              <Avatar url={viewer.avatarUrl} login={viewer.login} className="h-10 w-10 rounded-xl" />
              <div className="min-w-0">
                <p className="truncate font-medium">{viewer.name ?? viewer.login}</p>
                <p className="truncate font-mono text-xs text-faint">@{viewer.login}</p>
              </div>
            </div>
            <nav aria-label="Account" className="mt-1 flex flex-col">
              <MenuLink href="/me" label="Your repos" hint="Index and search your private code" />
              {installUrl && <MenuLink href={installUrl} external label="Choose repos on GitHub" hint="Add or remove access" />}
            </nav>
            <form action="/api/auth/logout" method="post" className="mt-1 border-t border-line pt-1">
              <button
                type="submit"
                className="w-full rounded-2xl px-3 py-2.5 text-left text-sm text-danger transition hover:bg-danger/10"
              >
                Sign out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuLink({ href, label, hint, external }: { href: string; label: string; hint: string; external?: boolean }) {
  const cls = 'group flex items-center justify-between rounded-2xl px-3 py-2.5 transition hover:bg-brand-soft';
  const body = (
    <>
      <span>
        <span className="block text-sm font-medium group-hover:text-brand">{label}</span>
        <span className="block text-xs text-faint">{hint}</span>
      </span>
      <span className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true">
        {external ? '↗' : '→'}
      </span>
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}

export function Avatar({ url, login, className = '' }: { url: string | null; login: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url ?? `https://github.com/${login}.png?size=80`}
      alt=""
      width={40}
      height={40}
      className={`rounded-full bg-bg-deep object-cover ${className}`}
    />
  );
}
