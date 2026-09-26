// The only LLM call in grepless: an optional one-sentence summary of a result.
// Runs through Vercel AI Gateway, which authenticates with the deployment's
// OIDC token, so no API key is stored anywhere.

import { generateText } from 'ai';
import { db } from '@/lib/db';
import { json, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const cache = new Map<string, string>();

export async function POST(req: Request) {
  const body = await readJson<{ chunkId: string; query: string }>(req);
  const chunkId = typeof body.chunkId === 'string' && /^\d+$/.test(body.chunkId) ? body.chunkId : null;
  const query = typeof body.query === 'string' ? body.query.trim().slice(0, 300) : '';
  if (!chunkId) return json({ error: 'Missing result id' }, 400);

  const key = `${chunkId}:${query}`;
  const cached = cache.get(key);
  if (cached) return json({ explanation: cached });

  try {
    const [chunk] = await db()<{ path: string; symbol: string | null; language: string; content: string }[]>`
      select path, symbol, language, content from chunks where id = ${chunkId}`;
    if (!chunk) return json({ error: 'Result not found' }, 404);

    const { text } = await generateText({
      model: process.env.EXPLAIN_MODEL || 'openai/gpt-4.1-nano',
      maxOutputTokens: 90,
      temperature: 0.2,
      system:
        'You explain code to developers. Reply with exactly one plain-English sentence (max 30 words). ' +
        'Say what the code does, and if a question is given, how it relates to it. No markdown, no preamble.',
      prompt:
        `Question: ${query || '(none)'}\n` +
        `File: ${chunk.path}${chunk.symbol ? ` — ${chunk.symbol}` : ''} (${chunk.language})\n\n` +
        chunk.content.slice(0, 4000),
    });
    const explanation = text.trim().replace(/\s+/g, ' ');
    if (cache.size > 500) cache.clear();
    cache.set(key, explanation);
    return json({ explanation });
  } catch (err) {
    console.warn('[explain] unavailable', err instanceof Error ? err.message : err);
    return json({ error: 'AI explanations are unavailable right now.' }, 503);
  }
}
