// Called once a day by Vercel Cron (vercel.json). Supabase pauses free projects after about a
// week without database activity, which would take the whole site down with it.

import { db } from '@/lib/db';
import { errorResponse, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [row] = await db()<{ repos: number }[]>`select count(*)::int as repos from repos`;
    return json({ ok: true, repos: row.repos });
  } catch (err) {
    return errorResponse(err);
  }
}
