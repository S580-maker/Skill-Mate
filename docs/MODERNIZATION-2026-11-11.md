# Skillmate modernization — 11 November 2026

This is an incremental modernization of the existing marketplace. Express, Supabase authentication, existing database records and server-authoritative booking permissions are retained. No production deployment, production database migration, RLS change, authentication-provider change or real email/message send was performed.

## Baseline and checkpoint

Before implementation, the working tree contained the earlier journey improvements. They were preserved in local Git checkpoint `aaf405ba2659d145ab0fd6b08e2216eaed743202`, branch `checkpoint/skillmate-before-modernization-20261111`, without changing HEAD or the user's index. The baseline had 208 passing unit tests plus passing journey, protected-admin/CSP, loading-regression and isolated database suites.

The audit covered the public/auth entry points, student route/render/state orchestration, service discovery, bookings, messaging/outbox, provider/profile forms, admin bootstrap, Express and Vercel handlers, shared authentication/session/rate-limit helpers, Supabase schema/migration contracts, loading/illustration components and existing test infrastructure. This is an application review with fixtures, not an external penetration test or a production-data audit.

## Prioritized findings

| Priority | Confirmed problem and evidence | Resolution |
| --- | --- | --- |
| P1 | Authentication coerced arbitrary JSON values before its error boundary. `{toString:null}` could reject an Express 4 async handler; object passwords became strings. Reproduced in auth-input and HTTP tests. | Accept strings only, validate lengths, return client errors without upstream calls. |
| P1 | Express logged complete parser errors, including malformed JSON containing a password. HTTP test used a dummy credential marker. | Log classification/reference only; malformed and oversized JSON return 400/413. |
| P1 | Broad source-root static serving exposed tests/docs; encoded traversal such as `/assets/..%2fserver.js` returned backend source in the regression reproduction. An undivided build would also expose backend files through a static host. | Normalize decoded path separators before the public allowlist; build a separate `dist/public` tree. Keep runtime/API/private admin HTML outside it. |
| P2 | Vercel route lookup accepted inherited object properties. | Dispatch only own properties; prototype-name regressions return 404. |
| P2 | Express's duplicate session handler did not renew verified OTP sessions like Vercel. | Reuse the shared handler and Supabase helpers; verify renewal failure clears the cookie. |
| P2 | Browser auth and SDK requests could remain pending indefinitely. | Shared deadlines, caller cancellation, actionable auth timeout feedback, retained inputs. No automatic write retries. Uploads receive a longer deadline. |
| P2 | First messages bypassed the existing UUID/outbox path; ambiguous failure could create a second message. | Initial messages and quote messages now use the same persisted retry queue as the composer. Duplicate reconciliation checks sender, conversation and body. |
| P2 | An older booking failure could reopen/label another provider's form; an older success could delete a newer draft. | Scope responses to the submitted modal generation and draft snapshot. Browser tests cover both races. |
| P2 | Floating-point equality rejected valid prices such as 19.99. | Validate decimal input syntax before sending the numeric amount. |
| P2 | User-authored spreadsheet formulas remained executable in earnings and admin booking CSVs. | Share one encoder across both entry points: prefix formula-like cells as text, then escape CSV quotes. |
| P2 | Upcoming-activity shortcut wrote an undeclared variable instead of the active filter. | Update the actual filter; verify rendered appointments, not just a variable. |
| P2 | Failed Storyset reads had no deadline and could never recover in the existing element. | Bounded fetch, online/reconnect recovery and stale-result guards. |
| P3 | Home skeleton ran 100–117 simultaneous primitive animations. | Preserve all 118 shapes, animate 6–8 regions; reduced motion runs none. |
| P3 | Route changes lacked destination focus and most pages lacked a skip link. | Explicit user navigation focuses its heading; add skip-to-main links and consistent visible focus. Startup/background/history reads do not steal focus. |
| P3 | Settings put promotional/appearance sections before profile editing; placeholder cards and controls were inconsistent across themes. | Prioritize profile details, use shared surface/control/focus/spacing tokens, simplify gradients, align booking actions and improve dark-mode contrast. |
| P3 | No reproducible production artifact; student HTML requested eleven stylesheets. | Add a checked production build with one ordered stylesheet per document, minified classic scripts, asset hashes, private-file isolation and artifact startup tests. |

Suspected issues requiring real staging evidence: behavior on very slow uploads, OAuth/email delivery, reconnect behavior between two physical clients, Supabase quotas under representative traffic, and hosted Vercel packaging. These were not represented as confirmed failures. Optional future work is listed below.

## Architecture decision

The existing frontend uses classic browser scripts, shared state and hash-based sections. `user.js` still coordinates a large portion of the application; previously extracted booking presentation, provider profile, booking policy, API and journey-state modules remain in place. Express and Vercel now share the session/auth helpers rather than maintaining separate implementations.

| Technology | Decision and tradeoff |
| --- | --- |
| Node.js / Express | Retain the existing API and deployment model. Remove demonstrated duplication at the session boundary. |
| Supabase | Retain authentication, Postgres, storage and realtime. Database rules remain authoritative. No data migration needed for this pass. |
| TypeScript | Add pinned development tooling and strict `checkJs` for `booking-policy.js` and `api-client.js`, with explicit booking/request contracts. This is scoped adoption, not full-app type coverage. [TypeScript checkJs](https://www.typescriptlang.org/tsconfig/checkJs.html). |
| esbuild | Add a pinned development dependency for syntax diagnostics, CSS aggregation/minification and script minification. Preserve classic global identifiers and SDK bytes/SRI. This delivers a measurable asset-size/request reduction without a frontend rewrite. [esbuild transform API](https://esbuild.github.io/api/#transform). |
| React | Defer a rewrite. React supports incremental adoption, but the current defects do not require a runtime change. A future isolated listing editor could be evaluated with parity tests before any broader migration. [Incremental React](https://react.dev/learn/add-react-to-an-existing-project). |
| Vite | Defer until module-based frontend sections justify its development server/manifest integration. The present classic-script build needs less machinery. [Backend integration](https://vite.dev/guide/backend-integration.html). |
| Next.js | Defer. Moving an authenticated client-heavy marketplace into server/client component boundaries and new routing is a major migration; no current SSR requirement or measured benefit justifies it. [Server and client components](https://nextjs.org/docs/app/getting-started/server-and-client-components). |
| Tailwind CSS | Defer a class-system replacement. Extend existing CSS variables for consistent controls, spacing, surfaces and focus. Tailwind's token model is useful, but rewriting established markup has no demonstrated benefit here. [Theme variables](https://tailwindcss.com/docs/theme). |
| TanStack Query | Defer until a deliberate data-layer migration. Adding it alongside the existing realtime/outbox/loading ownership would create two competing caches. [Server-state overview](https://tanstack.com/query/latest/docs/framework/react/overview). |

These stack choices are engineering judgments based on this repository and the measured build, not comparative framework benchmarks. A major framework migration still requires a concrete parity plan, checkpoint and user approval.

## Iterations and acceptance

| Batch | Focused correction iterations | Review discoveries and exit criteria |
| --- | --- | --- |
| Authentication/security boundaries | 2 | First fix strict inputs, own-property routing and shared sessions; then protect parser logs and bound browser transports. Root integration review added static-file isolation as part of the build batch. HTTP, VM, browser and authorization regressions pass. |
| Booking, messaging and navigation | 2 | First fix the five reproduced journey failures. Review found synchronous realtime-subscribe initialization, activity-filter state, destination focus and duplicate object key. Quote text, retry identity, new-draft preservation and rendered filtering are verified. |
| Shared export safety | 1 | Final audit extended the formula guard to admin booking exports and extracted one common CSV encoder. Unicode/quotes/newlines, formula prefixes and both actual export paths are verified. |
| Loading and artwork | 2 | Region pulses and recovery first; review caught a reduced-motion/late-animation race. Corrected stale fixture assumptions without weakening geometry or interaction assertions. See the [loading report](MODERNIZATION-LOADING-2026-11-11.md). |
| Shared interface | 3 | Establish tokens/focus/settings order; screenshot review caught placeholder contrast and onboarding borders; final correction fixed the higher-specificity auth input rule. Final captures are inspected in both themes at three widths. |
| Build, types and performance | 3 | First add scoped type checks and compilation. Compiler caught a duplicate object key. Then separate public/runtime files and connect the compiled protected template to Vercel. Adversarial path review reproduced an encoded-separator bypass; normalize before checking the allowlist and verify forward/backslash cases. Artifact tests check hashes, SDK integrity, private paths, actual handlers and browser journeys. |

No issue was repeated indefinitely. The maximum was three focused corrections for the interface and build batches. Pre-existing test defects discovered during integration: old empty-state text, session-storage leakage between geometry samples, a quote-message source assertion tied to its old direct insert, and a mobile test checking the unused booking-filter variable. Behavioral assertions were retained or strengthened; failures were not suppressed.

## Browser and visual evidence

Open the [before-and-after gallery](modernization/index.html). It includes 19 screens at 375, 768 and 1280 pixels, with light/dark preferences: landing, sign-in, signup, onboarding, discover, activity/dashboard, bookings, messages, saved, listings, earnings, settings, provider profile, service booking form, admin, password recovery, reset-link expiry, privacy and terms. These are real Chromium renders with fictional fixture accounts, not source-only visual claims.

All final captures fit the viewport and the visible-control name audit found no unnamed controls. Contact sheets were inspected for hierarchy, spacing, clipping and theme contrast, with native-resolution checks of corrected areas. Existing mobile suites cover additional widths down to 320 px and real touch targets; landing tests also cover keyboard menus/FAQs, reduced motion and no-JavaScript fallback. Landing intentionally remains its light marketing design even when a dark preference is stored. Full screen-reader output and Safari/iOS hardware were not tested.

Loading success, empty, failure, stale response, timeout, offline/reconnect and reduced-motion scenarios use controlled fixtures. Before/after loading images and exact animation counts are in the linked loading report. Storyset assets and credits are preserved.

## Measured performance

See [raw benchmark samples](modernization/performance.json) and the generated `dist/build-report.json`. The benchmark compares the current unbundled source with its compiled artifact under the same local Chromium fixture, viewport and throttling. It isolates the packaging change; it is not a claim about production traffic or the original remote website.

| Measurement | Unbundled source | Built artifact |
| --- | ---: | ---: |
| Student stylesheet requests | 11 | 1 |
| Decoded stylesheet bytes | 234,878 | 201,456 |
| Decoded script bytes (fixture transport) | 460,827 | 380,530 |
| Median workspace-ready time (ms) | 4307 | 3896 |
| Median observed LCP (ms) | 2212 | 1596 |
| Median observed CLS | 0 | 0 |

Three alternating cold runs per mode, 375 ? 900 viewport, 4? CPU throttle, 60 ms latency, 300,000 bytes/s download. Final benchmark ran without concurrent automated test suites. Results are local samples; run-to-run timing varied, so no fixed speedup guarantee is implied.

The font and locally pinned Supabase SDK remain unchanged; the fixture replaces SDK/client behavior during the comparative page measurement. No Lighthouse score, field Core Web Vitals rating or INP claim is made. The animation reduction is a count of active animations, not a measured CPU/battery percentage.

## Validation and remaining failures

- Baseline: 208 unit tests passed.
- Final: 223 unit tests passed on Node 24.22.2; the installed Node 26 runtime also passed the combined release suite.
- `npm run test:release`: type checking, production build, unit tests, original/new journeys, auth timeouts, loaders, protected admin/CSP, isolated Postgres lifecycle tests and artifact tests.
- Additional browser gates: mobile interactions, public landing, full loading states and the 114-capture visual matrix.
- `git diff --check` passes. Build rejects compiler warnings rather than silently shipping them.
- The real Vercel admin function was exercised locally against its compiled private template for admin/student sessions. Hosted Vercel deployment and GitHub Actions execution are not claimed.

No known blocking regression remains in the implemented, tested scope. Production registration, real OAuth callbacks, live email delivery, two-device realtime, third-party uploads and load behavior still require a staging/production environment with explicit authorization. Tests used safe fixtures and isolated PGlite databases.

## Outstanding work and migration approval

The large `user.js` orchestrator and historical CSS overrides remain technical debt. The next useful batch is extracting and typing the conversation/outbox and booking repositories behind their existing behavior tests. Whole-app TypeScript, React/Next migration, RLS redesign, new infrastructure and speculative feature additions were not undertaken.

The existing Privacy Policy and Terms pages explicitly contain placeholders and are marked draft. Their layout was checked, but the business-approved policy text and contact details remain a launch requirement; this engineering pass did not invent those commitments.

This pass adds **no database migration**. The pre-existing local `supabase/migrations/20261111100000_marketplace_journey.sql` from the earlier journey batch still requires explicit approval before being applied to a real database. Admin journey statistics gracefully report an unavailable migration. Existing migration status in production was not inspected or changed.

## Deployment and rollback

Deployment requires separate approval; nothing has been deployed.

1. Use Node 24, run `npm ci`, then the release and additional browser gates listed above. Review the gallery and keep the generated artifact/checkpoint.
2. For Express, copy the complete `dist` artifact to a release directory, install runtime dependencies with `npm ci --omit=dev`, supply environment configuration securely, set `NODE_ENV=production`, and start `node server.js` **from that release directory**. It serves only `public`; the protected admin template stays in `api/_lib`.
3. For Vercel, deploy the repository root after approval. `vercel.json` runs the build, publishes only `dist/public`, and includes `dist/api/_lib/admin.html` in the admin function. Do not deploy `dist` as a standalone Vercel project. Verify an approved preview before promotion. [Vercel build/output configuration](https://vercel.com/docs/builds/configure-a-build).
4. Verify actual sign-in/OTP, one booking lifecycle, messaging, uploads and admin authorization in the approved staging environment. Apply the optional analytics migration only with separate approval and an appropriate database backup.
5. Roll back a deployed release by restoring the previous artifact or deployment. This pass has no schema rollback. To inspect the original local state without overwriting current edits, create a separate worktree from `checkpoint/skillmate-before-modernization-20261111`; do not use a destructive reset in the working tree.

The Git checkpoint preserves pre-existing work. The final local checkpoint is `checkpoint/skillmate-modernization-20261111`; it preserves this implementation and review evidence without changing HEAD or the user's index. Neither checkpoint pushes or merges anything.

## File inventory

- `.github/workflows/verify.yml`
- `.gitignore`
- `admin.html`
- `api-client.js`
- `api/_lib/admin.html`
- `api/_lib/email-2fa.js`
- `api/_lib/routes/session.js`
- `api/_lib/supabase.js`
- `api/admin.js`
- `api/index.js`
- `auth-utils.js`
- `auth.css`
- `auth.js`
- `booking-policy.js`
- `brand-colors.css`
- `csv-utils.js`
- `docs/MODERNIZATION-2026-11-11.md`
- `docs/MODERNIZATION-LOADING-2026-11-11.md`
- `docs/modernization/after-visual-metrics.json`
- `docs/modernization/before-visual-metrics.json`
- `docs/modernization/changed-files.json`
- `docs/modernization/index.html`
- `docs/modernization/performance.json`
- `forgot-password.html`
- `forgot-password.js`
- `illustrations.js`
- `index.html`
- `journey-state.js`
- `landing.html`
- `login.html`
- `onboarding.html`
- `package-lock.json`
- `package.json`
- `privacy.html`
- `reset.html`
- `scripts/build.cjs`
- `scripts/visual-gallery.cjs`
- `script.js`
- `server.js`
- `skeleton.css`
- `supabase-client.js`
- `terms.html`
- `tests/auth-access.test.js`
- `tests/auth-input-validation.test.js`
- `tests/auth-network-boundaries.test.js`
- `tests/auth-network-browser-check.cjs`
- `tests/booking-policy.test.js`
- `tests/browser-mobile-smoke.cjs`
- `tests/build-performance-check.cjs`
- `tests/csv-utils.test.js`
- `tests/illustrations-browser-checks.cjs`
- `tests/loading-geometry.cjs`
- `tests/loading-modernization-browser.cjs`
- `tests/modernization-journey-check.cjs`
- `tests/modernization-visual-check.cjs`
- `tests/navigation-focus-check.cjs`
- `tests/price-range.test.js`
- `tests/production-build-check.cjs`
- `tests/review-fixes.test.js`
- `tests/server-auth-boundaries.test.js`
- `tests/support/loading-harness.cjs`
- `tests/vercel-api-routing.test.js`
- `tsconfig.json`
- `types/browser-contracts.d.ts`
- `typography.css`
- `user.js`
- `vercel.json`

Browser captures and review sheets are grouped under `docs/modernization/screenshots`; generated production output is ignored under `dist/`.
