# Review corrections — 10 November 2026

This report supersedes the affected loading behavior described in the earlier skeleton verification report.

## Corrections

1. **Direct Saved navigation:** `renderAll()` now updates saved services alongside the other data views. Initial success, empty results and failed reads all replace their loader without requiring another navigation. Removed redundant retry-specific saved-grid rendering.
2. **Dashboard retry deadline:** the initial account reads, price-negotiation reads and availability refresh share a 20-second read budget. A rejected read exits before its response can be applied. The shared refresh promise is released on failure so retry remains possible. Regression coverage resolves an obsolete request after a successful retry and verifies that recovered data is retained. Network transports may still complete in the background; these reads do not retry database writes.
3. **Admin request ordering:** support-queue requests have monotonically increasing identifiers. Only the newest request may render results or an error. Obsolete requests still clean up their own loader safely.
4. **Optional CV performance:** the service profile, reviews, portfolio and booking/message actions render immediately. Only the CV region is busy while its signed link loads. A failure offers a local retry; successful retry restores focus to the link. Closed or replaced profiles ignore late CV responses.
5. **Request-board keyboard focus:** successful retry focuses the refreshed region; failed retry focuses its new retry button. It leaves focus alone when the user moves elsewhere or navigates away.

## Content Security Policy

Enabled an enforcing CSP in Express and Vercel instead of leaving it disabled. The policy allows local scripts, blocks inline executable scripts/event handlers and plugin objects, restricts base URLs/forms, and preserves local fonts, HTTPS images, Supabase HTTPS/WebSocket connections and existing SVG/shadow-root styles. Inline styles remain allowed because the current UI and illustrations use them. This is a baseline policy, not a claim of complete XSS prevention or a full security audit.

Express retains local preview embedding outside production and permits an explicitly configured HTTP Supabase origin. The hosted policy permits HTTPS/WSS connections. No Supabase URL, keys, authentication settings, schemas or RLS policies were changed.

Policy configuration follows the [official Helmet CSP documentation](https://helmet.js.org/). The JSON policy and Vercel header are checked for consistency. A real-browser check confirms that inline script injection is blocked while the local SDK, page scripts and Storyset artwork still load.

Restart an already-running Express process to pick up the new response headers. Hosted headers take effect on the next deployment; no deployment was performed.

## Verification

- `npm.cmd test`: **196 passed, 0 failed** (194 before these corrections; two policy tests added).
- `node tests/loading-review-regressions.cjs`: passed all five confirmed reproductions and the CSP execution check. Saved success/empty/error cases cover 320, 375, 768, 1280 and 1920px.
- `node tests/loading-states-browser-checks.cjs`: passed the existing responsive/loading/theme/reduced-motion scenarios with the updated nonblocking CV behavior, under the CSP.
- `node tests/browser-mobile-smoke.cjs`: passed navigation, touch controls, profile/service details, bookings, chat, marketplace growth/request flows and Google OTP fixtures.
- `node tests/browser-landing-smoke.cjs --access-audit`: passed actual public page rendering and CSP checks at all five requested widths. Inline scripts were blocked, Storyset loaded and the local Supabase SDK passed its integrity check.
- JavaScript syntax checks and `git diff --check`: passed.

The first run of the new browser regression script exposed a test-harness syntax issue with top-level `await`; the test programs now use explicit async functions. This was a test issue, not an application regression. Final checks pass.

Public-route screenshots: `C:\Users\beans\AppData\Local\Temp\skillmate-landing-si7yJD`. Mobile interaction screenshots: `C:\Users\beans\AppData\Local\Temp\skillmate-mobile-KWjXCQ`.

Protected-page tests use actual application HTML/CSS/JavaScript with isolated fake Supabase reads. Live authenticated database traffic, production OAuth/email delivery and hosted CSP behavior remain unverified. Actual protected routes continued redirecting unauthenticated visitors to login.

## Files changed

| File | Reason |
| --- | --- |
| `user.js` | Saved-grid refresh, bounded account reads and independent CV loading/retry/focus handling |
| `user.css` | Reserve and style the local CV status region |
| `marketplace-growth.js` | Apply the shared read budget and restore request-board retry focus |
| `admin-auth.js` | Ignore obsolete support-queue results/errors |
| `index.html` | Refresh student script/style and marketplace script versions |
| `admin.html` | Refresh admin script version |
| `api/_lib/admin.html` | Keep the hosted admin document's script version synchronized |
| `server.js` | Enable the shared CSP through Helmet |
| `content-security-policy.json` | Define the baseline policy |
| `api/_lib/content-security-policy.js` | Build Express policy and serialize it for tests |
| `vercel.json` | Enforce CSP on hosted responses |
| `package.json` | Add `test:loading:regressions` command |
| `tests/content-security-policy.test.js` | Verify executable-content restrictions, hosting parity and local compatibility |
| `tests/loading-review-regressions.cjs` | Reproduce and protect all five fixes |
| `tests/loading-states-browser-checks.cjs` | Assert immediate profile rendering and isolated CV loading; execute async browser programs correctly |
| `tests/public-access-checks.cjs` | Verify actual CSP headers, blocked inline execution and working Storyset assets |
| `tests/support/loading-harness.cjs` | Run protected-page fixtures under the shared CSP |
| `docs/REVIEW-FIXES-2026-11-10.md` | Record the corrections, evidence and limits |

No database changes, commits or pushes were made.
