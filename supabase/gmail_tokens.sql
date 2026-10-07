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

-- Private uploads are issued only by authenticated server handlers, using the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificates', 'certificates', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- No anonymous/client storage policies are required for signed upload URLs.
-- Inspect existing storage.objects policies and remove unrelated broad public grants.
-- Never delete storage.objects rows directly: remove orphaned files through Storage API.
