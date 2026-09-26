// Guard rails for a free-tier deployment. Documented in docs/PRD.md §7.
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
