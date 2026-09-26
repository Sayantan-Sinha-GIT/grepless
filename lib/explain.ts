// Provider for the optional one-line "Explain" button — the only LLM call.
//
//   GROQ_API_KEY set      → Groq's OpenAI-compatible API (free tier, no card)
//   EXPLAIN_ENABLED=true  → Vercel AI Gateway via the deployment's OIDC token
//   neither               → the button is hidden
import { generateText } from 'ai';

export function explainEnabled(): boolean {
  return Boolean(process.env.GROQ_API_KEY) || process.env.EXPLAIN_ENABLED === 'true';
}

export async function complete(system: string, prompt: string): Promise<string> {
  if (process.env.GROQ_API_KEY) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        temperature: 0.2,
        max_tokens: 90,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? '';
  }
  const { text } = await generateText({
    model: process.env.EXPLAIN_MODEL || 'openai/gpt-4.1-nano',
    maxOutputTokens: 90,
    temperature: 0.2,
    system,
    prompt,
  });
  return text;
}
