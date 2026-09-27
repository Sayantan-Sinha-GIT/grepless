// GitHub-style language colours, used for language bars and dots.
const COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  Go: '#00add8',
  Rust: '#dea584',
  Java: '#b07219',
  'C#': '#178600',
  C: '#8a8a8a',
  'C++': '#f34b7d',
  Ruby: '#cc342d',
  PHP: '#4f5d95',
  Shell: '#89e051',
  CSS: '#663399',
  SCSS: '#c6538c',
  Kotlin: '#a97bff',
  Swift: '#f05138',
  Scala: '#c22d40',
  Dart: '#00b4ab',
  Lua: '#000080',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Markdown: '#9a95ad',
  YAML: '#cb171e',
  TOML: '#9c4221',
  JSON: '#6b6682',
  SQL: '#e38c00',
  Dockerfile: '#384d54',
  Makefile: '#427819',
};

export function languageColor(lang: string): string {
  return COLORS[lang] ?? '#a996ff';
}
