import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomToken, seal, sha256, unseal } from '../lib/crypto';
import {
  authEnabled,
  authorizeUrl,
  canSeeRepo,
  exchangeCode,
  listGrantedRepos,
  needsRefresh,
  refreshTokens,
  safeNext,
} from '../lib/githubApp';

// Sign-in pieces that do not need a database or a real GitHub: token sealing,
// redirect safety, the OAuth token exchange and repo listing (with a fake fetch).

const CFG = { clientId: 'Iv1.test', clientSecret: 'test-secret', slug: 'grepless-test' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('token sealing', () => {
  const saved = process.env.AUTH_SECRET;
  beforeEach(() => {
    process.env.AUTH_SECRET = 'a'.repeat(48);
  });
  afterEach(() => {
    process.env.AUTH_SECRET = saved;
  });

  it('round-trips and never stores the plain value', () => {
    const sealed = seal('ghu_example_token');
    expect(sealed).not.toContain('ghu_example_token');
    expect(unseal(sealed)).toBe('ghu_example_token');
  });

  it('uses a fresh IV every time', () => {
    expect(seal('same')).not.toBe(seal('same'));
  });

  it('rejects tampering and a different secret', () => {
    const sealed = seal('secret-value');
    const parts = sealed.split('.');
    const flipped = parts[3].slice(0, -2) + (parts[3].endsWith('AA') ? 'BB' : 'AA');
    expect(unseal([...parts.slice(0, 3), flipped].join('.'))).toBeNull();
    expect(unseal('garbage')).toBeNull();
    process.env.AUTH_SECRET = 'b'.repeat(48);
    expect(unseal(sealed)).toBeNull();
  });

  it('refuses to run with a short secret', () => {
    process.env.AUTH_SECRET = 'short';
    expect(() => seal('x')).toThrow(/AUTH_SECRET/);
  });

  it('makes long random session values and stable hashes', () => {
    const a = randomToken();
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a).not.toBe(randomToken());
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('config and redirects', () => {
  const keys = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_APP_SLUG', 'AUTH_SECRET'] as const;
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => keys.forEach((k) => ((saved[k] = process.env[k]), delete process.env[k])));
  afterEach(() => keys.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))));

  it('is off until every setting is present', () => {
    expect(authEnabled()).toBe(false);
    process.env.GITHUB_CLIENT_ID = 'x';
    process.env.GITHUB_CLIENT_SECRET = 'y';
    process.env.GITHUB_APP_SLUG = 'z';
    expect(authEnabled()).toBe(false);
    process.env.AUTH_SECRET = 'c'.repeat(40);
    expect(authEnabled()).toBe(true);
  });

  it('builds the GitHub authorize URL with state', () => {
    const u = new URL(authorizeUrl(CFG, 'https://grepless.vercel.app/api/auth/callback', 'st4te'));
    expect(u.origin + u.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(u.searchParams.get('client_id')).toBe('Iv1.test');
    expect(u.searchParams.get('state')).toBe('st4te');
    expect(u.searchParams.get('redirect_uri')).toBe('https://grepless.vercel.app/api/auth/callback');
  });

  it('only allows same-site paths after sign-in', () => {
    expect(safeNext('/r/me/secret?q=auth')).toBe('/r/me/secret?q=auth');
    expect(safeNext(undefined)).toBe('/me');
    expect(safeNext('https://evil.example')).toBe('/me');
    expect(safeNext('//evil.example')).toBe('/me');
    expect(safeNext('/\\evil.example')).toBe('/me');
    expect(safeNext('/api/auth/logout')).toBe('/me');
  });
});

describe('GitHub token exchange', () => {
  it('parses expiring user tokens', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({ client_id: 'Iv1.test', code: 'the-code' });
      return jsonResponse({
        access_token: 'ghu_a',
        expires_in: 28800,
        refresh_token: 'ghr_b',
        refresh_token_expires_in: 15897600,
      });
    });
    const before = Date.now();
    const t = await exchangeCode(CFG, 'the-code', 'https://x/cb', fetchMock as unknown as typeof fetch);
    expect(t.accessToken).toBe('ghu_a');
    expect(t.refreshToken).toBe('ghr_b');
    expect(t.accessExpiresAt!.getTime()).toBeGreaterThanOrEqual(before + 28800_000);
  });

  it('handles tokens that never expire', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ access_token: 'ghu_forever' }));
    const t = await exchangeCode(CFG, 'c', 'https://x/cb', fetchMock as unknown as typeof fetch);
    expect(t.accessExpiresAt).toBeNull();
    expect(t.refreshToken).toBeNull();
  });

  it('turns GitHub errors (HTTP 200 with an error field) into AuthError', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'bad_verification_code', error_description: 'The code is wrong' }));
    await expect(exchangeCode(CFG, 'c', 'https://x/cb', fetchMock as unknown as typeof fetch)).rejects.toMatchObject({
      code: 'bad_verification_code',
    });
  });

  it('sends the refresh grant', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'ghr_old' });
      return jsonResponse({ access_token: 'ghu_new', expires_in: 28800, refresh_token: 'ghr_new' });
    });
    const t = await refreshTokens(CFG, 'ghr_old', fetchMock as unknown as typeof fetch);
    expect(t.accessToken).toBe('ghu_new');
    expect(t.refreshToken).toBe('ghr_new');
  });

  it('renews a minute before expiry', () => {
    const now = Date.now();
    expect(needsRefresh(null, now)).toBe(false);
    expect(needsRefresh(new Date(now + 10 * 60_000), now)).toBe(false);
    expect(needsRefresh(new Date(now + 30_000), now)).toBe(true);
    expect(needsRefresh(new Date(now - 1), now)).toBe(true);
  });
});

describe('GitHub repo access', () => {
  it('maps visibility answers', async () => {
    const make = (status: number) => vi.fn(async () => new Response('{}', { status })) as unknown as typeof fetch;
    expect(await canSeeRepo('t', 'o', 'r', make(200))).toBe('yes');
    expect(await canSeeRepo('t', 'o', 'r', make(404))).toBe('no');
    expect(await canSeeRepo('t', 'o', 'r', make(502))).toBe('unknown');
    const offline = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect(await canSeeRepo('t', 'o', 'r', offline)).toBe('unknown');
  });

  it('lists repos across installations, paginated and de-duplicated', async () => {
    const repo = (id: number, owner: string, isPrivate: boolean, pushed: string) => ({
      id,
      name: `repo${id}`,
      owner: { login: owner },
      private: isPrivate,
      description: null,
      language: 'TypeScript',
      stargazers_count: 0,
      pushed_at: pushed,
    });
    const page1 = Array.from({ length: 100 }, (_, i) => repo(i + 1, 'me', i % 2 === 0, '2026-01-01T00:00:00Z'));
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer ghu_t');
      if (url.endsWith('/user/installations?per_page=100')) {
        return jsonResponse({
          installations: [
            { id: 1, account: { login: 'me', type: 'User' }, repository_selection: 'all', html_url: 'https://github.com/settings/installations/1' },
            { id: 2, account: { login: 'my-org', type: 'Organization' }, repository_selection: 'selected', html_url: 'https://github.com/organizations/my-org/settings/installations/2' },
          ],
        });
      }
      if (url.includes('/installations/1/repositories') && url.endsWith('page=1')) return jsonResponse({ total_count: 101, repositories: page1 });
      if (url.includes('/installations/1/repositories') && url.endsWith('page=2')) {
        return jsonResponse({ total_count: 101, repositories: [repo(101, 'me', true, '2026-09-01T00:00:00Z')] });
      }
      if (url.includes('/installations/2/repositories')) {
        return jsonResponse({ total_count: 2, repositories: [repo(500, 'my-org', true, '2026-05-01T00:00:00Z'), repo(1, 'me', false, '2026-01-01T00:00:00Z')] });
      }
      throw new Error(`unexpected ${url}`);
    });
    const { installations, repos } = await listGrantedRepos('ghu_t', fetchMock as unknown as typeof fetch);
    expect(installations.map((i) => i.account)).toEqual(['me', 'my-org']);
    expect(repos).toHaveLength(102); // 101 + 1 org repo, the duplicate dropped
    expect(repos[0].name).toBe('repo101'); // most recently pushed first
    expect(repos[1].owner).toBe('my-org');
  });

  it('reports a failed installation lookup', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 401 }));
    await expect(listGrantedRepos('bad', fetchMock as unknown as typeof fetch)).rejects.toThrow(/401/);
  });
});
