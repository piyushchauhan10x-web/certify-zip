# Production setup — 7 October 2026

## Supabase

1. Run the entire [gmail_tokens.sql](gmail_tokens.sql) in the SQL Editor for the same project used by Auth. It creates a table keyed by auth.users(id), enables RLS, revokes client access, grants service_role access, and creates/configures the private certificates bucket with a 20 MB PDF limit. Do not run the two historical public.users migrations for this deployment. Do not drop existing account data without a migration plan.
2. In Authentication > Providers, enable Email; turn Confirm email OFF as requested. Existing unconfirmed accounts may still need confirmation through the dashboard. Enable Google and enter the Google Web client credentials there.
3. Set Site URL to https://certify-zip.vercel.app. Add these Redirect URLs exactly:
   - https://certify-zip.vercel.app/auth/callback
   - https://certify-zip.vercel.app/auth/callback?next=/reset-password
4. Configure custom SMTP and a verified sender in Supabase Auth for password resets to arbitrary users. The default email service is restricted to organization members. Disable email-provider link tracking. Keep the standard Supabase confirmation/recovery templates that carry the PKCE authorization code; open recovery links in the same browser that requested them. Review Auth email rate limits.
5. Copy the public project URL and public anon/publishable key to NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy the service-role key only to SUPABASE_SERVICE_KEY. Never put a service key in a NEXT_PUBLIC variable.
6. Inspect storage.objects policies: signed upload URLs need no broad anonymous read/write policy. Keep certificates private. Delete old flat-path files and abandoned uploads with the Storage API/dashboard after confirming they are no longer needed. Never delete storage.objects metadata directly. Sending and handled upload failures attempt cleanup; browser closure or provider cleanup failure can leave an orphan. Schedule an administrative Storage API cleanup for files older than 24 hours if needed.
7. Old custom public.users accounts/password hashes are not Supabase Auth accounts. Existing users must sign up in Supabase Auth, use Google, or be migrated using a separately reviewed account migration. Do not copy password hashes blindly.

## Google Cloud

1. Use OAuth credentials of type Web application. In the client used by Supabase Google login, authorize the exact callback shown by Supabase: https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback (use the displayed URL if Auth has a custom domain).
2. In the Gmail client identified by GOOGLE_CLIENT_ID, authorize exactly https://certify-zip.vercel.app/api/auth/gmail/callback. No trailing slash. The server derives this from APP_URL and logs only the final non-secret redirect URI. GOOGLE_REDIRECT_URI is obsolete and ignored.
3. Add https://certify-zip.vercel.app as an authorized JavaScript origin where applicable. Enable Gmail API and Google Sheets API.
4. Configure the OAuth consent screen/Google Auth Platform for External users, unless access is intentionally organization-only. Configure branding, support email, developer contact, and authorized domains. Use the public login page https://certify-zip.vercel.app/login as the app entry, and public privacy/terms URLs. Complete any domain ownership and app verification requirements.
5. Google login uses only identity scopes (openid, email, profile) via Supabase. Separate Connect Gmail requests gmail.send, identity scopes to identify the sender, and spreadsheets.readonly to preserve the existing Google Sheets importer. Users must tick Gmail permission to send and Sheets permission to import.
6. Testing mode only permits listed test users for these sensitive scopes and can expire refresh tokens after seven days. To serve arbitrary users, publish to production and complete required sensitive-scope verification. Publishing alone does not remove every unverified-app restriction. Workspace administrators and Google quotas may still restrict individual accounts.
7. Compare the exact redirect_uri from the server log with the Gmail client configuration. The Supabase callback and app Gmail callback are different and both must be authorized in their respective clients.

## Vercel

1. Set the Production environment variables from [.env.example](../.env.example): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, APP_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Set APP_URL to https://certify-zip.vercel.app. Use the same Supabase project for all three Supabase settings. Remove wrapping quotes/whitespace.
2. RESEND_API_KEY and EMAIL_FROM are optional. Both must be configured, and EMAIL_FROM's domain must be verified in Resend. The API key must be allowed to list domains and send email. Fallback is used only when there is no Gmail row; a revoked or incomplete connection never silently switches senders. The resend.dev test sender is rejected.
3. Old SUPABASE_URL, JWT_SECRET, FRONTEND_URL, GOOGLE_REDIRECT_URI and ENABLE_RESEND_FALLBACK are not used by the current application. VERCEL_PROJECT_PRODUCTION_URL and NODE_ENV are platform-provided; do not manually override NODE_ENV. VERCEL_OIDC_TOKEN, if supplied by Vercel, is not application configuration.
4. Deploy this checkout to the correct Vercel project/production branch. Redeploy after changing environment settings so new functions receive them. /api/auth/config now reads the public Supabase settings at request time; no service key is returned. Confirm the production deployment is the new revision, rather than relying on old route logs.
5. Open https://certify-zip.vercel.app/api/health. Expect 200 with {"ok":true,"missingEnv":[]}. A 503 lists required missing names only. This tests presence, not credential validity, bucket/schema readiness, OAuth verification, SMTP or end-to-end delivery. Check Vercel supports the configured 120-second /api/send function duration.
6. Ensure reverse proxy forwarded host/protocol match the public app. URL precedence is APP_URL, forwarded proto+host, VERCEL_PROJECT_PRODUCTION_URL, then localhost only in development. Do not configure localhost in production.

## Acceptance checks after deployment

- New email signup (confirmation disabled), duplicate signup, weak password, wrong password, login, reload, logout, and protected workspace redirect. Verify Remember me checked/unchecked cookie behavior; browser session restoration may preserve session cookies.
- Forgot password to a non-owner account through custom SMTP; open link in the requesting browser, reset, and sign in with the new password. Verify rate-limit messages and expired links.
- Google login uses no Gmail scope; cancel and retry. Connect Gmail separately, decline the Gmail checkbox, then reconnect and grant it. Inspect per-user rows only through the SQL Editor/service role.
- Use two separate browser profiles and two Google accounts. Confirm sender account isolation. Try another user's PDF path: expect rejection without download/deletion. An unauthenticated API request must return JSON, not a login HTML page.
- Import Excel and a Google Sheet shared with the connected account; verify sheet permission errors. Generate and preview certificates. Upload an approximately 8 MB PDF directly to Storage; /api/send contains only small JSON. Open the delivered attachment and verify full quality.
- Expire a test user's token and verify refresh; revoke consent and verify reconnect; exercise quota and permission errors. Check temporary objects are deleted on both success and failure. Do not retry ambiguous delivery before checking Sent mail.
- Bulk send: successful recipients remain marked, only failed/remaining recipients retry, and final counts are correct. Concurrency is one. Current application rate limiting is process-local, so provider quotas remain authoritative across Vercel instances.
- At 360, 390 and 768 px check the authenticated workflow, compact step header, form text size, 44 px controls, previews, and safe-area bottom buttons. Public login was checked locally; authenticated workflow needs configured credentials.

## References

- [Supabase SSR and PKCE](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Supabase SMTP restrictions](https://supabase.com/changelog/29370-supabase-auth-changes-to-default-email-provider)
- [Google sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Gmail media upload](https://developers.google.com/workspace/gmail/api/guides/uploads)
