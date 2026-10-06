-- Run in Supabase SQL Editor before deploying the auth fix.
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.users
  add column if not exists password_hash text,
  add column if not exists google_access_token text,
  add column if not exists google_refresh_token text,
  add column if not exists google_email text,
  add column if not exists google_token_expiry bigint,
  add column if not exists google_granted_scopes text[];
-- Resolve accounts differing only in casing before retrying this index.
-- Never silently merge or delete existing accounts.
create unique index if not exists users_email_case_insensitive
  on public.users (lower(email));
alter table public.users enable row level security;
revoke all on public.users from anon, authenticated;
grant all on public.users to service_role;
