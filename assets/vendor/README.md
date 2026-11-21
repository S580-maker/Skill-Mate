# Supabase browser dependency

The official `@supabase/supabase-js` UMD browser bundle is vendored at the exact version recorded in `supabase-source.json`. It is the version that the pre-existing `@2` CDN URL resolved to during the 2026-11-10 audit, not an intentional SDK upgrade. The MIT license is retained alongside it.

All five existing Supabase entry points use this one local, versioned file with SHA-384 Subresource Integrity, preserving their original blocking/deferred order: SDK, public configuration, existing client initializer, page script. No credentials, session settings, client options, database schemas or policies were changed. SDK network/CDN availability is no longer required to display authentication pages.

Supabase documents the browser bundle approach at https://supabase.com/docs/reference/javascript/installing. Keep this dependency versioned: review release notes, download the exact official package file, update the source record and integrity attributes, then run the dependency, authentication and browser checks before updating it. There is no automatic fallback to a floating CDN version.
