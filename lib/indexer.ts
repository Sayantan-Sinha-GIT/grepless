// The indexing pipeline, split into two idempotent steps so no single
// serverless invocation has to do everything:
//
//   prepare  download tarball → filter → hash → diff against the DB →
//            chunk changed files → insert chunks with embedding = NULL
//   embed    claim a small batch of NULL-embedding chunks (SKIP LOCKED +
//            lease), embed them, write vectors back; repeat until done
//
// Re-indexing reuses `prepare`: unchanged files keep their embeddings.

import { createHash } from 'node:crypto';
import { LIMITS } from './config';
import { chunkFile, type Chunk } from './chunker';
import { db } from './db';
import { embed, embeddingText, toVectorLiteral } from './embedder';
import { downloadRepo, fetchRepoMeta, RepoError } from './github';
import { checkContent, checkPath, detectLanguage } from './languages';
import { getRepo, type Repo } from './repos';
import { searchableText } from './text';

export type PrepareOutcome = { kind: 'started' | 'busy' | 'in-progress'; repo: Repo };

interface ChangedFile {
  path: string;
  language: string;
  hash: string;
  size: number;
  lineCount: number;
  chunks: Chunk[];
}

const decoder = new TextDecoder('utf-8', { fatal: false });

/** Claims the repo for preparation, respecting the global concurrency cap. */
async function claimForPrepare(id: string): Promise<Repo | null> {
  const sql = db();
  const rows = await sql<Repo[]>`
    update repos set status = 'fetching', status_message = 'Downloading repository from GitHub', updated_at = now()
    where id = ${id}
      and (status = 'queued'
           or (status = 'fetching' and updated_at < now() - make_interval(mins => ${LIMITS.staleFetchMinutes})))
      and (select count(*) from repos other
           where other.id <> ${id}
             and other.status in ('fetching', 'indexing')
             and other.updated_at > now() - interval '10 minutes') < ${LIMITS.maxConcurrentIndexing}
    returning *`;
  return rows[0] ?? null;
}

async function setStatus(id: string, status: Repo['status'], message: string | null) {
  await db()`update repos set status = ${status}, status_message = ${message}, updated_at = now() where id = ${id}`;
}

export async function prepareRepo(id: string): Promise<PrepareOutcome> {
  const claimed = await claimForPrepare(id);
  if (!claimed) {
    const repo = await getRepo(id);
    if (!repo) throw new RepoError('Repository not found', 404);
    return { kind: repo.status === 'queued' ? 'busy' : 'in-progress', repo };
  }
  try {
    await runPrepare(claimed);
  } catch (err) {
    const message =
      err instanceof RepoError ? err.message : 'Indexing failed unexpectedly. Try again in a minute.';
    console.error('[prepare]', claimed.slug, err);
    await setStatus(id, 'error', message);
  }
  return { kind: 'started', repo: (await getRepo(id))! };
}

async function runPrepare(repo: Repo) {
  const sql = db();
  const ref = { owner: repo.owner, name: repo.name };

  const meta = await fetchRepoMeta(ref);
  if (meta) {
    await sql`
      update repos set owner = ${meta.owner}, name = ${meta.name}, description = ${meta.description},
        stars = ${meta.stars}, primary_language = ${meta.language}
      where id = ${repo.id}`;
  }

  const existingRows = await sql<{ id: string; path: string; content_hash: string }[]>`
    select id, path, content_hash from files where repo_id = ${repo.id}`;
  const existing = new Map(existingRows.map((r) => [r.path, r]));

  const download = await downloadRepo(
    ref,
    (path, size) => size <= LIMITS.maxFileBytes && checkPath(path) === null,
  );

  if (
    download.commitSha &&
    download.commitSha === repo.commit_sha &&
    repo.total_chunks > 0 &&
    repo.embedded_chunks === repo.total_chunks
  ) {
    await download.files.return(undefined);
    await sql`
      update repos set status = 'ready', status_message = 'Already up to date with the latest commit',
        updated_at = now(), indexed_at = now()
      where id = ${repo.id}`;
    return;
  }

  await setStatus(repo.id, 'fetching', 'Parsing files into functions and classes');

  const seen = new Set<string>();
  const changed: ChangedFile[] = [];
  let skipped = 0;
  let newChunkCount = 0;
  let truncated = false;

  for await (const file of download.files) {
    if (!file.content) {
      skipped++;
      continue;
    }
    if (seen.size >= LIMITS.maxFiles || newChunkCount >= LIMITS.maxChunks) {
      truncated = true;
      skipped++;
      continue;
    }
    const text = decoder.decode(file.content);
    if (checkContent(text)) {
      skipped++;
      continue;
    }
    seen.add(file.path);
    const hash = createHash('sha1').update(file.content).digest('hex');
    if (existing.get(file.path)?.content_hash === hash) continue;

    const info = detectLanguage(file.path)!;
    const chunks = await chunkFile(text, info);
    if (!chunks.length) {
      seen.delete(file.path);
      skipped++;
      continue;
    }
    newChunkCount += chunks.length;
    changed.push({
      path: file.path,
      language: info.language,
      hash,
      size: file.size,
      lineCount: text.split('\n').length,
      chunks,
    });
  }

  const stale = [...existing.keys()].filter((p) => !seen.has(p) || changed.some((c) => c.path === p));
  if (seen.size === 0) {
    throw new RepoError('No indexable source files found (after skipping dependencies, binaries and lockfiles).', 422);
  }

  await sql.begin(async (tx) => {
    if (stale.length) {
      await tx`delete from files where repo_id = ${repo.id} and path = any(${tx.array(stale)}::text[])`;
    }
    for (let i = 0; i < changed.length; i += 200) {
      const batch = changed.slice(i, i + 200);
      const inserted = await tx<{ id: string; path: string }[]>`
        insert into files (repo_id, path, language, content_hash, size_bytes, line_count)
        select ${repo.id}::uuid, u.path, u.language, u.hash, u.size, u.lines
        from unnest(
          ${tx.array(batch.map((f) => f.path))}::text[],
          ${tx.array(batch.map((f) => f.language))}::text[],
          ${tx.array(batch.map((f) => f.hash))}::text[],
          ${tx.array(batch.map((f) => f.size))}::int[],
          ${tx.array(batch.map((f) => f.lineCount))}::int[]
        ) as u(path, language, hash, size, lines)
        returning id, path`;
      const idByPath = new Map(inserted.map((r) => [r.path, r.id]));

      const rows = batch.flatMap((f) =>
        f.chunks.map((c) => ({
          fileId: idByPath.get(f.path)!,
          path: f.path,
          language: f.language,
          symbol: c.symbol ?? '',
          kind: c.kind,
          start: c.startLine,
          end: c.endLine,
          content: c.content,
          search: searchableText(f.path, c.symbol, c.content),
        })),
      );
      for (let j = 0; j < rows.length; j += 250) {
        const part = rows.slice(j, j + 250);
        await tx`
          insert into chunks (repo_id, file_id, path, language, symbol, kind, start_line, end_line, content, fts)
          select ${repo.id}::uuid, u.file_id, u.path, u.language, nullif(u.symbol, ''), u.kind, u.start_line,
                 u.end_line, u.content,
                 setweight(to_tsvector('english', u.head), 'A') || setweight(to_tsvector('english', u.body), 'D')
          from unnest(
            ${tx.array(part.map((r) => r.fileId))}::bigint[],
            ${tx.array(part.map((r) => r.path))}::text[],
            ${tx.array(part.map((r) => r.language))}::text[],
            ${tx.array(part.map((r) => r.symbol))}::text[],
            ${tx.array(part.map((r) => r.kind))}::text[],
            ${tx.array(part.map((r) => r.start))}::int[],
            ${tx.array(part.map((r) => r.end))}::int[],
            ${tx.array(part.map((r) => r.content))}::text[],
            ${tx.array(part.map((r) => r.search.head))}::text[],
            ${tx.array(part.map((r) => r.search.body))}::text[]
          ) as u(file_id, path, language, symbol, kind, start_line, end_line, content, head, body)`;
      }
    }
  });

  const [counts] = await sql<{ files: number; chunks: number; embedded: number }[]>`
    select
      (select count(*)::int from files where repo_id = ${repo.id}) as files,
      count(*)::int as chunks,
      count(embedding)::int as embedded
    from chunks where repo_id = ${repo.id}`;
  const languages = await sql<{ language: string; n: number }[]>`
    select language, count(*)::int as n from files where repo_id = ${repo.id} group by language order by n desc`;
  const langMap = Object.fromEntries(languages.map((l) => [l.language, l.n]));
  const pending = counts.chunks - counts.embedded;
  const note = truncated ? `Large repo: indexed the first ${seen.size.toLocaleString('en-US')} files. ` : '';
  const changedNote =
    repo.commit_sha && existing.size
      ? `${changed.length} changed, ${stale.length - changed.filter((c) => existing.has(c.path)).length} removed. `
      : '';

  await sql`
    update repos set
      status = ${pending > 0 ? 'indexing' : 'ready'},
      status_message = ${(note + changedNote + (pending > 0 ? 'Generating embeddings' : 'Index is up to date')).trim()},
      commit_sha = ${download.commitSha},
      total_files = ${counts.files},
      skipped_files = ${skipped},
      total_chunks = ${counts.chunks},
      embedded_chunks = ${counts.embedded},
      languages = ${sql.json(langMap)},
      updated_at = now(),
      indexed_at = ${pending > 0 ? null : new Date()}
    where id = ${repo.id}`;
}

// ---------------------------------------------------------------------------

export async function embedPending(id: string): Promise<Repo | null> {
  const sql = db();
  const repo = await getRepo(id);
  if (!repo || repo.status !== 'indexing') return repo;

  const started = Date.now();
  while (Date.now() - started < LIMITS.embedTimeBudgetMs) {
    const batch = await sql<{ id: string; path: string; symbol: string | null; kind: string; content: string }[]>`
      update chunks set claimed_at = now()
      where id in (
        select id from chunks
        where repo_id = ${id} and embedding is null
          and (claimed_at is null or claimed_at < now() - make_interval(secs => ${LIMITS.claimLeaseSeconds}))
        order by id
        limit ${LIMITS.embedBatchSize}
        for update skip locked
      )
      returning id, path, symbol, kind, content`;
    if (!batch.length) break;

    const vectors = await embed(batch.map((c) => embeddingText(c.path, c.symbol, c.kind, c.content)));
    await sql`
      update chunks as c set embedding = u.v::extensions.vector, claimed_at = null
      from unnest(${sql.array(batch.map((c) => c.id))}::bigint[], ${sql.array(vectors.map(toVectorLiteral))}::text[]) as u(id, v)
      where c.id = u.id`;
  }

  const [{ total, embedded }] = await sql<{ total: number; embedded: number }[]>`
    select count(*)::int as total, count(embedding)::int as embedded from chunks where repo_id = ${id}`;
  if (embedded >= total) {
    await sql`
      update repos set status = 'ready', status_message = null, embedded_chunks = ${embedded}, total_chunks = ${total},
        indexed_at = now(), updated_at = now()
      where id = ${id} and status = 'indexing'`;
  } else {
    await sql`
      update repos set embedded_chunks = ${embedded}, total_chunks = ${total}, updated_at = now()
      where id = ${id} and status = 'indexing'`;
  }
  return getRepo(id);
}
