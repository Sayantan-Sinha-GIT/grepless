# grepless

**Search a GitHub repository by meaning, not by string.**
Paste a public repo, ask *"where do we retry failed requests?"*, and jump straight to the right function on GitHub.

**Live:** https://grepless.vercel.app · [Explore](https://grepless.vercel.app/explore) · [How it works](https://grepless.vercel.app/how-it-works)

grepless is a retrieval system built from the parts up, not a wrapper around a chat API:

| Stage | What happens | Where |
|---|---|---|
| Fetch | One gzip tarball per repo, streamed through a hand-written tar reader. The commit SHA comes from the pax header, so every result is an immutable permalink. | [`lib/github.ts`](lib/github.ts) |
| Filter | Dependencies, build output, lockfiles, minified bundles, binaries and files over 200 KB are dropped before anything is read into memory. | [`lib/languages.ts`](lib/languages.ts) |
| Chunk | tree-sitter (13 grammars) splits code along functions, classes and methods, merges tiny neighbours, and keeps qualified names like `Ky.#retryFromError`. | [`lib/chunker.ts`](lib/chunker.ts) |
| Embed | `gte-small` (384-d, int8 ONNX) runs **inside the Vercel function** through transformers.js. No embedding API, no key. | [`lib/embedder.ts`](lib/embedder.ts) |
| Store | Supabase Postgres: `vector(384)` + HNSW, plus a weighted `tsvector` + GIN. | [`supabase/migrations`](supabase/migrations) |
| Retrieve | HNSW top-40 ⊕ full-text top-40, fused with Reciprocal Rank Fusion; every hit explains why it matched. | [`lib/search.ts`](lib/search.ts) |
| Explain | Optional one-line summary: Gemini free tier, falling back to Groq. | [`lib/explain.ts`](lib/explain.ts) |

## The interface

- A 3D vector-space hero: the typed query flies to its nearest neighbours.
- A live demo running real searches.
- An animated indexing "reactor".
- Result cards with similarity rings and highlighted matching lines.
- A scroll story explaining the pipeline.
- Light/dark theme with a circular reveal, and smooth scrolling.
- Everything respects `prefers-reduced-motion`.

Built with `motion`, Lenis, React `<ViewTransition>` and canvas.

## Design notes

**Resumable, serverless-friendly indexing.** Indexing is two idempotent steps.
- `prepare` downloads, diffs by content hash and chunks, then inserts chunks with `embedding = NULL`.
- `embed` repeatedly claims a small batch with `FOR UPDATE SKIP LOCKED` and a lease, then embeds it.

The browser runs three workers. No request runs long, and a closed tab only pauses the job.

**Why not Supabase's built-in embedding runtime?** It measured about 600 ms of CPU per chunk against a 2 s CPU cap per request. onnxruntime in a Node function does about 12 chunks/s.

**Why hybrid?** Small embedding models blur exact identifiers. Full-text search over split identifiers catches them, and RRF merges the two rankings without calibrating scores.

**A pooler gotcha.** `sql.unsafe(text, params)` in postgres.js stalls behind Supabase's transaction pooler because of a parameter-describe round trip. Every query here is a tagged template.

## Stack

Next.js 16 · React 19 · Tailwind CSS 4 · motion · Lenis · Supabase Postgres + pgvector 0.8 · transformers.js + ONNX Runtime · web-tree-sitter · Vercel (Mumbai, next to the database).

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL
npm run dev
```

```bash
npm test                     # unit tests (vitest)
npm run qa -- http://localhost:3000   # browser sweep: pages × themes × phone/desktop
npm run test:chunker -- path/to/file.ts
```

## Docs

- [Product requirements (PRD.md)](PRD.md)
- [Setup & operations](docs/SETUP.md)

## License

MIT © Sayantan Sinha
