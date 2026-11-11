# Marketplace journey improvements

## Product behavior

- Booking cards identify the next actor, show a clear next step, and expand to show price, appointment and scope. Historical agreed scope is distinguished from current listing details. Providers' completion requests remain awaiting customer verification.
- Provider profiles explain campus verification, show service price and published-hours guidance, link to work samples and recent reviews, and keep booking/message controls visible while scrolling.
- Discover retains query, category and filters in the current browser tab for up to 24 hours. Mobile buttons take keyboard/touch users directly to search and filters. Empty results offer clearing filters or posting a campus request.
- Booking drafts are scoped to the signed-in account, provider, service and agreement. They survive reloads within the tab, restore without rechecking agreement confirmation, and clear after successful submission. Browser storage failures preserve the in-memory draft while the page remains open. Drafts are not shared across devices.
- Interrupted fixed-price booking retries reuse a client-generated UUID. Duplicate responses are accepted only after reading that exact booking scoped to the same customer, provider and service. Agreement bookings use the existing idempotent RPC. Writes are never retried automatically. An ambiguous failure asks the student to review My bookings before retrying.
- The admin Activity page reports unique students reaching Discover, search, profiles, booking forms and sent requests in the last 14 days. These are independent stage counts, not a cohort conversion percentage. No search terms, scope or message contents are recorded. Do Not Track and Global Privacy Control suppress recording. Daily records are deduplicated and older than 90 days are removed on subsequent recording activity.

## Code structure

`booking-ui.js` owns booking cards; `booking-policy.js` holds shared status/actor rules; `provider-profile.js` owns profiles and CV loading. `journey-state.js` owns browser drafts, discovery restoration and event recording. `api-client.js` bounds session HTTP calls and preserves API error codes. `admin-journey.js` reads aggregate activity through an administrator-only RPC.

## Rollout

1. Apply `supabase/migrations/20261111100000_marketplace_journey.sql` after the existing migrations using the project's normal Supabase migration process. The table uses RLS, has no direct student grants, and its functions require verified sessions; aggregate reads also require an admin role.
2. Deploy the changed HTML, JavaScript and styles together. Restart Express where applicable.
3. Open admin System status and verify the Discovery to booking panel. Without the migration, the panel explains that reporting is not yet available and the marketplace still operates.

No live database migration or deployment was performed as part of this implementation.

## Validation

`npm run test:release` runs unit tests, the journey browser checks, the actual protected-admin browser check under CSP, loading regression checks, and the in-memory PostgreSQL suite. All browser and database checks use isolated fixtures, never production authentication or writes. The GitHub Actions workflow runs this command on pull requests and main pushes; hosted CI itself has not been executed locally.

The database suite covers customer/provider negotiation, agreement retry, acceptance, work start, customer-only completion verification, reviews, cancellation, reporting permissions, event deduplication and retention. The journey browser suite checks five viewport widths, keyboard controls, restored search/drafts, offline feedback and duplicate-safe retry. The existing mobile smoke suite also covers navigation, chat, posting, verification and Google OTP fixtures.

Manual visual inspection: 375px booking cards and provider modal in the dark theme; the modal keeps its booking controls visible. Production email delivery, real OAuth, live realtime connectivity and multi-device draft sync are outside the isolated checks.

## Follow-up review loop

The subsequent review reproduced and corrected these defects:

- A full or inaccessible session store could restore an older persisted draft over newer in-memory edits. Reads now prefer per-account memory, including a tombstone for cleared drafts when storage removal fails.
- Switching a provider's services carried the previous service's instructions forward. Each service now reopens its own draft, with one appointment-slot refresh.
- Drafts omitted the selected published appointment slot. A still-available slot now restores after its options load; changed/closed bookings and moved selections ignore obsolete restores. The restored selection is persisted again after service switches.
- A successful status reconciliation could be overwritten by the original optimistic status even if the customer had already verified completion. The full refresh now returns a snapshot of server booking statuses and the action preserves that result.
- Optimistic booking records omitted `scheduledAt`, leaving appointment sorting/filtering incomplete if the post-save read failed. New records retain the submitted timestamp.

Regression tests exercise service-specific notes, storage quota/revocation, slot restoration across reloads and service changes, late slot responses, and customer verification during provider reconciliation. The unit suite now contains 208 passing tests.
