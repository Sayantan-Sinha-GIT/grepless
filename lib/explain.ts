// Providers for the optional one-line "Explain" button — the only LLM call.
// Tried in order; the first one that answers wins:
//
//   1. Gemini   (GEMINI_API_KEY)  — Google AI Studio free tier
//   2. Groq     (GROQ_API_KEY)    — free tier, OpenAI-compatible API
//   3. Vercel AI Gateway (EXPLAIN_ENABLED=true) — needs gateway credits
//
// With none configured the button is hidden.
import { generateText } from 'ai';

export type Provider = 'gemini' | 'groq' | 'gateway';

interface Attempt {
  name: Provider;
  run: (system: string, prompt: string) => Promise<string>;
}

async function gemini(system: string, prompt: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
}

async function groq(system: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      temperature: 0.2,
      max_tokens: 120,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

async function gateway(system: string, prompt: string): Promise<string> {
  const { text } = await generateText({
    model: process.env.EXPLAIN_MODEL || 'openai/gpt-4.1-nano',
    maxOutputTokens: 120,
    temperature: 0.2,
    system,
    prompt,
  });
  return text;
}

function attempts(): Attempt[] {
  const list: Attempt[] = [];
  if (process.env.GEMINI_API_KEY) list.push({ name: 'gemini', run: gemini });
  if (process.env.GROQ_API_KEY) list.push({ name: 'groq', run: groq });
  if (process.env.EXPLAIN_ENABLED === 'true') list.push({ name: 'gateway', run: gateway });
  return list;
}

export function explainEnabled(): boolean {
  return attempts().length > 0;
}

/** Runs the providers in order and returns the first non-empty answer. */
export async function complete(system: string, prompt: string): Promise<{ text: string; provider: Provider }> {
  const errors: string[] = [];
  for (const attempt of attempts()) {
    try {
      const text = (await attempt.run(system, prompt)).trim();
      if (text) return { text, provider: attempt.name };
      errors.push(`${attempt.name}: empty response`);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `${attempt.name}: failed`);
    }
    console.warn(`[explain] ${attempt.name} failed, trying next provider`);
  }
  throw new Error(errors.join(' | ') || 'No explanation provider configured');
}
