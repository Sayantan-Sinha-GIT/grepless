import { errorResponse, json } from '@/lib/http';
import { getRepo, publicRepo } from '@/lib/repos';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: RouteContext<'/api/repos/[id]'>) {
  try {
    const repo = await getRepo((await ctx.params).id);
    if (!repo) return json({ error: 'Repository not found' }, 404);
    return json({ repo: publicRepo(repo) });
  } catch (err) {
    return errorResponse(err);
  }
}
