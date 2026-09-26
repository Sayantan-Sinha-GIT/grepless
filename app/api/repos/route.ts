import { parseRepoInput } from '@/lib/github';
import { errorResponse, json, readJson } from '@/lib/http';
import { listRecentRepos, publicRepo, upsertRepo } from '@/lib/repos';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const repos = await listRecentRepos(24);
    return json({ repos: repos.map(publicRepo) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  const body = await readJson<{ url: string }>(req);
  const ref = typeof body.url === 'string' ? parseRepoInput(body.url) : null;
  if (!ref) {
    return json({ error: 'Paste a GitHub repository like github.com/owner/repo or owner/repo.' }, 400);
  }
  try {
    const repo = await upsertRepo(ref.owner, ref.name);
    return json({ repo: publicRepo(repo) });
  } catch (err) {
    return errorResponse(err);
  }
}
