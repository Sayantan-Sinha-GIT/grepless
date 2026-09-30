# grepless: Product Requirements Document

**Owner:** Sayantan Sinha (GitHub: Sayantan-Sinha-GIT)
**Live:** https://grepless.vercel.app
**Repository:** https://github.com/Sayantan-Sinha-GIT/grepless
**Status:** v3 (Sign in with GitHub + private repos) built and tested
**Last updated:** 2026-09-27

---

## 1. Summary

grepless is a website for searching a GitHub repository by meaning instead of exact text. You paste a GitHub repo URL (public, or private after signing in with GitHub). grepless downloads it, splits every file into functions and classes, turns each piece into a 384-dimension embedding, and stores the vectors in Postgres with pgvector. You can then ask plain-English questions such as *"where do I handle auth retries?"*. It returns the matching code with file paths, line numbers, a "why this matched" explanation, and a permalink to those exact lines on GitHub.

The project demonstrates retrieval at the systems level, not a thin wrapper around a chat API:

- AST-aware chunking with tree-sitter
- a self-hosted embedding model
- HNSW vector indexing
- hybrid ranking (vector similarity plus Postgres full-text search, fused with Reciprocal Rank Fusion)
- incremental re-indexing by content hash

## 2. Problem

Text search (`grep`, GitHub search) only works when you already know the identifier. On an unfamiliar codebase, you know *what the code does*, not *what it is called*: "retry with backoff" might live in a function called `withResilience`. Semantic search closes that gap.

## 3. Goals and non-goals

**Goals**
1. Index a typical public repo (up to about 1,500 source files) with no manual steps and no paid API.
2. Return relevant results for natural-language questions in under 1 second once warm.
3. Make every result traceable: file, line range, symbol name, a reason for the match, and a GitHub permalink.
4. Make the retrieval pipeline visible and understandable to a technical reviewer.
5. Look and feel like a polished product: animated, responsive, in light and dark themes.

**Non-goals (v3)**
- Write access of any kind to GitHub. grepless only ever reads.
- Chat-style answer generation. Search is pure embeddings plus ranking.
- Repositories larger than the limits in §8.

## 4. Users

| User | Need |
|---|---|
| Developer onboarding onto a repo | "Where is X handled?" without reading every file |
| Technical reviewer / recruiter | Look at a working retrieval system and understand how it is built |
| Open-source contributor | Find the right place to make a change |

## 5. Features

### Core (must-have): all shipped
| # | Feature | Implementation |
|---|---|---|
| 1 | Repo input | Accepts `github.com/owner/repo`, `owner/repo`, SSH remotes, or any GitHub URL (branch and path parts are stripped). |
| 2 | Repo fetching | One gzip tarball from `codeload.github.com`, streamed through a hand-written tar reader. No clone, and it does not count against the REST API rate limit. The commit SHA comes from the pax global header. |
| 3 | Code chunking | tree-sitter (13 grammars: TS, TSX, JS/JSX, Python, Go, Rust, Java, C#, C/C++, Ruby, PHP, Bash, CSS). Chunks follow function, method and class boundaries; oversized nodes split along their children, tiny neighbours merge. Symbols keep qualified names such as `Ky.#retryFromError`. JS/TS test blocks (`describe`/`it`) and `x.y = function` assignments are named. Markdown splits by heading; other text uses overlapping line windows. |
| 4 | Embeddings | `gte-small` (384-d, int8 ONNX) runs inside the Vercel function via transformers.js. The embedded text is `path — kind symbol (humanised words)` followed by the code. |
| 5 | Vector storage | Supabase Postgres: `chunks.embedding vector(384)` with an HNSW cosine index, plus a weighted `tsvector` (symbol and path words = A, body = D) with a GIN index. |
| 6 | Semantic search | The query is embedded with the same model. Hybrid SQL takes the top 40 by cosine (HNSW, iterative scan) and the top 40 by `ts_rank_cd`, then fuses them with RRF (k = 60, keyword weight 0.6). Path priors apply: tests ×0.65, docs ×0.9. |
| 7 | Results display | Path, line range, symbol and kind, an animated similarity ring, highlighted code, and a "why this matched" line (meaning / keywords / both, shared words, lines to read). |
| 8 | Indexing status | `queued → fetching → indexing → ready` (or `error`) in an animated "reactor": progress ring, stage timeline, live log, files / skipped / chunks / speed counters, and an ETA. Resumable: reopening the page continues the job. |

### Should-have: all shipped
| # | Feature | Implementation |
|---|---|---|
| 9 | Re-index | Compares the new commit SHA with the stored one. If it changed, only files whose SHA-1 content hash changed are re-chunked and re-embedded; deleted files are removed. |
| 10 | File filtering | Skips `node_modules`, `vendor`, `dist`, `build`, dot-folders, lockfiles, minified or generated files, binaries, images, and files over 200 KB. |
| 11 | Click-through | Every result links to `github.com/owner/repo/blob/<commit-sha>/path#L10-L42`. |
| 12 | Recent repos | "Recently indexed" on the home page, a full **Explore** page (filter, sort, language chips), and "you opened" memory in browser storage. |

### Nice-to-have
| # | Feature | Status |
|---|---|---|
| 13 | One-line AI explanation of a result | Shipped. **Explain** button, the only LLM call in the product. Providers are tried in order: **Gemini** free tier (`GEMINI_API_KEY`), then **Groq** free tier (`GROQ_API_KEY`) if Gemini fails or returns nothing, then optionally Vercel AI Gateway. The button is hidden until a key is set, and each answer shows which provider replied. |
| 14 | Sign in with GitHub for private repos | Shipped (v3). See §12. grepless is a **GitHub App** with read-only *Contents* + *Metadata* permissions; each person picks which repos it may read. Private indexes are visible only to people GitHub says can read the repo. |

## 6. Pages

| Route | Purpose | Highlights |
|---|---|---|
| `/` | Landing | 3D vector-space hero (canvas point cloud; the typed query flies to its nearest neighbours), live site counters, tilted language ticker, **live demo** running real searches on `sindresorhus/ky`, animated feature bento, 5-step pipeline beam, recent repos, closing CTA |
| `/explore` | Every indexed repo | Word-by-word headline, count-ups, filter + animated sort tabs, language chips, tilt/spotlight cards with a shared-element morph into the repo page |
| `/how-it-works` | Technical walkthrough | Scroll story: a pinned scene changes per chapter (tarball stream, file sieve, AST → chunks, vectors clustering, RRF merge), an architecture diagram, headline numbers |
| `/r/[owner]/[name]` | Workspace | Morphing title, avatar, stat pills, animated language bar, indexing reactor, sticky glowing search bar with typewriter placeholder, language filter, animated result cards |
| `/me` | Your repos | Signed out: animated padlock scene, "Sign in with GitHub", what grepless can and can't do. Signed in: profile, every repo granted to grepless (filter; All / Private / Public / Indexed tabs), index status, "Index" / "Search" per repo, installations with "manage" links, "choose repos on GitHub" step when nothing is granted yet |
| private repo, no access | Gate | Same padlock scene; identical wording whether the repo is private or doesn't exist (like GitHub's 404) |
| 404 / error | Friendly failure | "Lost vector" animation, repo input, retry |

## 7. Design system (v2, "vector field")

Inspired by the owner's references (`design-inspire/`, not committed) and the Dispatch "lavender field" system.

| Element | Rule |
|---|---|
| Theme | Light and dark, with a toggle in the header. A boot script sets `data-theme` before first paint (stored choice, else the OS setting), so there is no flash. The switch plays a circular reveal from the toggle using the View Transitions API. The theme is read through `useSyncExternalStore`. |
| Colour | Violet `brand` (#6b4ef0 light / #a996ff dark) for everything important; `lime` (#c8f34a) only as a signal (live dots, query point, marker highlights); pink and sky as cluster accents. All colours are CSS tokens in `app/globals.css`. |
| Type | Bricolage Grotesque for display (very large, light weight, tight tracking), Onest for body, JetBrains Mono for code and data. |
| Surfaces | `.sheet` (white, soft violet shadow), `.sheet-ink` (near-black, used for the live demo, reactor, code and footer in both themes), `.glass` (frosted header). Pills everywhere; raised radius scale. |
| Backdrop | Fixed drifting colour fields, a masked dot grid and SVG film grain. Pure CSS. |
| Motion | `motion` (Framer Motion) for reveals, word-by-word headlines, springs, layout animations and count-ups; Lenis for smooth scrolling; React `<ViewTransition>` for page transitions and the repo-card → repo-page title morph. Canvas animations pause off-screen and in hidden tabs. `prefers-reduced-motion` disables all of it. |
| Interaction | Magnetic buttons, cursor spotlight + 3D tilt on cards, rotating conic glow around focused inputs, `/` to focus search. |

## 8. System design

```
Browser ──POST /api/repos──────────▶ create/lookup repo row (queued)
        ──POST /api/repos/:id/prepare─▶ tarball → filter → hash → diff vs DB
                                        → tree-sitter chunk → insert chunks (embedding NULL)
        ──POST /api/repos/:id/embed ──▶ claim ≤12 pending chunks (FOR UPDATE SKIP LOCKED, 2-min lease)
           (×3 parallel workers)        → gte-small → UPDATE embedding → progress
        ──POST /api/search ───────────▶ embed query → hybrid SQL (HNSW + GIN, RRF) → reasons
        ──POST /api/explain ──────────▶ Gemini → Groq fallback (optional)
        ──GET  /api/auth/login ───────▶ GitHub authorize (state cookie) → /api/auth/callback
                                        → code → user token → users + sessions → cookie
        ──GET  /api/me/repos ─────────▶ installations → granted repos → index status
```

**Client-driven embedding.** Serverless functions have time limits and a large repo takes minutes to embed. Short idempotent batches mean no request runs long, several viewers share the work safely, and a closed tab only pauses the job.

**Embedding inside the app.** Supabase's built-in `gte-small` edge runtime measured about 600 ms of CPU per chunk, which exceeds the free tier's 2 s CPU cap after 3 chunks. onnxruntime in a Vercel Node function does about 12 chunks/s at no cost, with no key.

**Hybrid search.** Small embedding models blur exact identifiers. Full-text search over split identifiers (`useAuthRetry` → `use auth retry`) catches them, and RRF merges both rankings without calibrating score scales.

### Data model
- `repos`: owner, name, slug (unique), description, stars, commit_sha, status, counters, languages histogram, timestamps, search_count.
- `files`: repo_id, path, language, content_hash (SHA-1), size, line count. Unique (repo_id, path).
- `chunks`: repo_id, file_id, path, language, symbol, kind, start/end line, content, `fts tsvector`, `embedding vector(384)`, `claimed_at`.
- `repos.is_private`: private repos never appear on Explore, the home page lists or the site counters.
- `users`: GitHub user id, login, name, avatar, **sealed** access + refresh tokens and their expiry times.
- `sessions`: SHA-256 of the session cookie (the raw value never reaches the DB), user, expiry (30 days).
- `repo_access`: (repo, user, verified_at). Who may see a private repo's index.

### Limits
| Limit | Value |
|---|---|
| Tarball size | 60 MB compressed |
| Indexed files per repo | 1,500 |
| Chunks per repo | 6,000 |
| Max file size | 200 KB |
| Concurrent indexing repos | 3 (others wait in `queued`) |
| Search results | 10 per query |

### Security
- RLS is on for every table, and all tables are revoked from `anon` and `authenticated`, so nothing is exposed through Supabase's REST API.
- The app uses a dedicated least-privilege Postgres role (`grepless_app`) through the Supavisor transaction pooler. Its connection string exists only as an encrypted Vercel environment variable.
- Signed out, only public repos are fetched. Private repos are fetched only with the requesting person's own GitHub token.
- GitHub tokens are sealed with AES-256-GCM (key from `AUTH_SECRET`) before storage. Session cookies are random 256-bit values, `httpOnly`, `SameSite=Lax`, `Secure` in production; the DB stores only their hash.
- Sign-in uses a one-time `state` cookie (10 min) against CSRF; post-sign-in redirects accept only same-site paths. Sign-out is a POST with an Origin check.
- Every route that reads a repo (page, status, prepare, embed, re-index, search, explain) checks access. Without access, the answer is the same 404 as for a repo that doesn't exist.
- Server-side validation and caps on every route. Code snippets are HTML-escaped by the highlighter before rendering.

### Reliability
- **Pooler stall (fixed 2026-09-27).** `sql.unsafe(text, params)` makes postgres.js ask the server to describe parameter types first, and that round trip stalls indefinitely behind Supabase's transaction pooler. It surfaced as a 60 s statement timeout in production and a hung dev server. All queries are now tagged templates; a stress test went from stalling on the first round to 40/40 clean.
- Connections are recycled (`max_lifetime`, `keep_alive`) so a pooler hiccup can't leave dead sockets.
- Page data loads with `withTimeout`: if the database is slow, the page still renders without that data.
- **Keep-alive.** Supabase pauses free projects after about a week without database activity, so a Vercel Cron job calls `/api/keep-alive` once a day (one `count(*)` on `repos`).

## 9. Testing

| Layer | What | Command |
|---|---|---|
| Unit (vitest) | Repo URL parsing, file filtering, tokenising / stemming / tsquery safety, the chunker on TS / Python / Markdown, the Gemini → Groq fallback chain, and sign-in: token sealing / tamper detection, redirect safety, code exchange, refresh, repo visibility, paginated repo listing (all with a fake `fetch`) | `npm test`: 58/58 pass |
| Type check | Whole project | `npm run lint` |
| Privacy check | A fixture private repo against a running server: hidden from anonymous visitors on all 7 routes, the page, Explore and lists; hidden from a signed-in person without access; visible with access; hidden again when access is stale and GitHub can't confirm, or the session expired; sign-out deletes the session | 18/18 pass locally |
| Private download | Signed out the private `grepless` repo looks missing and asks for sign-in; with a token its tarball downloads and parses | passes |
| Browser sweep | 6 pages × light/dark × phone/desktop: console errors, failed requests, broken images, sideways overflow, unlabelled buttons, theme toggle + memory, mobile menu | `npm run qa -- <url>`: 24/24 clean locally |
| Live checks | Index → embed → search on production; Explain answered by Gemini on the live site | manual scripts |

## 10. Success metrics
- Time to searchable on a ~100-file repo: under 90 s (ky: 988 chunks in 75 s).
- Warm search latency: ~50–70 ms on production.
- For the demo queries on the demo repos, the expected function is in the top 3.

## 11. Future work
1. Cross-repo search across everything a person has granted.
2. A code-specialised embedding model behind a flag, with an offline evaluation set.
3. Webhook-driven re-index on push (the GitHub App already exists; its webhook is off).
4. Cross-encoder re-ranking of the top 20.

## 12. Sign in with GitHub (v3)

**Why a GitHub App, not an OAuth App.** A classic OAuth App can only reach private repos with the `repo` scope, which is full read *and write* access to every repo. A GitHub App asks for exactly *Contents: read* and *Metadata: read*, and the person chooses which repos (or "All repositories") on GitHub's own install page. The user-to-server token can only reach repos that are both visible to the person and granted to the app.

**Flow**
1. "Sign in with GitHub" → `/api/auth/login` sets a one-time `state` cookie and redirects to GitHub.
2. GitHub → `/api/auth/callback?code&state`. The state is checked, the code is swapped for a user token (8 h) + refresh token (6 months), the profile is read, and a session is created.
3. `/me` lists installations and granted repos. If there are none, it shows the "choose repos on GitHub" step. After installing, GitHub returns to `/api/auth/installed` → `/me?installed=1`.
4. Opening a private repo creates the row as private and records access. Indexing downloads it through the API with the person's token (a short-lived signed codeload URL).

**Token renewal.** Tokens are renewed a minute before expiry, inside a transaction holding a row lock, because refresh tokens are single-use.

**Access checks.** Public repo: everyone. Private repo: a `repo_access` row verified in the last hour, else GitHub is asked with the person's token (`GET /repos/{owner}/{name}`). "Yes" grants, "no" revokes, and "GitHub unreachable" keeps existing access but never grants new access. If a private repo has since been made public on GitHub (checked anonymously, at most every 10 minutes per server), it opens up for everyone.

**Configuration (Vercel env).** `GITHUB_APP_SLUG`, `GITHUB_APP_ID`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `AUTH_SECRET`. Sign-in stays hidden until all of these are set. The app is created with `node scripts/create-github-app.mjs` (GitHub's manifest flow: one click on GitHub).
