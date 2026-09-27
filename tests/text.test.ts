import { describe, expect, it } from 'vitest';
import { queryTerms, searchableText, splitIdentifiers, stem, toTsQuery } from '../lib/text';

describe('splitIdentifiers', () => {
  it('splits camel, pascal, snake and kebab case', () => {
    expect(splitIdentifiers('retryWithBackoff MAX_AUTH_RETRIES parse-json HTTPServer')).toEqual([
      'retry', 'with', 'backoff', 'max', 'auth', 'retries', 'parse', 'json', 'http', 'server',
    ]);
  });
});

describe('stem', () => {
  it('brings word forms together', () => {
    expect(stem('retries')).toBe(stem('retry'));
    expect(stem('handling')).toBe(stem('handle'));
    expect(stem('tokens')).toBe(stem('token'));
  });
});

describe('queryTerms', () => {
  it('drops filler words and adds code abbreviations', () => {
    const words = queryTerms('where do I handle auth retries?').map((t) => t.word);
    expect(words).toContain('auth');
    expect(words).toContain('retries');
    expect(words).toContain('backoff');
    expect(words).not.toContain('where');
    expect(words).not.toContain('handle');
    expect(queryTerms('database configuration').map((t) => t.word)).toEqual(expect.arrayContaining(['db', 'config']));
  });

  it('builds a safe OR tsquery from hostile input', () => {
    expect(toTsQuery(queryTerms("auth'); drop table x; --"))).toMatch(/^[a-z0-9 |]+$/);
    expect(toTsQuery([])).toBeNull();
  });
});

describe('searchableText', () => {
  it('separates the weighted head from the body', () => {
    const { head, body } = searchableText('src/authClient.ts', 'AuthClient.refreshToken', 'return renewToken(t)');
    expect(head).toBe('auth client refresh token src auth client ts');
    expect(body).toBe('return renew token');
  });
});
