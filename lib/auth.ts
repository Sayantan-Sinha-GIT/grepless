// Sessions and access control for "Sign in with GitHub".
//
// The browser holds a random session value in an httpOnly cookie; the
// database stores only its SHA-256. GitHub tokens live in `users`, sealed
// (lib/crypto.ts), and are renewed here when they are about to expire. The
// renewal runs under a row lock because GitHub refresh tokens are single-use:
// two parallel requests must not both spend the same one.

import { cookies } from 'next/headers';
import { cache } from 'react';
import { randomToken, seal, sha256, unseal } from './crypto';
import { db } from './db';
import {
  appConfig,
  authEnabled,
  canSeeRepo,
  needsRefresh,
  refreshTokens,
  type GitHubUser,
  type TokenSet,
} from './githubApp';
import { fetchRepoMeta, NOT_FOUND_SIGNED_IN, NOT_FOUND_SIGNED_OUT, RepoError, type RepoRef } from './github';
import { getRepoBySlug, grantRepoAccess, markRepoPublic, revokeRepoAccess, upsertRepo, type Repo } from './repos';

export const SESSION_COOKIE = 'gl_session';
export const STATE_COOKIE = 'gl_oauth';
export const SESSION_DAYS = 30;
const ACCESS_RECHECK_MS = 60 * 60 * 1000;

export interface Viewer {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
});

/** The signed-in person for this request, or null. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!authEnabled()) return null;
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw || raw.length > 100) return null;
  const rows = await db()<{ id: string; login: string; name: string | null; avatar_url: string | null }[]>`
    select u.id::text as id, u.login, u.name, u.avatar_url
    from sessions s join users u on u.id = s.user_id
    where s.id = ${sha256(raw)} and s.expires_at > now()`;
  const row = rows[0];
  return row ? { id: row.id, login: row.login, name: row.name, avatarUrl: row.avatar_url } : null;
});

/** Stores the person and their tokens, opens a session, and returns the raw cookie value. */
export async function createSession(user: GitHubUser, tokens: TokenSet): Promise<string> {
  const sql = db();
  await sql`
    insert into users (id, login, name, avatar_url, access_token, access_expires_at, refresh_token, refresh_expires_at)
    values (${user.id}::bigint, ${user.login}, ${user.name}, ${user.avatarUrl}, ${seal(tokens.accessToken)},
            ${tokens.accessExpiresAt}, ${tokens.refreshToken ? seal(tokens.refreshToken) : null}, ${tokens.refreshExpiresAt})
    on conflict (id) do update set
      login = excluded.login, name = excluded.name, avatar_url = excluded.avatar_url,
      access_token = excluded.access_token, access_expires_at = excluded.access_expires_at,
      refresh_token = excluded.refresh_token, refresh_expires_at = excluded.refresh_expires_at,
      updated_at = now()`;
  const raw = randomToken();
  await sql`
    insert into sessions (id, user_id, expires_at)
    values (${sha256(raw)}, ${user.id}::bigint, now() + make_interval(days => ${SESSION_DAYS}))`;
  // Housekeeping: drop this person's expired sessions.
  await sql`delete from sessions where user_id = ${user.id}::bigint and expires_at < now()`;
  return raw;
}

export async function destroySession(raw: string | undefined): Promise<void> {
  if (!raw) return;
  await db()`delete from sessions where id = ${sha256(raw)}`;
}

interface TokenRow {
  access_token: string;
  access_expires_at: Date | null;
  refresh_token: string | null;
  refresh_expires_at: Date | null;
}

/** A usable GitHub token for this person, renewed if needed; null means "sign in again". */
export async function userToken(userId: string): Promise<string | null> {
  const sql = db();
  const [row] = await sql<TokenRow[]>`
    select access_token, access_expires_at, refresh_token, refresh_expires_at from users where id = ${userId}::bigint`;
  if (!row) return null;
  if (!needsRefresh(row.access_expires_at)) return unseal(row.access_token);

  const cfg = appConfig();
  if (!cfg) return null;
  return sql.begin(async (tx) => {
    const [locked] = await tx<TokenRow[]>`
      select access_token, access_expires_at, refresh_token, refresh_expires_at
      from users where id = ${userId}::bigint for update`;
    if (!locked) return null;
    // Another request may have renewed it while we waited for the lock.
    if (!needsRefresh(locked.access_expires_at)) return unseal(locked.access_token);
    const refresh = locked.refresh_token ? unseal(locked.refresh_token) : null;
    if (!refresh || (locked.refresh_expires_at && new Date(locked.refresh_expires_at).getTime() < Date.now())) {
      return null;
    }
    try {
      const next = await refreshTokens(cfg, refresh);
      await tx`
        update users set
          access_token = ${seal(next.accessToken)}, access_expires_at = ${next.accessExpiresAt},
          refresh_token = ${next.refreshToken ? seal(next.refreshToken) : locked.refresh_token},
          refresh_expires_at = ${next.refreshExpiresAt ?? locked.refresh_expires_at},
          updated_at = now()
        where id = ${userId}::bigint`;
      return next.accessToken;
    } catch (err) {
      console.warn('[auth] token refresh failed', err instanceof Error ? err.message : err);
      return null;
    }
  });
}

/**
 * Public repos are open to everyone. A private repo is visible to a signed-in
 * person with a fresh access row, or once GitHub confirms (with their token)
 * that they can read it. Access rows are re-checked hourly. A private repo
 * that has since been made public on GitHub opens up for everyone.
 */
export async function canAccessRepo(
  repo: Pick<Repo, 'id' | 'owner' | 'name' | 'is_private'>,
  viewer: Viewer | null,
): Promise<boolean> {
  if (!repo.is_private) return true;
  if (viewer && (await viewerCanSee(repo, viewer))) return true;
  return becamePublic(repo);
}

// A repo indexed while private may have been made public on GitHub since.
// Asked anonymously, at most once per repo every 10 minutes per server.
const publicChecks = new Map<string, number>();
async function becamePublic(repo: Pick<Repo, 'id' | 'owner' | 'name' | 'is_private'>): Promise<boolean> {
  const last = publicChecks.get(repo.id);
  if (last && Date.now() - last < 10 * 60 * 1000) return false;
  if (publicChecks.size > 1000) publicChecks.clear();
  publicChecks.set(repo.id, Date.now());
  const meta = await fetchRepoMeta({ owner: repo.owner, name: repo.name }).catch(() => null);
  if (!meta || meta.isPrivate) return false;
  await markRepoPublic(repo.id);
  repo.is_private = false; // callers render this row right away
  return true;
}

async function viewerCanSee(repo: Pick<Repo, 'id' | 'owner' | 'name'>, viewer: Viewer): Promise<boolean> {
  const [row] = await db()<{ verified_at: Date }[]>`
    select verified_at from repo_access where repo_id = ${repo.id}::uuid and user_id = ${viewer.id}::bigint`;
  if (row && Date.now() - new Date(row.verified_at).getTime() < ACCESS_RECHECK_MS) return true;

  const token = await userToken(viewer.id);
  if (!token) return false;
  const answer = await canSeeRepo(token, repo.owner, repo.name);
  if (answer === 'yes') {
    await grantRepoAccess(repo.id, viewer.id);
    return true;
  }
  if (answer === 'no') {
    if (row) await revokeRepoAccess(repo.id, viewer.id);
    return false;
  }
  // GitHub could not be asked: keep existing access, never grant new access.
  return Boolean(row);
}

/** The viewer plus a usable token, for routes that may touch private repos. */
export async function requester(viewer: Viewer | null) {
  if (!viewer) return null;
  const token = await userToken(viewer.id);
  return token ? { userId: viewer.id, token } : null;
}

/** The session value from the incoming request (route handlers only). */
export async function sessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export type OpenResult = { repo: Repo } | { denied: { message: string; needsAuth: boolean } };

const denied = (viewer: Viewer | null): OpenResult => ({
  denied: viewer
    ? { message: NOT_FOUND_SIGNED_IN, needsAuth: false }
    : { message: NOT_FOUND_SIGNED_OUT, needsAuth: true },
});

/**
 * Finds or creates the repo row for this person. Someone without access to a
 * private repo gets the same answer as for a repo that does not exist. When a
 * signed-in person adds something new (or retries a failure), GitHub is asked
 * first so a private repo is marked private before anything about it is listed.
 */
export async function openRepo(
  ref: RepoRef,
  viewer: Viewer | null,
  { requeueErrors }: { requeueErrors: boolean },
): Promise<OpenResult> {
  const existing = await getRepoBySlug(ref.owner, ref.name);
  if (existing && !(await canAccessRepo(existing, viewer))) return denied(viewer);
  if (existing && (existing.status !== 'error' || !requeueErrors)) return { repo: existing };

  if (viewer) {
    const token = await userToken(viewer.id);
    if (token) {
      let meta = null;
      try {
        meta = await fetchRepoMeta(ref, token);
      } catch (err) {
        if (err instanceof RepoError && !existing) return denied(viewer);
      }
      if (meta) {
        const repo = await upsertRepo(meta.owner, meta.name, meta.isPrivate);
        if (meta.isPrivate) await grantRepoAccess(repo.id, viewer.id);
        return { repo };
      }
    }
  }
  return { repo: await upsertRepo(ref.owner, ref.name) };
}

/** For API routes: the repo if this request may see it, else null (reported as 404). */
export async function accessibleRepo(id: string, getRepoFn: (id: string) => Promise<Repo | null>) {
  const repo = await getRepoFn(id);
  if (!repo) return null;
  const viewer = repo.is_private ? await getViewer() : null;
  if (!(await canAccessRepo(repo, viewer))) return null;
  return { repo, viewer };
}
