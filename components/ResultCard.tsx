'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { highlight } from 'sugar-high';
import type { SearchHit } from '@/lib/search';

function blobUrl(owner: string, name: string, sha: string | null, path: string, start: number, end: number) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `https://github.com/${owner}/${name}/blob/${sha ?? 'HEAD'}/${encoded}#L${start}${end !== start ? `-L${end}` : ''}`;
}

// gte-small similarities for related code sit roughly in 0.72–0.92, so the bar
// is scaled to that band; the raw cosine value is shown next to it.
function strength(sim: number) {
  return Math.max(0.06, Math.min(1, (sim - 0.7) / 0.22));
}

export function ResultCard({
  hit,
  rank,
  owner,
  name,
  commitSha,
  query,
  explain: explainOn,
}: {
  hit: SearchHit;
  rank: number;
  owner: string;
  name: string;
  commitSha: string | null;
  query: string;
  explain: boolean;
}) {
  const codeRef = useRef<HTMLDivElement>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const lines = useMemo(() => highlight(hit.content).split('\n'), [hit.content]);
  const hl = useMemo(() => new Set(hit.highlightLines), [hit.highlightLines]);
  const dir = hit.path.includes('/') ? hit.path.slice(0, hit.path.lastIndexOf('/') + 1) : '';
  const file = hit.path.slice(dir.length);
  const url = blobUrl(owner, name, commitSha, hit.path, hit.startLine, hit.endLine);
  const firstHl = hit.highlightLines[0];

  useEffect(() => {
    const box = codeRef.current;
    if (!box || !firstHl) return;
    const row = box.querySelector<HTMLElement>(`[data-line="${firstHl}"]`);
    if (row && row.offsetTop > box.clientHeight - 60) box.scrollTop = row.offsetTop - 48;
  }, [firstHl]);

  async function explain() {
    setExplaining(true);
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkId: hit.id, query }),
      });
      const data = await res.json();
      setExplanation(res.ok ? data.explanation : (data.error ?? 'Explanation unavailable.'));
      setProvider(res.ok && data.provider ? data.provider : null);
    } catch {
      setExplanation('Explanation unavailable.');
    } finally {
      setExplaining(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-raised">
      <header className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-xs text-faint">#{rank}</span>
          <a href={url} target="_blank" rel="noreferrer" className="min-w-0 truncate font-mono text-sm hover:underline">
            <span className="text-muted">{dir}</span>
            <span className="font-semibold text-fg">{file}</span>
            <span className="text-faint">
              :{hit.startLine}–{hit.endLine}
            </span>
          </a>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {hit.symbol && (
            <span className="max-w-[16rem] truncate rounded-md bg-inset px-2 py-0.5 font-mono text-xs text-fg ring-1 ring-line">
              <span className="text-accent">{hit.kind}</span> {hit.symbol}
            </span>
          )}
          <span className="flex items-center gap-2" title={`cosine similarity ${hit.similarity.toFixed(3)}`}>
            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-inset ring-1 ring-line">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${strength(hit.similarity) * 100}%` }} />
            </span>
            <span className="font-mono text-xs text-muted">{hit.similarity.toFixed(2)}</span>
          </span>
        </div>
      </header>

      <p className="flex gap-2 px-4 py-2.5 text-sm text-muted">
        <span className="mt-0.5 shrink-0 text-xs font-semibold uppercase tracking-wider text-accent">Why</span>
        <span>{hit.reason}</span>
      </p>

      <div ref={codeRef} className="relative max-h-[26rem] overflow-auto border-t border-line bg-inset py-2 font-mono text-[12.5px] leading-[1.6]">
        {lines.map((html, i) => {
          const n = hit.startLine + i;
          return (
            <div key={n} className="code-line" data-line={n} data-hl={hl.has(n)}>
              <span className="ln">{n}</span>
              <span className="src" dangerouslySetInnerHTML={{ __html: html || ' ' }} />
            </div>
          );
        })}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5 text-xs">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-md px-2 py-1 font-medium text-fg ring-1 ring-line hover:text-accent hover:ring-accent"
        >
          Open on GitHub ↗
        </a>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(`${hit.path}:${hit.startLine}`).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            });
          }}
          className="rounded-md px-2 py-1 text-muted ring-1 ring-line hover:text-fg"
        >
          {copied ? 'Copied' : 'Copy path'}
        </button>
        {explainOn && (
          <button
            type="button"
            onClick={explain}
            disabled={explaining || !!explanation}
            className="rounded-md px-2 py-1 text-muted ring-1 ring-line hover:text-fg disabled:opacity-60"
          >
            {explaining ? 'Explaining…' : '✦ Explain'}
          </button>
        )}
        <span className="ml-auto hidden font-mono text-faint sm:inline">
          {hit.semanticRank ? `semantic #${hit.semanticRank}` : 'semantic —'} · {hit.keywordRank ? `keyword #${hit.keywordRank}` : 'keyword —'}
        </span>
        {explanation && (
          <p className="w-full pt-1 text-sm leading-relaxed text-fg">
            {explanation}
            {provider && (
              <span className="ml-2 font-mono text-[11px] text-faint">
                via {provider === 'gemini' ? 'Gemini' : provider === 'groq' ? 'Groq' : 'AI Gateway'}
              </span>
            )}
          </p>
        )}
      </footer>
    </article>
  );
}
