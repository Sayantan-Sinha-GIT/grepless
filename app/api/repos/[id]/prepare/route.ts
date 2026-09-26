import { errorResponse, json } from '@/lib/http';
import { prepareRepo } from '@/lib/indexer';
import { publicRepo } from '@/lib/repos';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(_req: Request, ctx: RouteContext<'/api/repos/[id]/prepare'>) {
  try {
    const { kind, repo } = await prepareRepo((await ctx.params).id);
    return json({ outcome: kind, repo: publicRepo(repo) });
  } catch (err) {
    return errorResponse(err);
  }
}
