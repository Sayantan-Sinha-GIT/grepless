import { accessibleRepo } from '@/lib/auth';
import { errorResponse, json, readJson } from '@/lib/http';
import { getRepo } from '@/lib/repos';
import { searchRepo } from '@/lib/search';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await readJson<{ repoId: string; query: string; languages: string[] }>(req);
  const query = typeof body.query === 'string' ? body.query.trim().slice(0, 300) : '';
  if (!query) return json({ error: 'Type a question to search for.' }, 400);
  const languages = Array.isArray(body.languages)
    ? body.languages.filter((l): l is string => typeof l === 'string').slice(0, 20)
    : [];
  try {
    const found = typeof body.repoId === 'string' ? await accessibleRepo(body.repoId, getRepo) : null;
    if (!found) return json({ error: 'Repository not found' }, 404);
    const { repo } = found;
    if (repo.embedded_chunks === 0) return json({ error: 'This repository has no embeddings yet.' }, 409);
    const started = Date.now();
    const hits = await searchRepo(repo.id, query, languages);
    return json({ hits, tookMs: Date.now() - started, partial: repo.status !== 'ready' });
  } catch (err) {
    return errorResponse(err);
  }
}
