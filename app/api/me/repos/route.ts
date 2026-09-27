// "Your repos": everything the signed-in person granted grepless, with index status.

import { getViewer, userToken } from '@/lib/auth';
import { AuthError, listGrantedRepos } from '@/lib/githubApp';
import { errorResponse, json } from '@/lib/http';
import { publicRepo, reposBySlugs } from '@/lib/repos';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const viewer = await getViewer();
    if (!viewer) return json({ error: 'Sign in with GitHub first.' }, 401);
    const token = await userToken(viewer.id);
    if (!token) return json({ error: 'Your GitHub sign-in expired. Sign in again.', expired: true }, 401);

    const { installations, repos } = await listGrantedRepos(token);
    const indexed = new Map(
      (await reposBySlugs(repos.map((r) => `${r.owner}/${r.name}`))).map((r) => [r.slug, publicRepo(r)]),
    );
    return json({
      installations,
      repos: repos.map((r) => ({ ...r, index: indexed.get(`${r.owner}/${r.name}`.toLowerCase()) ?? null })),
    });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: 'GitHub did not answer. Try again in a moment.' }, 502);
    return errorResponse(err);
  }
}
