// The GitHub App side of "Sign in with GitHub".
//
// grepless is a GitHub App, not a classic OAuth App: its only permissions are
// read-only Contents + Metadata, and each person chooses which repositories
// it may read when they install it. Signing in gives a *user-to-server* token
// that can only reach repos that are both (a) visible to the person and
// (b) granted to the app. Those tokens expire after 8 hours and are renewed
// with a single-use refresh token (see lib/auth.ts).

type Fetch = typeof fetch;

export interface AppConfig {
  clientId: string;
  clientSecret: string;
  slug: string;
}

export function appConfig(): AppConfig | null {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const slug = process.env.GITHUB_APP_SLUG;
  if (!clientId || !clientSecret || !slug) return null;
  return { clientId, clientSecret, slug };
}

/** Sign-in is switched on only when the app credentials and the sealing secret are all set. */
export function authEnabled(): boolean {
  return appConfig() !== null && (process.env.AUTH_SECRET?.length ?? 0) >= 32;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: string | null = null,
  ) {
    super(message);
  }
}

const API = 'https://api.github.com';
const HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'grepless',
  'X-GitHub-Api-Version': '2022-11-28',
};

export function authorizeUrl(cfg: AppConfig, redirectUri: string, state: string): string {
  const u = new URL('https://github.com/login/oauth/authorize');
  u.searchParams.set('client_id', cfg.clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  u.searchParams.set('allow_signup', 'true');
  return u.toString();
}

/** Where a person picks which repos (and which accounts/orgs) grepless may read. */
export const installUrl = (slug: string) => `https://github.com/apps/${slug}/installations/new`;

/** Where a person can revoke grepless entirely. */
export const REVOKE_URL = 'https://github.com/settings/apps/authorizations';

export interface TokenSet {
  accessToken: string;
  accessExpiresAt: Date | null;
  refreshToken: string | null;
  refreshExpiresAt: Date | null;
}

async function tokenRequest(params: Record<string, string>, fetchImpl: Fetch, now: number): Promise<TokenSet> {
  let res: Response;
  try {
    res = await fetchImpl('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'grepless' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
  } catch {
    throw new AuthError('Could not reach GitHub. Try again in a moment.', 'network');
  }
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || data.error || !data.access_token) {
    throw new AuthError(data.error_description || data.error || `GitHub returned ${res.status}`, data.error ?? null);
  }
  return {
    accessToken: data.access_token,
    accessExpiresAt: data.expires_in ? new Date(now + data.expires_in * 1000) : null,
    refreshToken: data.refresh_token ?? null,
    refreshExpiresAt: data.refresh_token_expires_in ? new Date(now + data.refresh_token_expires_in * 1000) : null,
  };
}

export function exchangeCode(cfg: AppConfig, code: string, redirectUri: string, fetchImpl: Fetch = fetch) {
  return tokenRequest(
    { client_id: cfg.clientId, client_secret: cfg.clientSecret, code, redirect_uri: redirectUri },
    fetchImpl,
    Date.now(),
  );
}

export function refreshTokens(cfg: AppConfig, refreshToken: string, fetchImpl: Fetch = fetch) {
  return tokenRequest(
    {
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    },
    fetchImpl,
    Date.now(),
  );
}

/** True when the access token is missing its expiry margin (renew a minute early). */
export function needsRefresh(expiresAt: Date | string | null, now = Date.now()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() - now < 60_000;
}

export interface GitHubUser {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

async function api<T>(path: string, token: string, fetchImpl: Fetch): Promise<{ status: number; data: T | null }> {
  const res = await fetchImpl(`${API}${path}`, {
    headers: { ...HEADERS, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  if (!res.ok) return { status: res.status, data: null };
  return { status: res.status, data: (await res.json()) as T };
}

export async function fetchGitHubUser(token: string, fetchImpl: Fetch = fetch): Promise<GitHubUser> {
  const { status, data } = await api<{ id: number; login: string; name: string | null; avatar_url: string | null }>(
    '/user',
    token,
    fetchImpl,
  );
  if (!data) throw new AuthError(`GitHub returned ${status} for the signed-in user`);
  return { id: String(data.id), login: data.login, name: data.name, avatarUrl: data.avatar_url };
}

/** 'yes' / 'no' from GitHub, or 'unknown' when GitHub could not be asked (network, 5xx, rate limit). */
export async function canSeeRepo(
  token: string,
  owner: string,
  name: string,
  fetchImpl: Fetch = fetch,
): Promise<'yes' | 'no' | 'unknown'> {
  try {
    const { status } = await api(`/repos/${owner}/${name}`, token, fetchImpl);
    if (status === 200) return 'yes';
    if (status === 404 || status === 401) return 'no';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export interface Installation {
  id: number;
  account: string;
  accountAvatar: string | null;
  accountType: 'User' | 'Organization' | string;
  selection: 'all' | 'selected' | string;
  settingsUrl: string;
}

export interface GrantedRepo {
  id: number;
  owner: string;
  name: string;
  isPrivate: boolean;
  description: string | null;
  language: string | null;
  stars: number;
  pushedAt: string | null;
}

interface RawInstallation {
  id: number;
  account: { login: string; avatar_url?: string; type: string } | null;
  repository_selection: string;
  html_url: string;
}

interface RawRepo {
  id: number;
  name: string;
  owner: { login: string };
  private: boolean;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  pushed_at: string | null;
}

const MAX_PAGES = 10; // 1,000 repos per installation is plenty for a dashboard

/** Every installation the person can see, and every repo granted to grepless through them. */
export async function listGrantedRepos(
  token: string,
  fetchImpl: Fetch = fetch,
): Promise<{ installations: Installation[]; repos: GrantedRepo[] }> {
  const inst = await api<{ installations: RawInstallation[] }>('/user/installations?per_page=100', token, fetchImpl);
  if (!inst.data) throw new AuthError(`GitHub returned ${inst.status} while listing installations`, String(inst.status));

  const installations: Installation[] = inst.data.installations.map((i) => ({
    id: i.id,
    account: i.account?.login ?? 'unknown',
    accountAvatar: i.account?.avatar_url ?? null,
    accountType: i.account?.type ?? 'User',
    selection: i.repository_selection,
    settingsUrl: i.html_url,
  }));

  const perInstallation = await Promise.all(
    installations.map(async (i) => {
      const out: GrantedRepo[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const { data } = await api<{ total_count: number; repositories: RawRepo[] }>(
          `/user/installations/${i.id}/repositories?per_page=100&page=${page}`,
          token,
          fetchImpl,
        );
        if (!data) break;
        for (const r of data.repositories) {
          out.push({
            id: r.id,
            owner: r.owner.login,
            name: r.name,
            isPrivate: r.private,
            description: r.description,
            language: r.language,
            stars: r.stargazers_count,
            pushedAt: r.pushed_at,
          });
        }
        if (data.repositories.length < 100 || out.length >= data.total_count) break;
      }
      return out;
    }),
  );

  const seen = new Set<number>();
  const repos = perInstallation
    .flat()
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .sort((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''));
  return { installations, repos };
}

/** Only relative, same-site paths are allowed as a post-sign-in destination. */
export function safeNext(next: string | null | undefined): string {
  if (!next || typeof next !== 'string') return '/me';
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || next.includes('\n')) return '/me';
  if (next.startsWith('/api/')) return '/me';
  return next.slice(0, 300);
}
