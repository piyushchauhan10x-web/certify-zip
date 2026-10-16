# Certify: existing application design

Updated 15 October 2026 for the user-authorized visual redesign. Application behavior and authentication remain preserved. Repository behavior is distinguished from external settings.

## 1. Project overview

Certify imports recipient data, places personalized text on certificate artwork, generates PDFs in the browser, previews them, and sends certificates through a connected Gmail account. Spreadsheet import can use a local file or Google Sheets.

The source implements authenticated ordinary users and per-user ownership checks. It does not define an administrator UI, subscription roles, or a hardcoded demo-user allowlist. Any separate organizational account restrictions are external configuration, not an application role model.

Email/password signup and login, Google login, password recovery and logout use Supabase Auth. Login and Gmail connection are separate flows: Google login requests default identity permissions; Gmail connection requests sending and Sheets read permissions. New signup behavior depends on the project's email-confirmation setting. The original form treats a missing signup session as an error; that behavior has been preserved rather than repaired during restoration.

## 2. Technology stack

- Next.js 14.2.5 App Router, React 18 and TypeScript.
- Tailwind CSS 3, global CSS and component utility classes; Framer Motion and Lucide dependencies are present.
- Next.js route handlers provide server APIs; middleware protects workspace navigation.
- Supabase SSR/browser clients manage authentication. A server-only privileged client accesses Gmail credentials and private certificate storage.
- `xlsx` parses spreadsheets; Canvas and `jspdf` generate certificates. `pdf-lib`, `googleapis`, `resend`, `zod` and `nanoid` are also declared dependencies. Presence in package.json is not a claim that every package is used on every screen.
- Vercel hosts the existing application at https://certify-zip.vercel.app. No deployment or hosting setting is changed by this document.
- Development output uses `.next-dev`; production build output uses `.next` to avoid manifest conflicts.

## 3. Studio visual system

The redesign uses warm paper (#F5F3ED), white surfaces, evergreen ink (#20392F), a deep green header (#163B2C) and a green action color (#17634D; hover #104D3B). Muted text and borders use a green-tinted gray scale in tailwind.config.js. Existing semantic error/warning/success colors remain.

Sora is the display face; Inter is the body face, using the existing Next font assets. Headlines use 32–48px on the workspace and restrained negative tracking. Form text remains readable on mobile. The layout uses a 1240px import area, a two-column introductory composition and 16px panel corners. The header is 80px on desktop and 68px on mobile. The workflow remains sequential with a highlighted active step.

The import screen pairs a typographic introduction and explicitly illustrative certificate specimen with the working import panel. At narrow widths the specimen is hidden and the form becomes a single column. No sample certificate is injected into user data or exposed as a working template. The login screen pairs a green editorial panel with the existing authentication controls; on mobile its introduction is compact. Recovery and policy pages inherit the light palette.

Buttons, focus rings, file-input keyboard focus, selection colors and reduced-motion behavior are defined in app/globals.css. The certificate specimen is HTML/CSS document typography, not a new image dependency. The only entrance animation is the import panel. Existing Gmail prompts and connected states inherit the palette.

Mode: Operate. The screen must help people import, design, preview and send certificates; it must not imply saved history, billing, new account privileges or automatic email delivery. Preview with fixture accounts before testing against any external service.

## 4. Application architecture

| Area | Responsibility |
| --- | --- |
| `app/page.tsx` | Authenticated workspace, workflow state, generation progress and logout |
| `app/login`, `app/signup`, `app/register` | Shared authentication form routes |
| `app/forgot-password`, `app/reset-password` | Email recovery and password update |
| `app/privacy`, `app/terms` | Public policy pages |
| `app/auth/callback/route.ts` | Exchange Supabase authorization code; only allows the recovery destination or workspace |
| `middleware.ts` | Verified user check and refreshed cookies; public auth/policy routes exempt |
| `components/` | Imports, template editor, row repair, previews, sending and auth UI |
| `lib/supabase/` | Runtime public config, diagnostics, browser and server auth clients |
| `lib/auth.ts`, `lib/db.ts` | Verified identity and server-only database access |
| `lib/oauthFlow.ts`, `lib/gmail.ts` | Signed per-user OAuth state, Gmail tokens and sending |
| `lib/parseExcel.ts`, `lib/generateCert.ts` | Recipient processing and browser-side PDF generation |
| `supabase/` | SQL setup and historical migrations; not an instruction to apply them |
| `scripts/check-*.cjs` | Existing standalone assertion-based regression checks |

### Authentication and APIs

The browser loads public configuration through `/api/auth/config` at runtime. Required names include `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the privileged `SUPABASE_SERVICE_KEY` stays server-side. `APP_URL` and platform/request context determine callback origins. Google credentials use `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Optional Resend fallback uses `RESEND_API_KEY` and `EMAIL_FROM`. No credential values belong in documentation.

| Endpoint | Existing behavior |
| --- | --- |
| `/api/auth/config` | Public runtime browser config and diagnostic failures |
| `/api/health` | Environment-name and Supabase/provider diagnostics |
| `/api/auth/me` | Verified current-user email and Gmail connection status |
| `/api/auth/google` | Retired login endpoint; returns 410 directing users to `/login` |
| `/api/auth/gmail/connect` | Authenticated Gmail connection entry |
| `/api/auth/gmail/callback` | OAuth state/session checks and per-user token persistence |
| `/api/sheets` | Authenticated Google Sheets import |
| `/api/upload-url` | Authenticated signed upload creation and owned-file cleanup |
| `/api/send` | Authenticated owner-path validation, PDF delivery and cleanup |

Middleware excludes API paths; API handlers must perform their own identity checks. Certificate storage paths include the authenticated user ID. Gmail tokens are keyed by `auth.users.id`; source SQL enables RLS and denies browser-role access, leaving server-side access. Historical `public.users` SQL represents an earlier custom-account schema and must not be blindly applied to the current Auth project. The read-only launch audit observed RLS enabled on `gmail_tokens` and `users`; this is not a full live policy test. No profile-management table or screen is implemented in the inspected source.

## 5. Implemented features and limits

- Import spreadsheet recipients and extra fields; identify invalid rows and repair them.
- Import an authorized Google Sheet through the connected account.
- Configure certificate artwork, text fields, placement, font, color, alignment and category templates.
- Generate personalized PDF blobs and thumbnails in browser memory, with progress and category fallback.
- Preview generated certificate thumbnails. PDF blobs are used for delivery; no standalone download control was found in the inspected UI.
- Send certificates sequentially with recipient status/progress and retry handling. Temporary PDFs are uploaded for sending; the product's browser-side generation does not mean sending requires no upload.
- Connect Gmail independently of login. Refresh expired access and report revoked permissions/quota failures. Optional verified Resend fallback applies only under the existing server conditions.
- Sign in, sign up, reset passwords, maintain sessions and sign out using Supabase.

Workspace recipients/templates/generated certificates are React state; the inspected code does not establish a durable certificate library, public certificate-verification portal, organization management, or certificate-sharing links. Application rate limits are process-local; they are not a proven distributed quota across Vercel instances. Live mail delivery, external OAuth verification and SMTP readiness are not established by a successful build.

## 6. Preservation rules

Preserve the studio visual system, navigation, field behavior and certificate workflow. Avoid dependencies added only for visual changes. Do not modify authentication, live Supabase settings, RLS, storage permissions or Vercel configuration without explicit approval. Do not interpret this inventory as authorization to fix known limitations. Use mocks or a dedicated test environment for delivery and data changes; never use production records as disposable fixtures.
