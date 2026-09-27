import { db } from './db';

export type RepoStatus = 'queued' | 'fetching' | 'indexing' | 'ready' | 'error';

export interface Repo {
  id: string;
  owner: string;
  name: string;
  slug: string;
  description: string | null;
  stars: number | null;
  primary_language: string | null;
  commit_sha: string | null;
  status: RepoStatus;
  status_message: string | null;
  total_files: number;
  skipped_files: number;
  total_chunks: number;
  embedded_chunks: number;
  languages: Record<string, number>;
  created_at: string;
  updated_at: string;
  indexed_at: string | null;
  search_count: number;
}

// Every query here is a tagged template. `sql.unsafe(text, params)` makes
// postgres.js ask the server to describe parameter types first, and that
// round trip stalls indefinitely behind Supabase's transaction pooler.
const COLUMNS = `id, owner, name, slug, description, stars, primary_language, commit_sha, status, status_message,
  total_files, skipped_files, total_chunks, embedded_chunks, languages, created_at, updated_at, indexed_at, search_count`;

export async function getRepo(id: string): Promise<Repo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sql = db();
  const rows = await sql<Repo[]>`select ${sql.unsafe(COLUMNS)} from repos where id = ${id}::uuid`;
  return rows[0] ?? null;
}

export async function getRepoBySlug(owner: string, name: string): Promise<Repo | null> {
  const sql = db();
  const slug = `${owner}/${name}`.toLowerCase();
  const rows = await sql<Repo[]>`select ${sql.unsafe(COLUMNS)} from repos where slug = ${slug}`;
  return rows[0] ?? null;
}

export async function listRecentRepos(limit = 12): Promise<Repo[]> {
  const sql = db();
  return sql<Repo[]>`
    select ${sql.unsafe(COLUMNS)} from repos where status <> 'error'
    order by (status = 'ready') desc, coalesce(indexed_at, updated_at) desc
    limit ${limit}`;
}

export async function listAllRepos(limit = 200): Promise<Repo[]> {
  const sql = db();
  return sql<Repo[]>`
    select ${sql.unsafe(COLUMNS)} from repos where status <> 'error' or indexed_at is not null
    order by coalesce(indexed_at, updated_at) desc
    limit ${limit}`;
}

export interface SiteStats {
  repos: number;
  chunks: number;
  searches: number;
  files: number;
}

/** Live totals for the landing page counters. */
export async function getSiteStats(): Promise<SiteStats> {
  const sql = db();
  const [row] = await sql<SiteStats[]>`
    select
      count(*) filter (where status = 'ready')::int as repos,
      coalesce(sum(embedded_chunks), 0)::int as chunks,
      coalesce(sum(search_count), 0)::int as searches,
      coalesce(sum(total_files), 0)::int as files
    from repos`;
  return row;
}

/** Inserts the repo as `queued`, or returns the existing row (re-queuing it if it had failed). */
export async function upsertRepo(owner: string, name: string): Promise<Repo> {
  const sql = db();
  const rows = await sql<Repo[]>`
    insert into repos (owner, name) values (${owner}, ${name})
    on conflict (slug) do update set
      status = case when repos.status = 'error' then 'queued' else repos.status end,
      status_message = case when repos.status = 'error' then null else repos.status_message end,
      updated_at = case when repos.status = 'error' then now() else repos.updated_at end
    returning ${sql.unsafe(COLUMNS)}`;
  return rows[0];
}

/** Marks a ready (or failed) repo for a refresh; the next prepare call diffs it. */
export async function requeueRepo(id: string): Promise<Repo | null> {
  const sql = db();
  const rows = await sql<Repo[]>`
    update repos set status = 'queued', status_message = 'Checking GitHub for changes', updated_at = now()
    where id = ${id}::uuid and status in ('ready', 'error')
    returning ${sql.unsafe(COLUMNS)}`;
  return rows[0] ?? getRepo(id);
}

/** Public shape sent to the browser. */
export function publicRepo(r: Repo) {
  return {
    id: r.id,
    owner: r.owner,
    name: r.name,
    description: r.description,
    stars: r.stars,
    primaryLanguage: r.primary_language,
    commitSha: r.commit_sha,
    status: r.status,
    statusMessage: r.status_message,
    totalFiles: r.total_files,
    skippedFiles: r.skipped_files,
    totalChunks: r.total_chunks,
    embeddedChunks: r.embedded_chunks,
    languages: r.languages,
    indexedAt: r.indexed_at ? new Date(r.indexed_at).toISOString() : null,
    updatedAt: new Date(r.updated_at).toISOString(),
    searchCount: r.search_count,
  };
}

export type PublicRepo = ReturnType<typeof publicRepo>;
