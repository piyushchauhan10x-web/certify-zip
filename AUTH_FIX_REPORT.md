# Certify authentication repair

## Findings

The Supabase project configured in the local environment was checked read-only.
`users` exists, with `id`, `email`, `password_hash`, `google_access_token`,
`google_refresh_token`, and `google_email`. It lacks `google_token_expiry` and
`google_granted_scopes` (PostgreSQL error 42703). All four sampled password hashes
are bcrypt; no plaintext or missing hashes were found. No values were logged.
This does not prove Vercel points to the same database.

The previous session lookup explicitly selected the two missing columns, then
returned null for every database error. Consequently a correct email/password
could set a cookie and still appear logged out. Google callback also selected or
wrote these fields, making account creation/connection fail on this schema.

Supabase credentials were captured at module initialization, with a hardcoded
project URL fallback and no service-key validation. JWT_SECRET was already read
at request time, but signup created the account before checking it. Email matching
was case-sensitive, and database failures were mislabeled as bad credentials.

Google login requested identity, Gmail, and Sheets scopes together and could
attach an identity to an already signed-in account rather than look up its email.
Callback errors were not displayed by the login form. Login now looks up the
verified Google email and never changes Gmail tokens. Gmail authorization is a
separate flow bound to the current user and browser state. Sheets readonly scope
stays in Connect Gmail to preserve the existing Sheets import feature.

The reported configuration error means Google credentials or the application URL
could not be resolved. `redirect_uri_mismatch` means the redirect URI is not an
exact authorized URI for that OAuth client. `invalid_client` means Google rejected
the client credentials. The specific deployed Google/Vercel settings have not
been inspected or changed; local presence alone cannot establish their validity.

Password reset used onboarding@resend.dev and ignored Resend errors, falsely
reporting success. It now uses EMAIL_FROM when configured and returns
"Password reset email is not available yet" for provider failures, including 403.

## Final behavior

- All auth routes run dynamically in Node.js; configuration is read at request time.
- APP_URL is trimmed/unquoted with trailing slashes removed; fallback order is
  forwarded protocol + host, VERCEL_PROJECT_PRODUCTION_URL, development localhost.
- Login uses GOOGLE_REDIRECT_URI or /api/auth/google/callback on the derived URL.
  Its exact value is signed into the browser flow cookie and reused at exchange.
- Session JWT/cookie lasts 30 days: HttpOnly, Secure in production, SameSite=Lax,
  Path=/, host-only (no Domain). OAuth state expires in 10 minutes.
- Signup hashes with bcryptjs, validates password length including bcrypt's 72-byte
  limit, and requires configuration before writes. Emails are trimmed and matched
  case-insensitively with SQL wildcard characters escaped.
- /api/auth/gmail/connect requests Gmail sending and existing Sheets import access,
  offline access, consent, and incremental authorization. Callback stores granted
  scopes and tokens on the connecting user's row, never on a global account.
- /api/send requires that user's Gmail grant. Missing/revoked/unrefreshable access
  returns 401 RECONNECT_GMAIL; renewable access tokens refresh per user.
- Supabase upload route and certificate storage upload flow are unchanged.
- Login/signup/reset requests have a 30-second browser timeout and release their
  loading state in finally. Google callback failures have readable login messages.

## Required setup checklist

### Supabase

1. In the correct project's SQL Editor, run
   supabase/migrations/202610060001_auth_schema.sql before deploying.
2. Confirm the users table has all columns listed above, including the two metadata
   columns. The migration also adds a case-insensitive unique email index and denies
   direct anon/authenticated role access to users. Server access uses service_role.
3. If the index reports duplicate emails differing only in casing, resolve account
   ownership deliberately before rerunning; the migration never merges/deletes users.
4. Keep existing certificates bucket/upload settings unchanged.

### Google Cloud / Google Auth Platform

1. Select the project that owns the OAuth client. Under Clients (or APIs & Services
   > Credentials), use an OAuth 2.0 client of type Web application.
2. Register these exact Authorized redirect URIs, with no trailing slash:
   - https://certify-zip.vercel.app/api/auth/google/callback
   - https://certify-zip.vercel.app/api/auth/gmail/callback
3. Authorized JavaScript origin: https://certify-zip.vercel.app (no callback path).
4. Copy that same client's ID and corresponding secret into Vercel; do not mix
   clients/projects or use an API key, service-account credential, or mobile client.
5. Configure Branding/support email, Audience, and Data Access. Enable Gmail API
   and Google Sheets API to preserve sending and Sheets import. Declare identity,
   gmail.send, and spreadsheets.readonly scopes. Login itself requests only identity.
6. While the audience is in Testing, add every intended tester under Test users.
   For public access, publish and complete the verification Google requires for
   the requested scopes. Testing Gmail refresh tokens can expire after seven days.
7. For development only, also register http://localhost:3000/api/auth/google/callback
   and http://localhost:3000/api/auth/gmail/callback and use a matching local APP_URL.

### Vercel

1. In certify-zip > Settings > Environment Variables, set for Production:
   APP_URL=https://certify-zip.vercel.app
   GOOGLE_REDIRECT_URI=https://certify-zip.vercel.app/api/auth/google/callback
2. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from the same Web OAuth client.
   Store raw values without surrounding quotes or whitespace.
3. Set SUPABASE_URL and SUPABASE_SERVICE_KEY from the same Supabase project with
   the migration applied. Use its server-only service-role key, never an anon key.
4. Set a long random JWT_SECRET. Keep it stable across deployments; rotation logs
   everyone out. Never prefix credentials with NEXT_PUBLIC_.
5. For password reset, set RESEND_API_KEY and EMAIL_FROM using a verified Resend
   domain; onboarding@resend.dev cannot send normal reset mail to arbitrary users.
6. COOKIE_DOMAIN is no longer used; cookies are host-only. Prefer the production
   hostname for OAuth testing. If using previews/custom domains, authorize both
   callback URLs for each domain and set APP_URL/redirect consistently for that
   environment. Vercel supplies VERCEL_PROJECT_PRODUCTION_URL as a fallback.
7. Redeploy after setting environment variables; they do not repair an existing
   deployment automatically. Clear old cookies once if changing domains.

### Manual verification after deploy

1. Register with email/password; reach the workspace without sending mail.
2. Log out, log in with the same credentials and different email casing; reload
   and confirm the session persists. Wrong password is 401; duplicate signup is 409.
3. Continue with Google; confirm only identity access is requested, then land in
   the workspace even without Gmail consent. Cancel login and check readable error.
4. Before connecting Gmail, sending returns 401 RECONNECT_GMAIL.
5. Connect Gmail, grant sending permission, confirm the sender email; send a test
   certificate and check its PDF. Repeat with another user to check sender isolation.
6. Deny Gmail permission and confirm it is not marked connected. Revoke Google's
   app access and confirm sending requests reconnection without logging out.
7. Import an existing Google Sheet after connecting to confirm the retained scope.
8. Test password reset. With a verified sender it delivers; with a Resend test-sender
   restriction it returns the readable unavailable message without crashing.
9. Simulate a failed/slow auth request; the button must become usable within 30s.

Reference: https://developers.google.com/identity/protocols/oauth2/web-server

## Verification commands

- npm run build
- node scripts/check-auth.cjs (mock providers/database; no external writes)
- node scripts/check-gmail.cjs (attachment integrity, sender isolation, scopes,
  revocation, quota handling, per-user token refresh)
- git diff --check
- git diff --stat

No deployment, production environment edit, database migration, or outbound email
was performed as part of the local repair.
