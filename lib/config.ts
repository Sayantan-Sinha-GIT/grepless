// Guard rails for a free-tier deployment. Documented in PRD.md §8.
export const LIMITS = {
  maxTarballBytes: 60 * 1024 * 1024,
  maxFiles: 1500,
  maxChunks: 6000,
  maxFileBytes: 200 * 1024,
  maxConcurrentIndexing: 3,
  embedBatchSize: 12,
  embedTimeBudgetMs: 25_000,
  claimLeaseSeconds: 120,
  staleFetchMinutes: 6,
  searchResults: 10,
} as const;

/** The production site. GitHub only accepts sign-in callbacks on registered URLs. */
export const SITE_URL = 'https://grepless.vercel.app';
const CALLBACK_ORIGINS = [SITE_URL, 'http://localhost:3000'];

/** The origin to send people back to after GitHub: this one if registered, else production. */
export function authOrigin(requestUrl: string): string {
  const origin = new URL(requestUrl).origin;
  return CALLBACK_ORIGINS.includes(origin) ? origin : SITE_URL;
}
