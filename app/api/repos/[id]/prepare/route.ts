import { accessibleRepo, getViewer, requester } from '@/lib/auth';
import { errorResponse, json } from '@/lib/http';
import { prepareRepo } from '@/lib/indexer';
import { getRepo, publicRepo } from '@/lib/repos';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(_req: Request, ctx: RouteContext<'/api/repos/[id]/prepare'>) {
  try {
    const found = await accessibleRepo((await ctx.params).id, getRepo);
    if (!found) return json({ error: 'Repository not found' }, 404);
    // A signed-in person's token lets the indexer see (and download) private repos.
    const who = await requester(found.viewer ?? (await getViewer()));
    const { kind, repo } = await prepareRepo(found.repo.id, who);
    return json({ outcome: kind, repo: publicRepo(repo) });
  } catch (err) {
    return errorResponse(err);
  }
}
