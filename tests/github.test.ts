import { describe, expect, it } from 'vitest';
import { blobUrl, parseRepoInput } from '../lib/github';

describe('parseRepoInput', () => {
  it.each([
    ['sindresorhus/ky', 'sindresorhus', 'ky'],
    ['https://github.com/psf/requests', 'psf', 'requests'],
    ['github.com/expressjs/express/tree/master/lib', 'expressjs', 'express'],
    ['git@github.com:vercel/next.js.git', 'vercel', 'next.js'],
    ['  https://www.github.com/a-b/c_d.e?tab=readme#top  ', 'a-b', 'c_d.e'],
  ])('parses %s', (input, owner, name) => {
    expect(parseRepoInput(input)).toEqual({ owner, name });
  });

  it.each(['', 'justone', 'owner/..', '-bad/repo', 'a/b c'])('rejects %j', (input) => {
    expect(parseRepoInput(input)).toBeNull();
  });
});

describe('blobUrl', () => {
  it('builds a permalink with a line range', () => {
    expect(blobUrl('o', 'r', 'abc', 'src/a b.ts', 10, 20)).toBe('https://github.com/o/r/blob/abc/src/a%20b.ts#L10-L20');
  });

  it('falls back to HEAD and a single line', () => {
    expect(blobUrl('o', 'r', null, 'x.py', 5, 5)).toBe('https://github.com/o/r/blob/HEAD/x.py#L5');
  });
});
