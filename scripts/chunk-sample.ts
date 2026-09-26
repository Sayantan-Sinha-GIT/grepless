// Usage: npm run test:chunker -- <file> [<file> ...]
// Prints the chunks grepless would create for each file.
import { readFileSync } from 'node:fs';
import { chunkFile } from '../lib/chunker.ts';
import { detectLanguage } from '../lib/languages.ts';

for (const file of process.argv.slice(2)) {
  const info = detectLanguage(file);
  if (!info) {
    console.log(`${file}: unsupported`);
    continue;
  }
  const chunks = await chunkFile(readFileSync(file, 'utf8'), info);
  console.log(`\n${file} (${info.language}, ${info.strategy}) → ${chunks.length} chunks`);
  for (const c of chunks) {
    console.log(`  L${c.startLine}-${c.endLine}  ${c.kind.padEnd(9)} ${c.symbol ?? '—'}  (${c.content.length} chars)`);
  }
}
