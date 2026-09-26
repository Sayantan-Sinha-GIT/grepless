# grepless — Product Requirements Document

**Owner:** Sayantan-Sinha-GIT
**Status:** v1 built and deployed
**Stack:** Next.js 16 on Vercel · Supabase Postgres + pgvector · gte-small embeddings (runs inside the app, no API keys)

---

## 1. Summary

grepless is a website for searching a GitHub repository by meaning instead of exact text. You paste a public repo URL, and grepless downloads it, splits every file into functions and classes, turns each piece into a 384-dimension embedding, and stores the vectors in Postgres with pgvector. You can then ask plain-English questions such as *"where do I handle auth retries?"*. It returns the matching code with file paths, line numbers, a "why this matched" explanation, and a link to that exact line on GitHub.

The project demonstrates retrieval at the systems level, not a thin wrapper around a chat API:

- AST-aware chunking with tree-sitter
- a self-hosted embedding model
- HNSW vector indexing
- hybrid ranking that combines vector similarity with Postgres full-text search through Reciprocal Rank Fusion
- incremental re-indexing using content hashes

## 2. Problem

Text search (`grep`, GitHub search) only works when you already know the identifier. On an unfamiliar codebase, you usually know *what the code does*, not *what it is called*. For example, "retry with backoff" might live in a function called `withResilience`. Semantic search closes that gap.

## 3. Goals and non-goals

**Goals**
1. Index a typical public repo (up to about 1,500 source files) with no manual steps and no paid API.
2. Return relevant results for natural-language questions in under 2 seconds once the index is warm.
3. Make every result traceable: file, line range, symbol name, a reason for the match, and a GitHub permalink.
4. Keep the pipeline transparent enough that a technical reviewer can see how retrieval works.

**Non-goals (v1)**
- Private repositories (needs GitHub OAuth; see §9).
- Chat-style answer generation. Search is pure embeddings plus ranking.
- Monorepos larger than the size limits in §7.

## 4. Users

| User | Need |
|---|---|
| Developer onboarding onto a repo | "Where is X handled?" without reading every file |
| Technical reviewer / recruiter | Look at a working RAG-style retrieval system and how it is built |
| Open-source contributor | Find the right place to make a change |

## 5. Features

### Core (must-have) — all shipped
| # | Feature | Implementation |
|---|---|---|
| 1 | Repo input | Paste `github.com/owner/repo`, `owner/repo`, or any GitHub URL (branches and paths are stripped). |
| 2 | Repo fetching | One gzip tarball download from GitHub (`codeload.github.com`). No clone, and it does not count against the REST API rate limit. The commit SHA is read from the tarball's pax header. |
| 3 | Code chunking | tree-sitter parses 13 languages (TS, TSX, JS/JSX, Python, Go, Rust, Java, C#, C/C++, Ruby, PHP, Bash, CSS). Chunks follow function/class/method boundaries. Large nodes are split into their children, and small siblings are merged. Markdown is split by heading. Other text uses overlapping line windows. |
| 4 | Embeddings | `gte-small` (384-d, int8-quantized ONNX) runs in the Vercel function through transformers.js. The embedded text is `path + symbol + code`. |
| 5 | Vector storage | Supabase Postgres: `chunks.embedding vector(384)` with an HNSW cosine index, plus a `tsvector` column with a GIN index. |
| 6 | Semantic search | The query is embedded with the same model. Hybrid SQL takes the top 40 by cosine distance (HNSW, iterative scan) and the top 40 by `ts_rank_cd`, where symbol and path words carry weight A and body words weight D. The two lists are fused with Reciprocal Rank Fusion (k = 60), with small path priors (tests ×0.8, docs ×0.9). |
| 7 | Results display | File path, line range, symbol, similarity, highlighted code, and a "why this matched" line showing shared terms, the matching window, and semantic vs keyword contribution. |
| 8 | Indexing status | `queued → fetching → indexing → ready` (or `error`), with a live progress bar, counters, and an ETA. Indexing is resumable: reopening the page continues where it stopped. |

### Should-have — all shipped
| # | Feature | Implementation |
|---|---|---|
| 9 | Re-index | Compares the new commit SHA with the stored one. If it changed, only files whose SHA-1 content hash changed are re-chunked and re-embedded; deleted files are removed. |
| 10 | File filtering | Skips `node_modules`, `vendor`, `dist`, `build`, `.git`, lockfiles, minified or generated files, binaries, images, and files over 200 KB. The skip count is shown. |
| 11 | Click-through | Every result links to `github.com/owner/repo/blob/<commit-sha>/path#L10-L42`, a permalink that stays correct after the repo changes. |
| 12 | Recent repos | A global "Recently indexed" list (from the database) plus "Your repos" (browser storage), so nobody re-indexes a repo that is already done. |

### Nice-to-have
| # | Feature | Status |
|---|---|---|
| 13 | One-line AI explanation of a result | Built. An optional **Explain** button, and the only LLM call in the product. The provider is Groq (free key) or Vercel AI Gateway. The button stays hidden until a provider is configured (see `docs/SETUP.md`). |
| 14 | GitHub OAuth for private repos | Deferred. Requires a GitHub OAuth App, which cannot be created programmatically. Steps are in `docs/SETUP.md`. |

## 6. System design

```
Browser ──POST /api/repos──────────▶ create/lookup repo row (queued)
        ──POST /api/repos/:id/prepare─▶ download tarball → filter → hash → diff vs DB
                                        → tree-sitter chunk → insert chunks (embedding NULL)
        ──POST /api/repos/:id/embed ──▶ claim ≤24 pending chunks (FOR UPDATE SKIP LOCKED)
           (×3 parallel loops)          → gte-small → UPDATE embedding → progress
        ──POST /api/search ───────────▶ embed query → hybrid SQL (HNSW + GIN, RRF) → explain
```

**Why a client-driven embedding loop?** Serverless functions have time limits, and a large repo takes minutes to embed. Splitting the work into short, idempotent batches means no single request times out, several workers can share the load safely (`SKIP LOCKED` plus a 2-minute claim lease), and a closed tab only pauses the job.

**Why embed inside the app?** Supabase's built-in `gte-small` edge runtime was measured at about 600 ms of CPU per chunk, which exceeds the free tier's 2 s-per-request CPU cap after 3 chunks. Running the same model through onnxruntime in a Vercel Node function takes about 50–150 ms per chunk, costs nothing, and needs no API keys.

**Why hybrid search?** Small embedding models are weaker on exact identifiers (`useAuthRetry`). Full-text search on identifier-split tokens (`use auth retry`) catches those, and RRF merges the two rankings without tuning score scales.

### Data model
- `repos`: owner, name, slug (unique), description, stars, commit_sha, status, counters, languages histogram, timestamps.
- `files`: repo_id, path, language, content_hash (SHA-1), size, line count. Unique (repo_id, path).
- `chunks`: repo_id, file_id, path, language, symbol, kind, start/end line, content, `fts tsvector`, `embedding vector(384)`, `claimed_at`.

### Security
- Tables have Row Level Security enabled and are revoked from `anon` and `authenticated`, so nothing is exposed through Supabase's public REST API.
- The app connects with a dedicated least-privilege Postgres role (`grepless_app`) through the Supavisor pooler. The connection string exists only as an encrypted Vercel environment variable.
- Only public repos are fetched. There is no token that could reach private code.
- Server-side input validation and size caps; at most 3 repos index at the same time.

## 7. Limits

| Limit | Value |
|---|---|
| Tarball size | 60 MB compressed |
| Indexed files per repo | 1,500 |
| Chunks per repo | 6,000 |
| Max file size | 200 KB |
| Concurrent indexing repos | 3 (others wait in `queued`) |
| Search results | 10 per query |

## 8. Success metrics
- Time to first searchable result on a ~300-file repo: under 90 s.
- Search latency p50 under 800 ms (warm).
- For the demo queries on the demo repos, the expected function appears in the top 3.

## 9. Future work
1. GitHub OAuth plus private repos (per-user repo access checks, token encrypted at rest).
2. Cross-repo search ("search all my repos").
3. Code-specialised embedding model (e.g., `jina-embeddings-v2-base-code`) behind a feature flag, with an offline evaluation set.
4. Webhook-driven re-index on push.
5. Re-ranking the top 20 with a cross-encoder.
