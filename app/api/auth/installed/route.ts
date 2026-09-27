// GitHub's "Setup URL": where people land after choosing which repos grepless may read.

import { NextResponse, type NextRequest } from 'next/server';
import { authOrigin } from '@/lib/config';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const origin = authOrigin(req.url);
  const signedIn = req.cookies.has('gl_session');
  return NextResponse.redirect(new URL(signedIn ? '/me?installed=1' : '/api/auth/login?next=/me%3Finstalled%3D1', origin));
}
