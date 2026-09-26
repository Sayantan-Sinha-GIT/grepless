-- grepless schema. Applied to the Supabase project `semantic-code-search`.
create extension if not exists vector with schema extensions;

create table public.repos (
  id uuid primary key default gen_random_uuid(),
  owner text not null,
  name text not null,
  slug text generated always as (lower(owner) || '/' || lower(name)) stored unique,
  description text,
  stars integer,
  primary_language text,
  commit_sha text,
  status text not null default 'queued'
    check (status in ('queued', 'fetching', 'indexing', 'ready', 'error')),
  status_message text,
  total_files integer not null default 0,
  skipped_files integer not null default 0,
  total_chunks integer not null default 0,
  embedded_chunks integer not null default 0,
  languages jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  indexed_at timestamptz,
  last_searched_at timestamptz,
  search_count integer not null default 0
);

create table public.files (
  id bigint generated always as identity primary key,
  repo_id uuid not null references public.repos (id) on delete cascade,
  path text not null,
  language text not null,
  content_hash text not null,
  size_bytes integer not null,
  line_count integer not null,
  unique (repo_id, path)
);

create table public.chunks (
  id bigint generated always as identity primary key,
  repo_id uuid not null references public.repos (id) on delete cascade,
  file_id bigint not null references public.files (id) on delete cascade,
  path text not null,
  language text not null,
  symbol text,
  kind text not null,
  start_line integer not null,
  end_line integer not null,
  content text not null,
  fts tsvector not null,
  embedding extensions.vector(384),
  claimed_at timestamptz
);

create index chunks_repo_idx on public.chunks (repo_id);
create index chunks_file_idx on public.chunks (file_id);
create index chunks_pending_idx on public.chunks (repo_id) where embedding is null;
create index chunks_fts_idx on public.chunks using gin (fts);
create index chunks_embedding_idx on public.chunks using hnsw (embedding extensions.vector_cosine_ops);
create index files_repo_idx on public.files (repo_id);
create index repos_status_idx on public.repos (status, indexed_at desc);

-- Nothing is exposed through Supabase's auto-generated REST API.
alter table public.repos enable row level security;
alter table public.files enable row level security;
alter table public.chunks enable row level security;
revoke all on public.repos, public.files, public.chunks from anon, authenticated;

-- The app connects as a dedicated least-privilege role. The password is set
-- out-of-band (never committed):
--
--   create role grepless_app with login password '<generated>' connection limit 40;
--   grant usage on schema public, extensions to grepless_app;
--   grant select, insert, update, delete on public.repos, public.files, public.chunks to grepless_app;
--   grant usage, select on all sequences in schema public to grepless_app;
--   create policy "app role full access" on public.repos  for all to grepless_app using (true) with check (true);
--   create policy "app role full access" on public.files  for all to grepless_app using (true) with check (true);
--   create policy "app role full access" on public.chunks for all to grepless_app using (true) with check (true);
--   alter role grepless_app set search_path = public, extensions;
--   alter role grepless_app set statement_timeout = '60s';
