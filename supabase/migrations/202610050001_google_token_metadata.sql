-- Apply before deploying. Existing users must reconnect to record granted scopes.
alter table public.users
  add column if not exists google_token_expiry bigint,
  add column if not exists google_granted_scopes text[];
-- OAuth credentials must remain server-only. Ensure users RLS denies anonymous
-- and authenticated browser access to these columns; this app uses service role.
