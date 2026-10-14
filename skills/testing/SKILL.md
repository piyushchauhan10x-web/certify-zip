---
name: certify-testing
description: Safely validate the existing Certify application and report regressions using its current checks, mocks and authorized test environments, without changing design or production data.
---

# Certify testing

Use for regression testing of this repository. Preserve the existing application; this workflow does not authorize feature implementation, public-launch changes, deployment or dependency installation. Read `design.md` at the repository root for an inventory, then verify it against current source.

## A. Pre-test inspection

1. Record `git status --short`, branch and revision. Identify pre-existing changes and preserve them, including tracked `tsconfig.tsbuildinfo` bytes before build/type checks.
2. Inspect `package.json`, `next.config.js`, the target routes/components and `scripts/check-*.cjs`. The current app is Next.js App Router; checks use Node assertions with TypeScript transpilation and mocked services rather than a dedicated test runner.
3. Determine which environments are actually available. A localhost app may still point to production Supabase: local hosting is not proof of database isolation. Inspect configuration presence/names without printing values or credentials.
4. Identify production-only resources and explicitly exclude writes to them. Do not read environment files into tool output, log tokens, or include secrets in screenshots/reports.

## B. Authentication

Use existing mocked checks first. With an authorized isolated test setup, exercise login, invalid credentials, logout, protected-route redirects, session reload/refresh and remember-me behavior. Exercise password recovery only with a dedicated test mailbox and non-production auth project; distinguish requested email, delivered email and successful reset.

Preserve existing demo/test account access if such accounts are supplied. Do not invent an allowlist or assume the source has a demo mode. Do not enable public signup, alter live Supabase settings or change authentication behavior. Existing logged-in real-user sessions are not disposable test sessions; avoid signing them out. Without isolated credentials, mark end-to-end cases skipped and report mocked coverage separately.

## C. UI checks

Inspect the current entry route (anonymous users are redirected to login; no separate marketing landing is implemented), navigation, forms, buttons, workspace, loading/error states and responsive layouts. Compare against current component styles, not an invented replacement design. Use desktop and narrow mobile widths in one bounded review. Test existing public forms without submitting real account requests; do not change styling or automatically accept visual snapshots.

Avoid dumping browser URLs containing auth codes or tokens. Keep screenshots free of credentials/private account data. Report rendering failures without silently repairing the application.

## D. Functional checks

Discover features from source before testing. Current candidates: local spreadsheet parsing, row correction, template editing, category selection, PDF generation, previews, Sheets import, Gmail connection and sending status/retries.

Use synthetic recipient data and local fixture artwork. Real Gmail sends, Sheets access, uploads and deletes require an isolated test account/project and the appropriate explicit authorization; otherwise use existing mocks and mark live delivery untested. Never send certificates to real recipients as a smoke test. Check owner-path rejection before storage access and ensure account A cannot operate on account B's records in mocks. Mock isolation is not proof of live RLS.

## E. Database safety

Prefer mocks, local databases or dedicated non-production environments. Do not insert/delete production test records, modify RLS, execute migrations or change buckets. `gmail_tokens` contains sensitive credentials; never dump its contents. Do not run historical `public.users` migrations as a test setup shortcut. Tests against RLS need two dedicated identities in an explicitly isolated database; if unavailable, report that limitation.

## F. Existing automated checks

Read the scripts before running them to confirm they still mock external requests. Run each separately and record its exit status:

```text
node scripts/check-app-url.cjs
node scripts/check-supabase-auth.cjs
node scripts/check-gmail.cjs
node scripts/check-login-diagnostics.cjs
node scripts/check-production-flows.cjs
npm run build
npx --no-install tsc --noEmit
```

Use already-installed dependencies. Do not install packages, add executable tests, modify dependencies, auto-fix code or update snapshots without approval. The build uses Google fonts and may fail when network access is unavailable; report that accurately rather than changing typography. Build and type-check sequentially because Next generates types. Preserve pre-existing generated-file modifications with an exact backup and restore only test-generated changes afterward. Never use `git reset --hard` or broad cleanup.

There is currently no `npm test` script. Do not equate a successful build with a successful browser, email or database test. A blocked command is not a failing application assertion. Expected mocked error logs do not by themselves mean a suite failed; use assertions and exit status.

## G. Report

List commands/scenarios executed, passed, failed and skipped separately. Identify pre-existing bugs without fixing them outside scope. State environment/network limitations, whether production was touched, and whether real auth/mail/RLS was exercised. Show final Git status and account for every new modification. Never claim tests passed when they were not executed successfully. Do not push or deploy as part of testing.
