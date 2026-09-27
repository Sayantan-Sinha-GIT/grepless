import { describe, expect, it } from 'vitest';
import { chunkFile, MAX_CHARS } from '../lib/chunker';
import { detectLanguage } from '../lib/languages';

const body = (n: number, pad = '    ') =>
  Array.from({ length: n }, (_, i) => `${pad}const step${i} = await compute(${i}); // pipeline step ${i} with padding text`).join('\n');

const TS = [
  "import { sleep } from './time';",
  '',
  'export class Client {',
  '  async retry(fn: () => Promise<void>) {',
  body(14),
  '  }',
  '',
  '  refresh(token: string) {',
  body(14),
  '    return token;',
  '  }',
  '}',
  '',
  'export const createClient = () => {',
  body(14, '  '),
  '  return new Client();',
  '};',
  '',
].join('\n');

describe('chunkFile (TypeScript)', () => {
  it('splits along methods and keeps qualified names', async () => {
    const chunks = await chunkFile(TS, detectLanguage('client.ts')!);
    const symbols = chunks.map((c) => c.symbol ?? '');
    expect(symbols.some((s) => s.includes('Client.retry'))).toBe(true);
    expect(symbols.some((s) => s.includes('Client.refresh'))).toBe(true);
    expect(symbols.some((s) => s.includes('createClient'))).toBe(true);
    for (const c of chunks) {
      expect(c.startLine).toBeGreaterThanOrEqual(1);
      expect(c.endLine).toBeGreaterThanOrEqual(c.startLine);
      expect(c.content.length).toBeLessThanOrEqual(MAX_CHARS * 1.35);
    }
  });

  it('keeps line numbers aligned with the source', async () => {
    const chunks = await chunkFile(TS, detectLanguage('client.ts')!);
    const lines = TS.split('\n');
    for (const c of chunks) expect(c.content.split('\n')[0]).toBe(lines[c.startLine - 1]);
  });
});

describe('chunkFile (Python)', () => {
  it('labels functions inside a class as methods', async () => {
    const py = ['class Session:', '    def send(self, request):', body(18, '        '), '', '    def close(self):', body(18, '        '), ''].join('\n');
    const chunks = await chunkFile(py, detectLanguage('sessions.py')!);
    expect(chunks.some((c) => c.kind === 'method' && c.symbol?.includes('Session.send'))).toBe(true);
    expect(chunks.some((c) => c.kind === 'method' && c.symbol?.includes('Session.close'))).toBe(true);
  });
});

describe('chunkFile (fallbacks)', () => {
  it('splits Markdown by heading', async () => {
    const md = `# Title\n\nIntro text here.\n\n## Install\n\n${'npm install something\n'.repeat(40)}\n## Usage\n\n${'Use it like this.\n'.repeat(60)}`;
    const chunks = await chunkFile(md, detectLanguage('README.md')!);
    const symbols = chunks.map((c) => c.symbol ?? '');
    // The tiny intro is folded into the next section, so its heading is kept alongside.
    expect(symbols.some((s) => s.includes('Install'))).toBe(true);
    expect(symbols).toContain('Usage');
  });

  it('returns one chunk for a tiny file', async () => {
    const chunks = await chunkFile('export const a = 1;\nexport const b = 2;\n', detectLanguage('a.ts')!);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].kind).toBe('file');
  });
});
