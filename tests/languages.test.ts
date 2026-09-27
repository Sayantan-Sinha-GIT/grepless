import { describe, expect, it } from 'vitest';
import { checkContent, checkPath, detectLanguage } from '../lib/languages';

describe('checkPath', () => {
  it.each(['src/index.ts', 'lib/auth.py', 'cmd/main.go', 'README.md', 'bin/cli.js', 'package.json'])('keeps %s', (p) => {
    expect(checkPath(p)).toBeNull();
  });

  it.each([
    ['node_modules/lodash/index.js', 'ignored-dir'],
    ['dist/bundle.js', 'ignored-dir'],
    ['.github/workflows/ci.yml', 'ignored-dir'],
    ['package-lock.json', 'ignored-file'],
    ['public/app.min.js', 'ignored-file'],
    ['types/index.d.ts', 'ignored-file'],
    ['logo.png', 'unsupported'],
  ])('skips %s as %s', (p, reason) => {
    expect(checkPath(p)).toBe(reason);
  });
});

describe('checkContent', () => {
  it('rejects binaries and minified one-liners', () => {
    expect(checkContent('abc\u0000def')).toBe('binary');
    expect(checkContent('x'.repeat(5000))).toBe('minified');
    expect(checkContent('const a = 1;\nconst b = 2;\n')).toBeNull();
  });
});

describe('detectLanguage', () => {
  it('maps extensions to grammars and strategies', () => {
    expect(detectLanguage('a/b.tsx')).toMatchObject({ language: 'TypeScript', grammar: 'tsx', strategy: 'ast' });
    expect(detectLanguage('Dockerfile')).toMatchObject({ language: 'Dockerfile', strategy: 'lines' });
    expect(detectLanguage('notes.md')).toMatchObject({ strategy: 'markdown' });
    expect(detectLanguage('image.jpeg')).toBeNull();
  });
});
