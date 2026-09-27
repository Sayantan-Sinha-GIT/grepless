import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The provider chain is exercised with a fake fetch: no real keys, no network.
const ENV = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'EXPLAIN_ENABLED', 'GEMINI_MODEL', 'GROQ_MODEL'] as const;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('explain providers', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    vi.resetModules();
  });

  afterEach(() => {
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.unstubAllGlobals();
  });

  it('is disabled with no provider configured', async () => {
    const { explainEnabled } = await import('../lib/explain');
    expect(explainEnabled()).toBe(false);
  });

  it('uses Gemini first when it answers', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini';
    process.env.GROQ_API_KEY = 'test-groq';
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('generativelanguage')) {
        return jsonResponse({ candidates: [{ content: { parts: [{ text: 'Gemini says hi.' }] } }] });
      }
      throw new Error('Groq should not be called');
    });
    vi.stubGlobal('fetch', fetchMock);
    const { complete } = await import('../lib/explain');
    await expect(complete('sys', 'prompt')).resolves.toEqual({ text: 'Gemini says hi.', provider: 'gemini' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to Groq when Gemini fails', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini';
    process.env.GROQ_API_KEY = 'test-groq';
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('generativelanguage')) return jsonResponse({ error: { message: 'quota' } }, 429);
      return jsonResponse({ choices: [{ message: { content: 'Groq says hi.' } }] });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { complete } = await import('../lib/explain');
    await expect(complete('sys', 'prompt')).resolves.toEqual({ text: 'Groq says hi.', provider: 'groq' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('api.groq.com');
  });

  it('falls back to Groq when Gemini returns an empty answer', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini';
    process.env.GROQ_API_KEY = 'test-groq';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('generativelanguage')
          ? jsonResponse({ candidates: [{ content: { parts: [] } }] })
          : jsonResponse({ choices: [{ message: { content: 'From Groq.' } }] }),
      ),
    );
    const { complete } = await import('../lib/explain');
    await expect(complete('sys', 'prompt')).resolves.toMatchObject({ provider: 'groq' });
  });

  it('reports every failure when all providers fail', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini';
    process.env.GROQ_API_KEY = 'test-groq';
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'down' }, 503)));
    const { complete } = await import('../lib/explain');
    await expect(complete('sys', 'prompt')).rejects.toThrow(/Gemini 503.*Groq 503/);
  });
});
