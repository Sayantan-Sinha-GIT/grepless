import { errorResponse, json } from '@/lib/http';
import { embedPending } from '@/lib/indexer';
import { publicRepo } from '@/lib/repos';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(_req: Request, ctx: RouteContext<'/api/repos/[id]/embed'>) {
  try {
    const repo = await embedPending((await ctx.params).id);
    if (!repo) return json({ error: 'Repository not found' }, 404);
    return json({ repo: publicRepo(repo) });
  } catch (err) {
    return errorResponse(err);
  }
}
