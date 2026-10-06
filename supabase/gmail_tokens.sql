-- Run in Supabase SQL Editor. No migration of legacy public.users accounts.
create table if not exists public.gmail_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_access_token text,
  google_refresh_token text,
  google_token_expiry bigint,
  google_granted_scopes text[] not null default '{}',
  google_email text,
  updated_at timestamptz not null default now()
);
alter table public.gmail_tokens enable row level security;
revoke all on public.gmail_tokens from public, anon, authenticated;
grant all on public.gmail_tokens to service_role;
-- No client policies: only the server service role can read/write credentials.
