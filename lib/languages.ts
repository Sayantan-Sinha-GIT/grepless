// Maps file paths to a language label and (optionally) a tree-sitter grammar,
// and decides which files are worth indexing at all.

export type Grammar =
  | 'typescript'
  | 'tsx'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'c-sharp'
  | 'cpp'
  | 'ruby'
  | 'php'
  | 'bash'
  | 'css';

export type Strategy = 'ast' | 'markdown' | 'lines';

export interface LanguageInfo {
  language: string;
  grammar?: Grammar;
  strategy: Strategy;
}

const EXT: Record<string, LanguageInfo> = {
  ts: { language: 'TypeScript', grammar: 'typescript', strategy: 'ast' },
  mts: { language: 'TypeScript', grammar: 'typescript', strategy: 'ast' },
  cts: { language: 'TypeScript', grammar: 'typescript', strategy: 'ast' },
  tsx: { language: 'TypeScript', grammar: 'tsx', strategy: 'ast' },
  js: { language: 'JavaScript', grammar: 'javascript', strategy: 'ast' },
  mjs: { language: 'JavaScript', grammar: 'javascript', strategy: 'ast' },
  cjs: { language: 'JavaScript', grammar: 'javascript', strategy: 'ast' },
  jsx: { language: 'JavaScript', grammar: 'javascript', strategy: 'ast' },
  py: { language: 'Python', grammar: 'python', strategy: 'ast' },
  go: { language: 'Go', grammar: 'go', strategy: 'ast' },
  rs: { language: 'Rust', grammar: 'rust', strategy: 'ast' },
  java: { language: 'Java', grammar: 'java', strategy: 'ast' },
  cs: { language: 'C#', grammar: 'c-sharp', strategy: 'ast' },
  c: { language: 'C', grammar: 'cpp', strategy: 'ast' },
  h: { language: 'C', grammar: 'cpp', strategy: 'ast' },
  cc: { language: 'C++', grammar: 'cpp', strategy: 'ast' },
  cpp: { language: 'C++', grammar: 'cpp', strategy: 'ast' },
  cxx: { language: 'C++', grammar: 'cpp', strategy: 'ast' },
  hpp: { language: 'C++', grammar: 'cpp', strategy: 'ast' },
  hh: { language: 'C++', grammar: 'cpp', strategy: 'ast' },
  rb: { language: 'Ruby', grammar: 'ruby', strategy: 'ast' },
  php: { language: 'PHP', grammar: 'php', strategy: 'ast' },
  sh: { language: 'Shell', grammar: 'bash', strategy: 'ast' },
  bash: { language: 'Shell', grammar: 'bash', strategy: 'ast' },
  css: { language: 'CSS', grammar: 'css', strategy: 'ast' },
  // Languages without a bundled grammar fall back to line windows.
  kt: { language: 'Kotlin', strategy: 'lines' },
  kts: { language: 'Kotlin', strategy: 'lines' },
  swift: { language: 'Swift', strategy: 'lines' },
  scala: { language: 'Scala', strategy: 'lines' },
  dart: { language: 'Dart', strategy: 'lines' },
  lua: { language: 'Lua', strategy: 'lines' },
  ex: { language: 'Elixir', strategy: 'lines' },
  exs: { language: 'Elixir', strategy: 'lines' },
  erl: { language: 'Erlang', strategy: 'lines' },
  hs: { language: 'Haskell', strategy: 'lines' },
  clj: { language: 'Clojure', strategy: 'lines' },
  r: { language: 'R', strategy: 'lines' },
  jl: { language: 'Julia', strategy: 'lines' },
  zig: { language: 'Zig', strategy: 'lines' },
  vue: { language: 'Vue', strategy: 'lines' },
  svelte: { language: 'Svelte', strategy: 'lines' },
  astro: { language: 'Astro', strategy: 'lines' },
  scss: { language: 'SCSS', strategy: 'lines' },
  sql: { language: 'SQL', strategy: 'lines' },
  graphql: { language: 'GraphQL', strategy: 'lines' },
  gql: { language: 'GraphQL', strategy: 'lines' },
  proto: { language: 'Protobuf', strategy: 'lines' },
  tf: { language: 'Terraform', strategy: 'lines' },
  yaml: { language: 'YAML', strategy: 'lines' },
  yml: { language: 'YAML', strategy: 'lines' },
  toml: { language: 'TOML', strategy: 'lines' },
  md: { language: 'Markdown', strategy: 'markdown' },
  mdx: { language: 'Markdown', strategy: 'markdown' },
};

const SPECIAL_FILES: Record<string, LanguageInfo> = {
  dockerfile: { language: 'Dockerfile', strategy: 'lines' },
  makefile: { language: 'Makefile', strategy: 'lines' },
  'package.json': { language: 'JSON', strategy: 'lines' },
};

const IGNORED_DIRS = new Set([
  'node_modules',
  'bower_components',
  'vendor',
  'third_party',
  'third-party',
  'dist',
  'build',
  'out',
  'target',
  'obj',
  'coverage',
  '.git',
  '.github',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.cache',
  '.venv',
  'venv',
  '__pycache__',
  '.mypy_cache',
  '.pytest_cache',
  '.idea',
  '.vscode',
  '.gradle',
  'Pods',
  'DerivedData',
  '__snapshots__',
  'fixtures',
  'testdata',
]);

const IGNORED_FILE_PATTERNS = [
  /\.min\.(js|css)$/i,
  /\.bundle\.js$/i,
  /\.map$/i,
  /\.d\.ts$/i,
  /\.snap$/i,
  /\.lock$/i,
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|composer\.lock|Gemfile\.lock|Cargo\.lock|poetry\.lock|go\.sum)$/i,
  /(^|\/)CHANGELOG\.md$/i,
  /\.generated\.\w+$/i,
  /_pb2\.py$/,
  /\.pb\.go$/,
];

export function detectLanguage(path: string): LanguageInfo | null {
  const base = path.split('/').pop()!.toLowerCase();
  if (SPECIAL_FILES[base]) return SPECIAL_FILES[base];
  const dot = base.lastIndexOf('.');
  if (dot <= 0 && !base.startsWith('.')) return null;
  const ext = base.slice(dot + 1);
  return EXT[ext] ?? null;
}

export type SkipReason = 'ignored-dir' | 'ignored-file' | 'unsupported' | 'too-large' | 'binary' | 'minified';

/** Cheap path-only check, done before the file body is read. */
export function checkPath(path: string): SkipReason | null {
  const parts = path.split('/');
  for (let i = 0; i < parts.length - 1; i++) {
    if (IGNORED_DIRS.has(parts[i]) || (parts[i].startsWith('.') && parts[i] !== '.')) return 'ignored-dir';
  }
  if (IGNORED_FILE_PATTERNS.some((re) => re.test(path))) return 'ignored-file';
  if (!detectLanguage(path)) return 'unsupported';
  return null;
}

/** Content check: rejects binaries and minified / generated one-liners. */
export function checkContent(text: string): SkipReason | null {
  if (text.includes('\u0000')) return 'binary';
  const lines = text.split('\n');
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  if (longest > 2000 || (lines.length > 0 && text.length / lines.length > 300)) return 'minified';
  return null;
}
