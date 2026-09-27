// Step 1 of sign-in: send the person to GitHub with a one-time `state` value.

import { NextResponse, type NextRequest } from 'next/server';
import { cookieOptions, STATE_COOKIE } from '@/lib/auth';
import { authOrigin } from '@/lib/config';
import { randomToken } from '@/lib/crypto';
import { appConfig, authorizeUrl, authEnabled, safeNext } from '@/lib/githubApp';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const origin = authOrigin(req.url);
  const cfg = appConfig();
  if (!cfg || !authEnabled()) return NextResponse.redirect(new URL('/me?error=disabled', origin));

  // If this deployment's URL is not registered with GitHub, sign in on production instead.
  const here = new URL(req.url).origin;
  if (here !== origin) return NextResponse.redirect(new URL(`/api/auth/login${req.nextUrl.search}`, origin));

  const state = randomToken(24);
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  const res = NextResponse.redirect(authorizeUrl(cfg, `${origin}/api/auth/callback`, state));
  res.cookies.set(STATE_COOKIE, `${state}|${encodeURIComponent(next)}`, cookieOptions(10 * 60));
  return res;
}
