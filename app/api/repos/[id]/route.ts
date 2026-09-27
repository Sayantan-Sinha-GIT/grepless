import { accessibleRepo } from '@/lib/auth';
import { errorResponse, json } from '@/lib/http';
import { getRepo, publicRepo } from '@/lib/repos';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: RouteContext<'/api/repos/[id]'>) {
  try {
    const found = await accessibleRepo((await ctx.params).id, getRepo);
    if (!found) return json({ error: 'Repository not found' }, 404);
    return json({ repo: publicRepo(found.repo) });
  } catch (err) {
    return errorResponse(err);
  }
}
