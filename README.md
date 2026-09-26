# grepless

**Search a GitHub repository by meaning, not by string.**
Paste a public repo, ask *"where do we retry failed requests?"*, and jump straight to the right function on GitHub.

**Live:** https://grepless.vercel.app

grepless is a retrieval system built from the parts up, not a wrapper around a chat API:

| Stage | What happens | Where |
|---|---|---|
| Fetch | One gzip tarball per repo, streamed through a small hand-written tar reader. The commit SHA comes from the pax header, so every result links to an immutable permalink. | [`lib/github.ts`](lib/github.ts) |
| Filter | Drops dependencies, build output, lockfiles, minified bundles, binaries and files over 200 KB before reading them into memory. | [`lib/languages.ts`](lib/languages.ts) |
| Chunk | tree-sitter (13 grammars) splits code along functions, classes and methods. Oversized nodes are split along their children, tiny neighbours are merged, and each chunk keeps a qualified name such as `Ky.#retryFromError`. | [`lib/chunker.ts`](lib/chunker.ts) |
| Embed | `gte-small` (384-d, int8 ONNX) runs **inside the Vercel function** through transformers.js. There is no embedding API and no API key. | [`lib/embedder.ts`](lib/embedder.ts) |
| Store | Supabase Postgres: `vector(384)` with an HNSW cosine index, plus a weighted `tsvector` (symbol and path = A, body = D) with a GIN index. | [`supabase/migrations`](supabase/migrations) |
| Retrieve | Top 40 by cosine (HNSW, iterative scan) and top 40 by `ts_rank_cd`, fused with Reciprocal Rank Fusion, with small path priors for tests and docs. | [`lib/search.ts`](lib/search.ts) |
| Explain | Each hit says whether it matched on meaning, keywords or both, which words it shares with the query, and which lines to read. | [`lib/search.ts`](lib/search.ts) |

## Design notes

**Resumable, serverless-friendly indexing.** Indexing is two idempotent steps.
- `prepare` downloads, diffs by SHA-1 content hash and chunks, then inserts chunks with `embedding = NULL`.
- `embed` repeatedly claims about 12 pending chunks with `FOR UPDATE SKIP LOCKED` and a 2-minute lease, embeds them and writes the vectors back.

The browser runs three embed workers in parallel. No request runs long, several viewers can share the work, and a closed tab only pauses the job.

**Why not Supabase's built-in embedding runtime?** It measured about 600 ms of CPU per code chunk, and the free tier's edge functions stop at 2 s of CPU per request. The same model through onnxruntime in a Node function runs at about 13 chunks/s.

**Why hybrid?** Small embedding models blur exact identifiers. Full-text search over split identifiers (`useAuthRetry` → `use auth retry`) catches them. RRF merges the two rankings without calibrating score scales.

**Incremental re-index.** If the commit SHA is unchanged, nothing is done. Otherwise only files whose content hash changed are re-chunked and re-embedded, and deleted files are removed.

**Security.** RLS is on and the tables are revoked from `anon`/`authenticated`, so nothing is reachable through Supabase's public REST API. The app connects through the Supavisor pooler as a dedicated least-privilege role. Only public repos are fetched, and no GitHub token that could reach private code is used.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Supabase Postgres + pgvector 0.8 · transformers.js + ONNX Runtime · web-tree-sitter · Vercel (Mumbai region, next to the database) · Vercel AI Gateway for the optional one-line **Explain**.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL
npm run dev
```

Inspect how a file would be chunked:

```bash
npm run test:chunker -- path/to/file.ts
```

## Docs

- [Product requirements](docs/PRD.md)
- [Setup & operations](docs/SETUP.md)

## License

MIT © Sayantan-Sinha-GIT
