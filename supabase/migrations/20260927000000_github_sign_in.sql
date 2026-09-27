-- Sign in with GitHub: users, sessions, and per-user access to private repos.
-- Tokens are GitHub App user-to-server tokens, sealed with AES-256-GCM by the
-- app (lib/crypto.ts) before they reach the database.

alter table public.repos add column is_private boolean not null default false;

create table public.users (
  id bigint primary key,                 -- GitHub user id
  login text not null,
  name text,
  avatar_url text,
  access_token text not null,            -- sealed
  access_expires_at timestamptz,         -- null when the token does not expire
  refresh_token text,                    -- sealed
  refresh_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sessions (
  id text primary key,                   -- sha256 of the cookie value; the raw value never touches the DB
  user_id bigint not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_user_idx on public.sessions (user_id);

-- Who may see a private repo's index. Rows are re-verified against GitHub
-- once they are an hour old, so revoked access stops working.
create table public.repo_access (
  repo_id uuid not null references public.repos (id) on delete cascade,
  user_id bigint not null references public.users (id) on delete cascade,
  verified_at timestamptz not null default now(),
  primary key (repo_id, user_id)
);
create index repo_access_user_idx on public.repo_access (user_id);

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.repo_access enable row level security;
revoke all on public.users, public.sessions, public.repo_access from anon, authenticated;

grant select, insert, update, delete on public.users, public.sessions, public.repo_access to grepless_app;
create policy "app role full access" on public.users       for all to grepless_app using (true) with check (true);
create policy "app role full access" on public.sessions    for all to grepless_app using (true) with check (true);
create policy "app role full access" on public.repo_access for all to grepless_app using (true) with check (true);
