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

const COLUMNS = `id, owner, name, slug, description, stars, primary_language, commit_sha, status, status_message,
  total_files, skipped_files, total_chunks, embedded_chunks, languages, created_at, updated_at, indexed_at, search_count`;

export async function getRepo(id: string): Promise<Repo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sql = db();
  const rows = await sql.unsafe<Repo[]>(`select ${COLUMNS} from repos where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getRepoBySlug(owner: string, name: string): Promise<Repo | null> {
  const sql = db();
  const rows = await sql.unsafe<Repo[]>(`select ${COLUMNS} from repos where slug = lower($1) || '/' || lower($2)`, [
    owner,
    name,
  ]);
  return rows[0] ?? null;
}

export async function listRecentRepos(limit = 12): Promise<Repo[]> {
  const sql = db();
  return sql.unsafe<Repo[]>(
    `select ${COLUMNS} from repos where status <> 'error'
     order by (status = 'ready') desc, coalesce(indexed_at, updated_at) desc limit $1`,
    [limit],
  );
}

/** Inserts the repo as `queued`, or returns the existing row (re-queuing it if it had failed). */
export async function upsertRepo(owner: string, name: string): Promise<Repo> {
  const sql = db();
  const rows = await sql.unsafe<Repo[]>(
    `insert into repos (owner, name) values ($1, $2)
     on conflict (slug) do update set
       status = case when repos.status = 'error' then 'queued' else repos.status end,
       status_message = case when repos.status = 'error' then null else repos.status_message end,
       updated_at = case when repos.status = 'error' then now() else repos.updated_at end
     returning ${COLUMNS}`,
    [owner, name],
  );
  return rows[0];
}

/** Marks a ready (or failed) repo for a refresh; the next prepare call diffs it. */
export async function requeueRepo(id: string): Promise<Repo | null> {
  const sql = db();
  const rows = await sql.unsafe<Repo[]>(
    `update repos set status = 'queued', status_message = 'Checking GitHub for changes', updated_at = now()
     where id = $1 and status in ('ready', 'error')
     returning ${COLUMNS}`,
    [id],
  );
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
