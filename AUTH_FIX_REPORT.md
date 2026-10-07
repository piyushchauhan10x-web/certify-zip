# Certify production hardening report

Date: 7 October 2026. Files were edited and checked locally. No production deployment, Google/Supabase console changes, real account creation, password-reset email, or certificate email was performed.

## Root cause and evidence

The local .env.local still contains SUPABASE_URL but does not contain NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. The old browser client throws for missing configuration. AuthForm caught every exception and replaced it with “Sign-in timed out or could not connect”, even when nothing timed out. This is a confirmed local cause; production's environment and active deployment were not inspected, so its precise cause remains unverified.

The checkout already used Supabase Auth, not custom JWT authentication. There is no /api/auth/login route in this source. Historical production logs mentioning that route can indicate an older deployment or client, but those logs alone cannot establish what is currently deployed. /api/auth/me remains valid: it checks Supabase Auth and reports Gmail connection status.

Browser Auth configuration now comes from /api/auth/config at request time. Only the public URL/key and canonical app URL are returned; privileged keys are rejected. Missing names are shown inline, and the login button recovers. Local HTTP and browser smoke checks confirmed this behavior.

## Audited surface

- Pages: /, /login, /register (retained), /signup (added), /forgot-password, /reset-password, /privacy, /terms.
- Auth handlers: /auth/callback, /api/auth/config (added), /api/auth/me, /api/auth/gmail/connect and callback, /api/auth/google (legacy URL returns explicit 410 JSON).
- Feature handlers: /api/upload-url POST and DELETE, /api/send POST, /api/sheets POST, /api/health GET (added). Unreferenced /api/generate stub removed; real generation remains browser-side.
- Session code: middleware.ts, lib/auth.ts, lib/supabase/client.ts, server.ts, config.ts, sessionCookies.ts.
- Frontend: AuthForm, ForgotPasswordForm, ResetPasswordForm, ConnectGmail, SendPanel, GoogleSheetImport, UploadExcel, TemplateManager and PreviewGrid inspected; generation/import libraries inspected.
- Historical public.users SQL remains as history, explicitly excluded from setup. Unused Resend password-reset function removed. No custom JWT login route remained to remove. Existing uncommitted OAuth files were incorporated rather than discarded.

## Bugs and fixes

| Finding | Fix / remaining external action |
|---|---|
| Old local env name; required public Auth settings absent | Runtime public configuration, names-only error; set the two missing settings manually |
| All login exceptions reported as timeout | Preserve readable exception/server messages; retain provider-specific credential/duplicate/weak-password messages |
| Browser config depended on an old build | Load public configuration at request time; do not expose privileged keys |
| Middleware ran on APIs/static assets and did not guard private pages | Explicit matcher/public pages, verified getUser, cookie-preserving redirects, bounded network requests |
| Gmail table failure looked like a failed login | /api/auth/me returns the valid session plus a separate Gmail status error |
| Remember me was inert | Session versus persistent cookie lifetime honored across browser writes and server refresh; deletion cookies preserved |
| Logout could reject without recovery | Bounded local-session sign-out, visible error, loading state, redirect/refresh |
| /signup absent | Add alias while preserving /register and current form design |
| Reset redirect value inconsistent | Use /auth/callback?next=/reset-password; callback accepts safe reset target and exchanges PKCE code |
| Recovery errors hidden; sign-out after reset unchecked | Real inline errors, rate-limit mapping, check logout result |
| Legacy /api/auth/google starts wrong OAuth flow | Explicit 410 JSON directs clients to Supabase Google login; UI already uses signInWithOAuth |
| Callback override could diverge from canonical APP_URL | One URL helper; remove GOOGLE_REDIRECT_URI override and raw Host fallback |
| Gmail connection errors appeared as raw JSON navigation | ConnectGmail requests an OAuth URL as JSON and shows inline errors; legacy redirect flow still works |
| Connect lacked stable unauthenticated code | 401 LOGIN_REQUIRED; signed, expiring, per-user state retained; final callback URI logged |
| OAuth token database/config failures obscure | Exact missing config names and safe step diagnostics; per-user table and setup SQL documented |
| Missing Gmail scope incorrectly returned 401 | 403 GMAIL_PERMISSION_MISSING with reconnect/checkbox guidance; denied consent also clears old tokens |
| Refresh credentials missing without exact names | Report GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET names; revoked token maps to 401, quota to 429 |
| PDFs not tied to owning account | Upload path is user UUID/random UUID.pdf; send/delete validate owner before accessing storage |
| Large payload/HTML/header input insufficiently constrained | Small strict JSON schema, recipient/subject limits, escaped message HTML, PDF signature/size checks |
| Resend fallback unreachable and raw provider errors possible | Only no-row users can use a currently verified domain; reject test sender; safe error/quota mapping |
| Frontend fetches parsed JSON before checking status or lacked body deadlines | Shared response helper checks status, reads text safely, preserves server messages, bounds full body read |
| Retries resend successful recipients | Sequential bulk loop preserves successes; retries only remaining recipients; final counts and per-recipient errors |
| Upload failures can leave temporary objects | DELETE cleanup endpoint and browser cleanup; send cleanup remains in finally; abandoned sessions need administrative orphan cleanup |
| Generation exception leaves button stuck | try/catch/finally, visible error, wait for document fonts, readable image-load failure |
| Sheets requests could hang or hide permission errors | Provider timeout, scope check, clear 403 guidance, proper malformed-JSON response |
| Some API routes lacked runtime/dynamic declarations | All remaining API routes explicitly Node/dynamic; longer handlers have duration budgets |
| Mobile form text/control sizing incomplete | 16 px inputs through tablet widths, 44 px buttons, bounded previews, compact mobile step/progress, safe-area send control |
| Privacy claims omitted server imports/PDF storage | Accurate processing/token/storage/deletion disclosure, no sale, contact address, fixed update date |
| Footer policy links absent | Public Auth and workspace footer links |
| .env ignore pattern incomplete / example incomplete | Ignore .env* except example; document every active configuration name and optional Resend settings |
| No names-only health endpoint | Add /api/health; returns 503 with missing names or 200 when all required names are present |
| Running dev process overwrites production manifests | Separate .next-dev from production .next; production build now succeeds |

## Active environment-variable inventory

| Name | Requirement and use |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Required: browser/server Auth and Storage/DB endpoint |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Required: public anon or publishable key for Auth |
| SUPABASE_SERVICE_KEY | Required for Gmail/storage: server-only DB, signed upload, token persistence and state signature |
| GOOGLE_CLIENT_ID | Required for Gmail/Sheets OAuth; Supabase Google login also has separate dashboard provider setup |
| GOOGLE_CLIENT_SECRET | Required for Gmail code exchange and refresh; server-only |
| APP_URL | Recommended canonical production URL; required if no valid forwarded origin/platform fallback |
| VERCEL_PROJECT_PRODUCTION_URL | Platform-supplied fallback when APP_URL and forwarded origin absent |
| RESEND_API_KEY | Optional fallback; domain-read and email-send access required |
| EMAIL_FROM | Optional fallback sender with a domain actually verified in Resend |
| NODE_ENV | Framework-managed cookie security/development-only URL behavior |

All are documented in .env.example, including platform-managed names as comments. SUPABASE_URL, JWT_SECRET, FRONTEND_URL, GOOGLE_REDIRECT_URI and ENABLE_RESEND_FALLBACK are obsolete. VERCEL_OIDC_TOKEN is not read by application code. No env values were printed or changed.

## Validation

- npm run build: PASS on the final code; all routes compiled/prerendered. Nonblocking webpack cache serialization notices remain; no TypeScript, route or prerender error remains.
- npx tsc --noEmit: PASS.
- scripts/check-app-url.cjs: PASS — canonical URL priority, production-only HTTPS, development fallback, cookies, missing names.
- scripts/check-supabase-auth.cjs: PASS — verified getUser, signed state, tamper rejection, offline consent and per-user lookup.
- scripts/check-gmail.cjs: PASS — complete 8 MB attachment, current-user sender, missing scope, invalid_grant, quota and refresh persistence.
- scripts/check-production-flows.cjs: PASS — Remember me/deletion lifetimes, response body timeout, non-JSON and real errors, runtime config/privileged key guard, foreign path rejection without deletion, recipient validation, cleanup, no unverified fallback.
- Local production HTTP smoke: /login, /signup, /forgot-password, /privacy, /terms returned 200. / returned 307 to login. /api/health and /api/auth/config returned 503 identifying the two missing public Supabase settings.
- Local browser email-login failure smoke: submitted synthetic test values; inline missing-env error displayed and Sign In became enabled again. No request reached a real account service because configuration is missing.
- Responsive login: document widths matched 360, 390 and 768 px with no horizontal scroll. Final 360 px DOM verification confirmed 16 px inputs and 44 px buttons. Authenticated workspace, real SMTP, recovery, OAuth consent and real sending remain pending configured-service acceptance checks.

The first build attempts failed because a running dev server wrote development manifests into .next. The old cache was moved to ignored .next-pre-hardening; development now uses .next-dev. Temporary preview servers were used only for verification.

## SQL and manual actions

Run the complete [supabase/gmail_tokens.sql](supabase/gmail_tokens.sql) in Supabase. The exact Supabase, Google Cloud, Vercel and post-deployment acceptance checklist is in [supabase/AUTH_SETUP.md](supabase/AUTH_SETUP.md). No SQL was executed against production here.

Production cannot be certified for arbitrary users until environment settings, schema/bucket setup, Supabase custom SMTP, Google production publishing/verification and a deployed revision are complete. Google/provider quotas and Workspace policies still apply. In-memory app rate limiting is per process, not a distributed quota. Cleanup failures and abandoned uploads require a Storage API cleanup policy. Delivery timeouts can be ambiguous; check Sent before retrying.

## Changed files and diff

The exact tracked-file output of git diff --stat is saved in [git-diff-stat.txt](git-diff-stat.txt). Git diff does not include untracked new files; those are listed separately in [changed-files.txt](changed-files.txt). The inventory includes pre-existing uncommitted OAuth work incorporated in this change. Generated tsconfig.tsbuildinfo was restored to its unchanged initial contents after type checking.
