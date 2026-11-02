# Service editor changes

## Inspection and scope

The original service form lived in `index.html` with submit/edit listeners in `user.js`. It saved `title`, `category`, `price`, `description`, and `accepts_groups` to `services`; updates were filtered by service ID and provider ID. Its cancelled edit state was reused by Add a service. The client also limited descriptions to 240 characters and prices to whole numbers although the database supports 2,000 characters and two decimal places.

The original schema had no service cover, delivery method, estimate, or price type. Existing storage buckets were `portfolio-images`, `profile-avatars`, and `support-screenshots`. Service RLS limits writes to the provider or the existing administrative policy. Storage policies scope writes to the authenticated user's folder. These observations are from repository SQL; live policies have not been inspected.

The user approved the local migration and frontend implementation. No live migration or deployment was performed. This work focuses on the requested service editor and the listing/read paths it depends on.

## Implemented

- A navy header, blue primary actions, compact field groups, restrained italic helper text, and a scrollable body with persistent footer controls. Mobile inputs use 16px text; optional cover, timing, and group preferences are collapsible.
- Category-specific title and description examples, an accurate character counter, inline validation and error associations, decimal prices, and native dialog keyboard behavior. Closing restores focus; opening Add resets cancelled edit state. Native Escape and backdrop close are blocked only while a save is in progress.
- Details → preview → explicit publish/save. User content is inserted as text or escaped. A failed save retains the draft; repeat submissions are guarded, and create retries reuse one UUID. A failed refresh after an acknowledged write is reported as saved.
- Optional cover previews with MIME, signature, byte-size and decoded-dimension checks. Images above 5 MB or 16 megapixels are rejected. Accepted images are resized to a maximum 1,600px edge and re-encoded through canvas, removing source metadata. SVG/GIF are rejected. Object URLs are revoked when replaced or closed.
- The provider editor uses one Pricing & negotiation choice (Fixed Price, In-Chat Negotiation, or Hybrid) and one listed price; it no longer asks providers to choose between Fixed/Starting Price or Controlled Negotiation. Legacy Starting Price rows display their saved amount without a “From” label; legacy Controlled Negotiation rows are migrated to Hybrid.
- In-Chat Negotiation offers a chat discussion action and a provider price-proposal action. Hybrid adds customer formal offers, accept/reject/counter controls, and agreed-price booking. Fixed Price has no chat price actions. Accepted agreements remain explicit and immutable; booking is a separate customer-confirmed step.
- Replaced covers are removed only after an acknowledged save and a successful check for remaining references. If a write response is uncertain, the uploaded image is retained to avoid breaking a possibly committed listing. Such abandoned uploads can require later storage housekeeping.
- Account closure includes the new cover bucket and tolerates its absence before migration.

## Approved local migration

Apply `supabase/migrations/20261027120000_service_listing_details.sql` through the normal migration process, once, after deployment approval. It is also appended to `supabase/schema.sql` for fresh installs; do not run both against the same initialized database.

The migration adds:

| Field | Meaning |
| --- | --- |
| `cover_image_path` | Optional owner-prefixed storage path |
| `delivery_method` | `online`, `in_person`, or `both`; old rows remain unspecified |
| `estimated_delivery` | Optional text, up to 80 characters |
| `price_type` | Legacy database field retained for compatibility; the editor saves `fixed` and no longer exposes this as a separate choice |

It appends those fields to `provider_directory` while preserving its existing security mode and filters. The public `service-covers` bucket limits file sizes to 5,000,000 bytes and MIME types to JPEG, PNG and WebP. New insert/select/delete policies require the authenticated owner's folder; uploads use unique paths without overwrite. Existing service and storage policies are not removed or relaxed. Covers are public listing media, not private documents. Browser checks complement bucket restrictions; full file-signature enforcement by a trusted server would require a separate upload service.

Until the migration is applied, the form detects unavailable columns, disables new controls and saves only the existing fields. It never silently drops entered new fields during a failed migrated save.

## Verification and limitations

Run `node --test tests/*.test.js` and `npm run test:ui`. Coverage includes field validation, file signatures, legacy payload compatibility, create versus edit behavior, two-step publication, duplicate submissions, retry IDs, post-save refresh failure, cancelled-edit reset, dynamic examples, pricing-mode migration, and chat-action visibility across modes.

All 113 Node tests and the real-browser UI smoke tests passed, including tested viewport widths from 320px to 1440px. The active browser page confirms the three mode choices and no separate Fixed/Starting price selector. No authenticated Supabase test database was available, so the SQL migration has not been applied or exercised against a live database. Apply it in a test project before deploying.

Primary files: `index.html`, `user.css`, `user.js`, `service-form.js`, `service-form-utils.js`, migration/schema SQL, `api/_lib/account-delete.js`, and regression tests.
