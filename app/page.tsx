import { RepoCard } from '@/components/RepoCard';
import { RepoInput } from '@/components/RepoInput';
import { YourRepos } from '@/components/YourRepos';
import { listRecentRepos, publicRepo, type PublicRepo } from '@/lib/repos';

export const dynamic = 'force-dynamic';

const STEPS = [
  {
    n: '01',
    title: 'Fetch',
    body: 'One gzip tarball from GitHub, streamed through a tiny tar reader. No clone and no per-file API calls. The commit SHA is pinned from the archive header so every link is a permalink.',
    meta: 'codeload.github.com · streaming',
  },
  {
    n: '02',
    title: 'Filter',
    body: 'Dependencies, build output, lockfiles, minified bundles, binaries and files over 200 KB are dropped before anything is read into memory.',
    meta: 'node_modules · dist · *.lock · *.min.js',
  },
  {
    n: '03',
    title: 'Chunk by syntax',
    body: 'tree-sitter parses 13 languages. Chunks follow functions, classes and methods: oversized nodes split along their children, tiny neighbours merge, and each chunk keeps its qualified name.',
    meta: 'tree-sitter · AST-aware · ≤1,500 chars',
  },
  {
    n: '04',
    title: 'Embed locally',
    body: 'gte-small runs inside the serverless function through ONNX Runtime. There is no embedding API and no key. Work is split into small, resumable batches claimed with SKIP LOCKED.',
    meta: 'gte-small · 384-d · int8 ONNX',
  },
  {
    n: '05',
    title: 'Hybrid retrieval',
    body: 'Your question is embedded with the same model. The top 40 by cosine distance (HNSW) and the top 40 by Postgres full-text rank are fused with Reciprocal Rank Fusion.',
    meta: 'pgvector HNSW ⊕ tsvector · RRF k=60',
  },
];

export default async function Home() {
  let recent: PublicRepo[] = [];
  try {
    recent = (await listRecentRepos(9)).map(publicRepo);
  } catch (err) {
    console.error('[home] could not load recent repos', err);
  }

  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-raised px-3 py-1 font-mono text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            semantic code search · free · no sign-in
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
            Search code by what it does, <span className="text-muted">not what it&apos;s called.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted text-pretty">
            Paste a public GitHub repo and ask things like{' '}
            <span className="font-mono text-[15px] text-fg">“where do we retry failed requests?”</span>. grepless
            splits the code into functions and classes, embeds each one, and ranks them by meaning, so you find
            the code even when you don&apos;t know its name.
          </p>
          <div className="mt-9 max-w-2xl">
            <RepoInput autoFocus />
          </div>
          <div className="mt-5">
            <YourRepos />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Recently indexed</h2>
          <p className="text-xs text-faint">Open one to search it instantly</p>
        </div>
        {recent.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((r) => (
              <RepoCard key={r.id} repo={r} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Nothing indexed yet. Be the first: paste a repo above.
          </p>
        )}
      </section>

      <section id="how-it-works" className="mx-auto mt-24 max-w-6xl scroll-mt-20 px-4 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
          <p className="mt-3 text-muted">
            A retrieval pipeline you can inspect end to end. The only LLM call is the optional one-line
            <span className="text-fg"> Explain</span> button; search itself is embeddings and ranking.
          </p>
        </div>
        <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-5">
          {STEPS.map((s) => (
            <li key={s.n} className="flex flex-col gap-3 bg-raised p-5">
              <span className="font-mono text-xs text-accent">{s.n}</span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
              <p className="mt-auto pt-2 font-mono text-[11px] leading-relaxed text-faint">{s.meta}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Fact title="Why hybrid?">
            Small embedding models blur exact identifiers. Full-text search on split identifiers (
            <code className="font-mono text-fg">useAuthRetry → use auth retry</code>) catches them, and RRF merges
            both rankings without tuning score scales.
          </Fact>
          <Fact title="Why this matched">
            Every result says whether it matched on meaning, keywords or both, which words it shares with your
            question, and which lines to look at.
          </Fact>
          <Fact title="Incremental re-index">
            Files are hashed. A re-index downloads the latest commit and re-embeds only the files whose content
            changed, so a small push costs seconds, not minutes.
          </Fact>
        </div>
      </section>
    </main>
  );
}

function Fact({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}
