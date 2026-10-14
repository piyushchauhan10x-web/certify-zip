# Certify: existing application design

This document describes the application at revision `b743db6`, restored on 14 October 2026. It is an inventory, not a redesign or a public-launch plan. Repository behavior is distinguished from external settings, which may change independently.

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

## 3. Existing UI design system

There are two existing style families. Preserve both where used; do not infer that one should replace the other.

| Surface/token | Existing value or behavior | Source |
| --- | --- | --- |
| Workspace and login background | `#F8FAFC`, white cards, gray text/borders | `app/page.tsx`, `components/AuthForm.tsx` |
| Workspace/login primary | Coral `#F9654B`, hover `#E04F34` | Same components |
| Global dark background | `#0A0908` | `app/globals.css`, `tailwind.config.js` |
| Dark surface / hover | `#14120E` / `#1C1914` | `tailwind.config.js` |
| Dark-theme accent | `#FC6C26` | `tailwind.config.js` |
| Vanilla / muted text | `#FFF4D6`, `#D6CBB2`, `#8C8270` | `tailwind.config.js` |
| Dark-theme borders | Translucent vanilla; orange hover | `tailwind.config.js` |

`app/layout.tsx` loads Sora (600/700) and Inter (400/500) using Next's Google font integration. Tailwind maps `font-display` to Sora and `font-body` to Inter. Some light surfaces explicitly use `font-sans`, so the configured display face is not universal. `text-text` appears in the layout but has no custom `text` color defined in the Tailwind extension.

Spacing uses Tailwind utilities rather than a separately defined scale. Examples include page padding `p-4 sm:p-6`, auth-card padding `p-5 sm:p-9`, form `space-y-4`, and preview gaps `gap-3 sm:gap-4`. Auth cards have a 440px maximum width, rounded corners and borders. The workspace header uses a centered `max-w-6xl` container and is sticky.

Primary buttons use filled accent colors, hover colors and reduced opacity while disabled. Google login is an outlined button. Inputs use borders, rounded corners and accent focus states. Login includes password visibility, remember-me, inline errors and configuration retry. The original profile avatar uses fixed `PC` initials; the menu displays the authenticated email and Gmail connection state.

Navigation is the five-step workspace sequence: Add data, Design, Generate, Review, Send. The profile menu exposes Gmail connection and sign-out. Login links to signup mode, password recovery, Privacy and Terms. There is no separate public marketing landing page: anonymous workspace requests are sent to login.

Responsive behavior includes `sm`/`md`/`lg` breakpoints, wrapping controls, full-width/min-width-zero containers, and a preview grid with one, two, three and four columns. Global CSS limits images/canvases to container width and, below 768px, makes most form text 16px and buttons at least 44px tall. The viewport uses `viewport-fit: cover`. A repeating certificate SVG decorates the light workspace and login; global CSS also contains dark-theme backdrop/shimmer/scan animation utilities.

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

Preserve component styling, both existing color families, navigation, field behavior and the certificate workflow. Avoid dependencies added only for visual changes. Do not modify authentication, live Supabase settings, RLS, storage permissions or Vercel configuration without explicit approval. Do not interpret this inventory as authorization to fix known limitations. Use mocks or a dedicated test environment for delivery and data changes; never use production records as disposable fixtures.
