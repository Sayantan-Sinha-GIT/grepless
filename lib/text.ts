// Tokenisation shared by indexing (full-text column) and search (query terms,
// "why this matched"). Identifiers are split so `retryWithBackoff` and
// `MAX_AUTH_RETRIES` both contribute the words "retry" and "auth".

const STOPWORDS = new Set(
  (
    'a an and are as at be by can code do does for from how i if in into is it its me my of on or our ' +
    'should so that the their them then there these this to use used uses using was we what when where ' +
    'which who why will with you your find show get gets file files function functions method logic ' +
    'handle handles handled handling implement implemented implementation part place thing things any all'
  ).split(' '),
);

/** Splits camelCase, PascalCase, snake_case, kebab-case and digits into lowercase words. */
export function splitIdentifiers(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1);
}

/** Very small suffix stripper; enough for retry/retries/retrying to meet. */
export function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('es') && /(ss|x|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

// Common abbreviations in code, so "authentication" also finds `auth`.
const ALIASES: Record<string, string[]> = {
  authentication: ['auth'],
  authenticate: ['auth'],
  authorization: ['auth', 'authz'],
  configuration: ['config', 'conf'],
  config: ['configuration'],
  database: ['db'],
  request: ['req'],
  response: ['res', 'resp'],
  error: ['err'],
  errors: ['err'],
  message: ['msg'],
  initialize: ['init'],
  initialise: ['init'],
  parameter: ['param'],
  parameters: ['params'],
  argument: ['arg'],
  arguments: ['args'],
  directory: ['dir'],
  temporary: ['tmp', 'temp'],
  environment: ['env'],
  password: ['pwd', 'passwd'],
  repository: ['repo'],
  connection: ['conn'],
  context: ['ctx'],
  retry: ['retries', 'backoff'],
  retries: ['retry', 'backoff'],
};

export interface QueryTerm {
  word: string;
  stem: string;
}

/** Meaningful words from a natural-language query, plus code abbreviations. */
export function queryTerms(query: string): QueryTerm[] {
  const seen = new Set<string>();
  const out: QueryTerm[] = [];
  const add = (w: string) => {
    const s = stem(w);
    if (w.length < 2 || STOPWORDS.has(w) || seen.has(s)) return;
    seen.add(s);
    out.push({ word: w, stem: s });
  };
  for (const w of splitIdentifiers(query)) {
    add(w);
    for (const alias of ALIASES[w] ?? []) add(alias);
  }
  return out.slice(0, 16);
}

/**
 * Text fed to Postgres `to_tsvector`. The head (symbol + path words) gets
 * weight A and the body weight D, so a query word in a function name outranks
 * the same word buried in its body.
 */
export function searchableText(path: string, symbol: string | null, content: string): { head: string; body: string } {
  const head = [...(symbol ? splitIdentifiers(symbol) : []), ...splitIdentifiers(path)].join(' ');
  return { head, body: splitIdentifiers(content).join(' ').slice(0, 200_000) };
}

/** OR-query for Postgres `to_tsquery('english', …)`. Words are pre-sanitised to [a-z0-9]. */
export function toTsQuery(terms: QueryTerm[]): string | null {
  const words = terms.map((t) => t.word.replace(/[^a-z0-9]/g, '')).filter(Boolean);
  return words.length ? words.join(' | ') : null;
}
