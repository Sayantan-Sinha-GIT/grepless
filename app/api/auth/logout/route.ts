import { NextResponse, type NextRequest } from 'next/server';
import { destroySession, SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// A form POST from the header. SameSite=Lax cookies mean other sites cannot
// sign someone out; the Origin check covers older browsers.
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && origin !== req.nextUrl.origin) return new Response('Forbidden', { status: 403 });
  try {
    await destroySession(req.cookies.get(SESSION_COOKIE)?.value);
  } catch (err) {
    console.error('[auth] sign-out cleanup failed', err);
  }
  const res = NextResponse.redirect(new URL('/', req.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
