# Login diagnostics follow-up — 7 October 2026

## Confirmed root cause

A read-only check of the live production site returned:

- /login: HTTP 200.
- /api/health: HTTP 503, ok false, missingEnv containing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
- /api/auth/config: HTTP 503 JSON with an error field.

Both public Supabase settings are absent in the currently running production deployment. This is direct evidence, not an inference from the local environment. It blocks email and Google sign-in before a usable Supabase client can be created. No environment values, credentials or tokens were printed.

The current deployed JavaScript contains /api/auth/config and no longer contains either reported generic timeout string. The earlier source version does contain those strings. The browser message reported by the user therefore differs from the bundle served during this audit; the reason that browser displayed older code was not established.

## Exact original failure path

Google button onClick -> handleGoogle -> createClient().auth.signInWithOAuth -> withAuthTimeout -> catch -> setError("Google sign-in timed out or could not connect. Please try again.").

Email form onSubmit -> handleSubmit -> createClient() -> signInWithPassword (or signUp) -> withAuthTimeout -> catch -> setError("Sign-in timed out or could not connect. Please try again.").

The catch is triggered by any exception: missing client configuration; rejected fetch/network operation; the 30-second Promise.race timer; PKCE/browser storage or crypto rejection; SDK navigation failure; or another thrown error in the try block. The generic text did not prove that a timeout occurred. Supabase responses with a returned error object used authMessage instead, while a missing OAuth URL had its own separate message.

The earlier browser client directly read process.env.NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Next.js can inline those values at build time. The current revision already loaded config at runtime, and this fix retains that path: browser -> /api/auth/config -> publicAuthConfig(), which reads process.env by variable name on the server for each request. Missing names are now caught on initial render, before either sign-in action is enabled.

## Changes in this follow-up

| Area | Result |
|---|---|
| Login preflight | Fetch runtime configuration on mount; show the actual error inline; disable Google/email buttons until ready; provide a retry |
| Google OAuth | Await provider google with default scopes only; skipBrowserRedirect true; explicitly call window.location.assign(data.url); no OAuth Promise.race timer |
| Redirect state | Keep controls disabled after navigation starts, restore them on failure or browser pageshow; never label a successful navigation a timeout |
| Email sign-in | Same configuration gate and real Supabase error handling; actual transport timeout is 30 seconds |
| Error diagnostics | Named failure steps; readable provider errors; scrub URLs and recognizable token/credential forms instead of dumping exceptions |
| Supabase provider check | Probe public /auth/v1/settings using only the public URL and key, cache disabled, five-second timeout; read external.google only when boolean |
| Health JSON | Return ok, missingEnv, supabaseReachable, and googleProviderEnabled only when known; missing config/unreachable/disabled provider produces 503 |
| Configuration JSON | Missing configuration returns 503 with names; rejected key, non-JSON response, network failure and real health timeout have distinct errors; disabled Google leaves email available |
| Auth callback | Preserve readable provider/session-exchange errors through the inline login message; allow only safe reset/home destinations |
| Public routing | /reset-password explicitly public, together with login/signup/register/forgot-password/auth routes/health/privacy/terms; API and static paths excluded by matcher |
| Environment example | Required public settings and Supabase provider setup clearly distinguished from separate Gmail OAuth credentials |

The auth settings shape is verified against [Supabase Auth source](https://raw.githubusercontent.com/supabase/auth/master/internal/api/settings.go). Gmail connection scopes remain separate from Google login. No visual redesign or business feature change was made.

## Verification

- npm run build: passed; no compiler, type or prerender errors.
- npx tsc --noEmit: passed.
- node scripts/check-login-diagnostics.cjs: passed. Exercises explicit OAuth navigation, absence of Gmail scopes, returned provider error/missing URL, message redaction, settings reachability/provider flags, rejected public key, actual network failure, five-second deadline, missing runtime settings, callback error detail and safe next handling.
- Existing production-flow, Supabase Auth and URL regression checks: passed.
- Local production HTTP: login/signup/reset-password/privacy/terms returned 200; private root redirected (307).
- Local /api/health: 503 with ok false, the two missing public env names and supabaseReachable false. googleProviderEnabled omitted because no valid config was available for the probe.
- Local /api/auth/config: 503, “Missing config: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY”.
- Browser smoke: the same message appears immediately without entering credentials; Google and Sign In are disabled; Retry configuration rechecks and returns to its enabled state with the same real error. Screenshot saved in the chat's visualization artifacts.

No real successful account login or OAuth consent was attempted because the required production/local settings are absent. These file changes were not deployed, and Vercel settings were not modified.

## Exact configuration checklist

### Vercel

Set these in the Production scope and redeploy the intended branch/revision:

1. NEXT_PUBLIC_SUPABASE_URL — URL of the Supabase project used for Auth.
2. NEXT_PUBLIC_SUPABASE_ANON_KEY — public anon or publishable key from that same project; never the service-role key.
3. APP_URL — canonical HTTPS origin of the production app, without wrapping quotes or trailing slash.
4. SUPABASE_SERVICE_KEY — server-only service-role key for Gmail token storage and private certificate storage.
5. GOOGLE_CLIENT_ID — Web OAuth client for separate Gmail connection.
6. GOOGLE_CLIENT_SECRET — corresponding server-only Gmail OAuth secret.

Only the first two are required to construct the Supabase Auth client. The last three service/Gmail settings are required for the existing full app; setting Google credentials in Vercel alone does not enable the Google provider in Supabase. Optional Resend fallback uses RESEND_API_KEY and EMAIL_FROM. NODE_ENV and VERCEL_PROJECT_PRODUCTION_URL are platform-managed. SUPABASE_URL and JWT_SECRET do not replace the required public Auth settings. Do not put credentials in Git or chat.

After deployment, open /api/health and /login. Expect the two missing names to disappear, supabaseReachable true, and the Google flag true when enabled. Health does not prove SMTP delivery, user consent, or a completed end-to-end login.

### Supabase

1. Enable Email provider; Confirm email OFF for the requested immediate signup/login behavior. Review existing unconfirmed accounts separately.
2. Enable Google provider and configure its Google Web client ID/secret in Supabase Authentication > Providers.
3. Set Site URL to the production app origin. Allow the app's /auth/callback URL and /auth/callback?next=/reset-password URL in the redirect allowlist.
4. Verify the project is active and its URL/public key belong to the same project.
5. For arbitrary-user password resets, configure custom SMTP and a verified sender; this is separate from certificate Resend fallback.

### Google Cloud

1. Use a Web application OAuth client for Supabase login. Register the exact Supabase callback shown in its Google provider configuration, normally https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback.
2. Register the production app origin where authorized JavaScript origins are needed.
3. Check consent audience/publishing/test-user restrictions. Google login requests only identity scopes; do not add Gmail scopes to Supabase login.
4. Preserve the separate Gmail client's app callback at /api/auth/gmail/callback and its Gmail/Sheets API and consent configuration. That callback is different from Supabase's Google login callback.

## Files and diff

Changed implementation: components/AuthForm.tsx; lib/authUi.ts; lib/http.ts; lib/supabase/client.ts; new lib/supabase/diagnostics.ts; app/api/auth/config/route.ts; app/api/health/route.ts; app/auth/callback/route.ts; middleware.ts; .env.example. Added diagnostic regression script scripts/check-login-diagnostics.cjs. Updated related reports/setup notes.

The complete git diff --stat output is in login-diff-stat.txt. Standard git diff excludes untracked files, including the new diagnostics module, regression script and this report. Generated tsconfig.tsbuildinfo was restored after checking types.
