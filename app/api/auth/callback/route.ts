// Step 2 of sign-in: GitHub sends the person back with a code. Check `state`,
// swap the code for tokens, load the profile, open a session.

import { NextResponse, type NextRequest } from 'next/server';
import { cookieOptions, createSession, SESSION_COOKIE, SESSION_DAYS, STATE_COOKIE } from '@/lib/auth';
import { authOrigin } from '@/lib/config';
import { AuthError, appConfig, exchangeCode, fetchGitHubUser, safeNext } from '@/lib/githubApp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const origin = authOrigin(req.url);
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/me?error=${code}`, origin));
    res.cookies.delete(STATE_COOKIE);
    return res;
  };

  const cfg = appConfig();
  if (!cfg) return fail('disabled');

  const params = req.nextUrl.searchParams;
  if (params.get('error') === 'access_denied') return fail('cancelled');
  const code = params.get('code');
  const state = params.get('state');
  const [expected, rawNext] = (req.cookies.get(STATE_COOKIE)?.value ?? '').split('|');
  if (!code || !state || !expected || state !== expected) return fail('state');

  try {
    const tokens = await exchangeCode(cfg, code, `${origin}/api/auth/callback`);
    const user = await fetchGitHubUser(tokens.accessToken);
    const session = await createSession(user, tokens);
    const res = NextResponse.redirect(new URL(safeNext(decodeURIComponent(rawNext ?? '')), origin));
    res.cookies.set(SESSION_COOKIE, session, cookieOptions(SESSION_DAYS * 24 * 60 * 60));
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    console.error('[auth] callback failed', err instanceof AuthError ? `${err.code}: ${err.message}` : err);
    return fail('github');
  }
}
