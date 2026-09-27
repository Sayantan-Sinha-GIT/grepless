import { accessibleRepo } from '@/lib/auth';
import { errorResponse, json } from '@/lib/http';
import { getRepo, publicRepo, requeueRepo } from '@/lib/repos';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, ctx: RouteContext<'/api/repos/[id]/reindex'>) {
  try {
    const found = await accessibleRepo((await ctx.params).id, getRepo);
    if (!found) return json({ error: 'Repository not found' }, 404);
    const repo = await requeueRepo(found.repo.id);
    if (!repo) return json({ error: 'Repository not found' }, 404);
    return json({ repo: publicRepo(repo) });
  } catch (err) {
    return errorResponse(err);
  }
}
