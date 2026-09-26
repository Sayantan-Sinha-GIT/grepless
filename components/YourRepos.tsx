'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readRecent, type RecentEntry } from '@/lib/recent';

export function YourRepos() {
  const [items, setItems] = useState<RecentEntry[]>([]);
  useEffect(() => setItems(readRecent()), []);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">You opened</span>
      {items.slice(0, 6).map((e) => (
        <Link
          key={`${e.owner}/${e.name}`}
          href={`/r/${e.owner}/${e.name}`}
          className="rounded-md bg-raised px-2 py-1 font-mono text-xs text-fg ring-1 ring-line hover:ring-accent"
        >
          {e.owner}/{e.name}
        </Link>
      ))}
    </div>
  );
}
