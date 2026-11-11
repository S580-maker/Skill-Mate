# Loading and illustration review — 11 November 2026

This batch used the real local HTML, CSS and browser scripts in headless Chrome with the isolated Supabase fixture in `tests/support/loading-harness.cjs`. It made no production requests, database changes, dependency changes or deployments.

## Findings and decisions

| Priority | Classification | Evidence | Resolution |
| --- | --- | --- | --- |
| P2 | Confirmed recovery defect | `SkillflexIllustration.load()` permanently returned when `this.failed` was set. A failed SVG followed by an `online` event stayed unavailable in the existing DOM; the baseline browser result records `false`. | Failed artwork can retry after reconnecting or reattaching. An invisible element waits until visible, so recovery keeps lazy loading. Text and actions remain usable during failure. |
| P2 | Confirmed unbounded optional read | `readAsset()` had no abort/deadline. A stalled local asset left the element's loading flag set indefinitely. | Abort the asset fetch after eight seconds, release the loading state and show its existing fallback. Failed requests are evicted from the shared cache so later recovery is possible. |
| P3 | Confirmed unnecessary rendering | Once settled, every visible `syncMotion()` call cloned and replaced the static SVG again. | Painting is idempotent for the same artwork/motion state. Settled visibility changes retain the SVG node. |
| P3 | Measured optimization opportunity | The startup Home skeleton ran 100 simultaneous infinite animations at mobile/tablet widths and 117 at desktop width, one for nearly every primitive. | Replace the individual shimmer layers with a subtle opacity pulse per region. Placeholder structure and dimensions remain unchanged. |
| P3 | Test maintenance defect from earlier changes | The optional illustration suite still expected “Explore services”; the implemented empty state says “Clear search & filters.” | Update the expected label while keeping the click/restore behavior assertion. |
| P3 | Test isolation defect from earlier changes | `loading-geometry.cjs` reused session storage between widths. Later pages showed a restored-search notice, making the default skeleton comparison fail. | Clear session storage before each document in this specific default-layout fixture. Preserve all geometry assertions and log geometry before assertions. Search restoration has separate journey coverage. |

The existing shared loader was retained. It already has delayed mounting, request ownership, bounded reads, accessible busy/error states and preservation of cached content. Existing browser regressions verified retry recovery, empty states, route changes during startup, optional CV failures, notifications and stale admin requests. No additional framework was justified for this scope.

Possible deployment/network failures beyond these fixtures remain unverified; they are not asserted to be defects. The optional animated Storyset export support remains dormant unless an asset is explicitly configured. Existing genuine local artwork and credits are preserved.

## Implementation and review loops

Two focused implementation/review iterations were used.

1. Record browser screenshots and animation counts, reproduce failed-artwork recovery, implement bounded reads/retry/idempotent painting and region pulses, then run new and existing checks.
2. Diff review found a motion race introduced by simplifying the settled branch: an optional animated export might finish after reduced motion was selected. Explicitly choose static artwork when motion has settled or reduced motion is active, and add a browser test for that timing. Repair the two pre-existing test maintenance issues above, rerun the relevant checks and inspect the final diff/screenshots.

The old request generation is checked in failure handling as well as success handling. No known blocking finding remains in this batch.

## Measured result

Same real Home skeleton, viewport height 900 px, local fixture delay 4,000 ms, measured 500 ms after skeleton creation. Both light and dark themes produced the same counts.

| Viewport width | Shape count before / after | Running infinite animations before / after |
| --- | --- | --- |
| 375 px | 118 / 118 | 100 / 6 |
| 768 px | 118 / 118 | 100 / 6 |
| 1280 px | 118 / 118 | 117 / 8 |

Reduced motion produced zero infinite skeleton animations. The count is a measured rendering-work reduction, **not** a CPU, battery, Lighthouse or Core Web Vitals score. No user-traffic performance claim is made.

The geometry check passed at 320, 375, 768, 1280 and 1920 px. Header and hero positions/heights matched their loaded counterparts; card column widths matched. Representative first-card vertical displacement remained within the existing 20 px budget and representative card height within the existing 32 px budget. Content-dependent card heights are not claimed to be identical.

## Browser evidence

Before and after Home skeleton screenshots were captured and visually inspected at all three widths in both themes. The visual review found no clipping or changed card/hero geometry; region pulses keep the loading state visible with less simultaneous motion. Reduced-motion captures are also included.

| Theme / width | Before | After |
| --- | --- | --- |
| Light / 375 | [Before](modernization/screenshots/loading-before-light-375.png) | [After](modernization/screenshots/loading-after-light-375.png) |
| Light / 768 | [Before](modernization/screenshots/loading-before-light-768.png) | [After](modernization/screenshots/loading-after-light-768.png) |
| Light / 1280 | [Before](modernization/screenshots/loading-before-light-1280.png) | [After](modernization/screenshots/loading-after-light-1280.png) |
| Dark / 375 | [Before](modernization/screenshots/loading-before-dark-375.png) | [After](modernization/screenshots/loading-after-dark-375.png) |
| Dark / 768 | [Before](modernization/screenshots/loading-before-dark-768.png) | [After](modernization/screenshots/loading-after-dark-768.png) |
| Dark / 1280 | [Before](modernization/screenshots/loading-before-dark-1280.png) | [After](modernization/screenshots/loading-after-dark-1280.png) |

[Before measurements](modernization/screenshots/loading-before-metrics.json) · [After measurements](modernization/screenshots/loading-after-metrics.json) · [Reduced motion](modernization/screenshots/loading-after-reduced-motion.png)

## Validation

All completed successfully:

- `node --test tests/loading-ui.test.js` — 3 tests.
- `node tests/loading-modernization-browser.cjs` — responsive/theme captures, animation bounds, reduced motion, online recovery, stalled-fetch fallback/recovery, stable settled SVG identity, and late-export reduced-motion race.
- `node tests/loading-states-browser-checks.cjs` — route skeletons and success/empty/error/loading behavior at five widths; cached content, retry, optional CV and admin preview behavior.
- `node tests/loading-review-regressions.cjs` — Saved outcomes, hung reads, stale responses, keyboard focus, CV cancellation, admin ordering and CSP.
- `node tests/browser-mobile-smoke.cjs --illustrations-only` — Storyset placements/actions at five widths, reduced motion, offscreen pause, animation cap, cached reads, invalid/missing export fallback and booking outcomes.
- `node tests/loading-geometry.cjs` — all original geometry budgets at five widths.
- `node --check illustrations.js` and `git diff --check`.

The browser harnesses reported no uncaught JavaScript exceptions. Some negative scenarios intentionally produce failed fixture requests; these are not live network errors. Production authentication, real mobile hardware, network bandwidth, screen-reader output and real traffic Core Web Vitals were not tested by this batch.

## Files and rollout

Product files: `skeleton.css`, `illustrations.js`.

Verification files: `tests/loading-modernization-browser.cjs`, `tests/loading-geometry.cjs`, `tests/illustrations-browser-checks.cjs`, this report and the `loading-*` screenshot/measurement artifacts.

No database migration is required for this batch. Deploy these static files through the normal approved application release. Roll back the two product files to the pre-modernization checkpoint if needed; no user data needs restoration. The parent report owns full application release and rollback instructions.
