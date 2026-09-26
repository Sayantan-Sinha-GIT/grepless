import { errorResponse, json } from '@/lib/http';
import { publicRepo, requeueRepo } from '@/lib/repos';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, ctx: RouteContext<'/api/repos/[id]/reindex'>) {
  try {
    const repo = await requeueRepo((await ctx.params).id);
    if (!repo) return json({ error: 'Repository not found' }, 404);
    return json({ repo: publicRepo(repo) });
  } catch (err) {
    return errorResponse(err);
  }
}
