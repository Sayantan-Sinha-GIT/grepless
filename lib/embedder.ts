// gte-small (384-d) running locally through transformers.js + onnxruntime.
// The int8-quantised weights ship with the deployment (./models), so there is
// no download at cold start and no external embedding API.

import path from 'node:path';
import type { FeatureExtractionPipeline } from '@huggingface/transformers';
import { splitIdentifiers } from './text';

export const EMBEDDING_MODEL = 'Supabase/gte-small';
export const EMBEDDING_DIMS = 384;

let extractor: Promise<FeatureExtractionPipeline> | null = null;

function load(): Promise<FeatureExtractionPipeline> {
  extractor ??= (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = path.join(process.cwd(), 'models');
    env.cacheDir = path.join('/tmp', 'transformers-cache');
    // Cast through a loose signature: the overloads are too large for tsc to resolve.
    const create = pipeline as unknown as (task: string, model: string, opts: object) => Promise<FeatureExtractionPipeline>;
    return create('feature-extraction', EMBEDDING_MODEL, { dtype: 'q8' });
  })().catch((err) => {
    extractor = null;
    throw err;
  });
  return extractor;
}

/** Embeds texts one at a time (batching pads to the longest text, which is slower for code). */
export async function embed(texts: string[]): Promise<number[][]> {
  const model = await load();
  const out: number[][] = [];
  for (const text of texts) {
    const tensor = await model(text, { pooling: 'mean', normalize: true });
    out.push(Array.from(tensor.data as Float32Array));
    tensor.dispose?.();
  }
  return out;
}

export async function embedOne(text: string): Promise<number[]> {
  return (await embed([text]))[0];
}

/** pgvector literal, e.g. `[0.1,0.2,…]`. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.map((x) => x.toFixed(6)).join(',')}]`;
}

/** What actually gets embedded for a chunk: location + symbol give the model context. */
export function embeddingText(path: string, symbol: string | null, kind: string, content: string): string {
  // Humanised names ("retryFromError" → "retry from error") help a text model
  // relate identifiers to natural-language questions.
  const words = symbol ? splitIdentifiers(symbol).join(' ') : '';
  const header = symbol ? `${path} — ${kind} ${symbol} (${words})` : path;
  return `${header}\n${content}`;
}
