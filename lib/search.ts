// Hybrid retrieval: the query is embedded with the same model as the chunks,
// the top-40 by cosine distance (HNSW) and the top-40 by full-text rank (GIN)
// are fused with Reciprocal Rank Fusion, and each hit gets a plain-English
// reason built from the ranks and the words it shares with the query.

import { LIMITS } from './config';
import { db } from './db';
import { embedOne, toVectorLiteral } from './embedder';
import { queryTerms, splitIdentifiers, stem, toTsQuery, type QueryTerm } from './text';

const RRF_K = 60;
const KEYWORD_WEIGHT = 0.6;
const CANDIDATES = 40;
const TEST_PATH_RE = '(^|/)(tests?|__tests__|specs?|e2e|benchmarks?)/|[._-](test|spec)s?\\.[a-z]+$';
const TEST_PRIOR = 0.8;
const DOCS_PRIOR = 0.9;

interface Row {
  id: string;
  path: string;
  language: string;
  symbol: string | null;
  kind: string;
  start_line: number;
  end_line: number;
  content: string;
  similarity: number;
  semantic_rank: number | null;
  keyword_rank: number | null;
  score: number;
}

export interface SearchHit {
  id: string;
  path: string;
  language: string;
  symbol: string | null;
  kind: string;
  startLine: number;
  endLine: number;
  content: string;
  similarity: number;
  semanticRank: number | null;
  keywordRank: number | null;
  score: number;
  matchedTerms: string[];
  highlightLines: number[]; // absolute line numbers worth highlighting
  reason: string;
}

export async function searchRepo(repoId: string, query: string, languages: string[] = []): Promise<SearchHit[]> {
  const sql = db();
  const terms = queryTerms(query);
  const tsQuery = toTsQuery(terms);
  const vector = toVectorLiteral(await embedOne(query));
  const langFilter = languages.length ? sql`and language = any(${sql.array(languages)}::text[])` : sql``;

  const rows = await sql.begin(async (tx) => {
    // pgvector ≥ 0.8: keep scanning the HNSW graph until enough rows pass the repo filter.
    await tx`set local hnsw.iterative_scan = relaxed_order`;
    await tx`set local hnsw.ef_search = 100`;
    return tx<Row[]>`
      with semantic as (
        select id, row_number() over (order by dist) as rnk
        from (
          select id, embedding <=> ${vector}::extensions.vector as dist
          from chunks
          where repo_id = ${repoId} and embedding is not null ${langFilter}
          order by embedding <=> ${vector}::extensions.vector
          limit ${CANDIDATES}
        ) nearest
      ),
      keyword as (
        ${
          tsQuery
            ? tx`
          select id, row_number() over (order by rank desc) as rnk
          from (
            select id, ts_rank_cd(fts, q) as rank
            from chunks, to_tsquery('english', ${tsQuery}) as q
            where repo_id = ${repoId} and fts @@ q ${langFilter}
            order by rank desc
            limit ${CANDIDATES}
          ) matches`
            : tx`select null::bigint as id, null::bigint as rnk where false`
        }
      ),
      fused as (
        select coalesce(s.id, k.id) as id, s.rnk as semantic_rank, k.rnk as keyword_rank,
               coalesce(1.0 / (${RRF_K}::int + s.rnk), 0) + ${KEYWORD_WEIGHT}::float8 * coalesce(1.0 / (${RRF_K}::int + k.rnk), 0) as score
        from semantic s full outer join keyword k on s.id = k.id
      )
      select c.id, c.path, c.language, c.symbol, c.kind, c.start_line, c.end_line, c.content,
             f.semantic_rank::int, f.keyword_rank::int,
             -- Path prior: prefer implementation over tests and prose when scores are close.
             (f.score * case
                when c.path ~* ${TEST_PATH_RE} then ${TEST_PRIOR}::float8
                when c.language = 'Markdown' then ${DOCS_PRIOR}::float8
                else 1.0::float8 end)::float8 as score,
             case when c.embedding is null then 0
                  else (1 - (c.embedding <=> ${vector}::extensions.vector))::float8 end as similarity
      from fused f join chunks c on c.id = f.id
      order by score desc
      limit ${LIMITS.searchResults}`;
  });

  await sql`update repos set search_count = search_count + 1, last_searched_at = now() where id = ${repoId}`;

  return rows.map((r) => explain(r, terms));
}

// ---------------------------------------------------------------------------
// "Why this matched"

function termHits(tokens: string[], terms: QueryTerm[]): Set<string> {
  const hits = new Set<string>();
  for (const token of tokens) {
    const t = stem(token);
    for (const term of terms) {
      if (t === term.stem || (term.stem.length >= 4 && t.startsWith(term.stem)) || (t.length >= 4 && term.stem.startsWith(t))) {
        hits.add(term.word);
      }
    }
  }
  return hits;
}

function list(words: string[]): string {
  const quoted = words.slice(0, 4).map((w) => `“${w}”`);
  if (quoted.length <= 1) return quoted.join('');
  return `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`;
}

function explain(r: Row, terms: QueryTerm[]): SearchHit {
  const lines = r.content.split('\n');
  const perLine = lines.map((l) => termHits(splitIdentifiers(l), terms));
  const matched = new Set<string>([
    ...termHits(splitIdentifiers(r.path), terms),
    ...termHits(splitIdentifiers(r.symbol ?? ''), terms),
    ...perLine.flatMap((s) => [...s]),
  ]);

  // Highlight the 3-line window that covers the most distinct query terms.
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < lines.length; i++) {
    const window = new Set([...(perLine[i] ?? []), ...(perLine[i + 1] ?? []), ...(perLine[i + 2] ?? [])]);
    if (window.size > bestScore) {
      bestScore = window.size;
      best = i;
    }
  }
  const highlightLines: number[] = [];
  if (best >= 0) {
    for (let i = best; i < Math.min(best + 3, lines.length); i++) {
      if (perLine[i].size) highlightLines.push(r.start_line + i);
    }
  }

  const words = [...matched];
  const where = r.symbol ? `${r.kind} ${r.symbol.split(', ')[0]}` : `this ${r.kind === 'file' ? 'file' : 'block'}`;
  let reason: string;
  if (r.semantic_rank && r.keyword_rank) {
    reason = `Matched on meaning and keywords: ${where} is #${r.semantic_rank} by embedding similarity and shares ${list(words) || 'terms'} with your question.`;
  } else if (r.semantic_rank) {
    reason = words.length
      ? `Matched on meaning (#${r.semantic_rank} by embedding similarity); ${where} also mentions ${list(words)}.`
      : `Matched on meaning only (#${r.semantic_rank} by embedding similarity): no shared keywords, but ${where} is close to your question in embedding space.`;
  } else {
    reason = `Keyword match (#${r.keyword_rank} by full-text rank) on ${list(words) || 'your terms'}; weaker semantic similarity.`;
  }
  if (highlightLines.length) {
    const first = highlightLines[0];
    const last = highlightLines[highlightLines.length - 1];
    reason += first === last ? ` See line ${first}.` : ` See lines ${first}–${last}.`;
  }

  return {
    id: String(r.id),
    path: r.path,
    language: r.language,
    symbol: r.symbol,
    kind: r.kind,
    startLine: r.start_line,
    endLine: r.end_line,
    content: r.content,
    similarity: r.similarity,
    semanticRank: r.semantic_rank,
    keywordRank: r.keyword_rank,
    score: r.score,
    matchedTerms: words,
    highlightLines,
    reason,
  };
}
