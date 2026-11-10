# Skillmate Storyset illustrations

Seven genuine **Rafiki** SVG illustrations were downloaded from the official Storyset illustration pages on 2026-11-09. No generated or third-party substitute artwork is included. See `sources.json` for the official page URLs, download URLs, original and installed SHA-256 hashes, and modifications.

The installed files are official **static SVG artwork with Skillmate-authored CSS motion** (a short entrance and gentle float). They are not prebuilt animations exported from Storyset's animation editor. The helper also supports reviewed official animation exports as described below.

| Placement | Official illustration | Installed file |
| --- | --- | --- |
| Onboarding | [College students — Rafiki](https://storyset.com/illustration/college-students/rafiki) | `onboarding.svg` |
| Empty search | [Search — Rafiki](https://storyset.com/illustration/search/rafiki) | `search.svg` |
| Empty saved services | [Bookmarks — Rafiki](https://storyset.com/illustration/bookmarks/rafiki) | `saved.svg` |
| Empty bookings | [Schedule — Rafiki](https://storyset.com/illustration/schedule/rafiki) | `bookings.svg` |
| Empty listings | [Freelancer — Rafiki](https://storyset.com/illustration/freelancer/rafiki) | `listings.svg` |
| No selected chat | [Chatting — Rafiki](https://storyset.com/illustration/chatting/rafiki) | `messages.svg` |
| Booking request saved | [Confirmed — Rafiki](https://storyset.com/illustration/confirmed/rafiki) | `success.svg` |

The original blue accent is recolored to Skillmate navy `#102D72`, with muted gold `#E9DDBA` and cream `#F7F4EC` replacing two neutral shades. Shapes, skin tones, and remaining colors are preserved. The cream illustration canvas keeps dark artwork readable in both app themes.

## License and attribution

- Artwork is by Storyset / Freepik Company and remains subject to [Storyset's terms](https://storyset.com/terms).
- This integration uses the attribution-required license. Each page displays one keyboard-accessible "Artwork: Storyset" link in its footer. Repeated labels under individual illustrations have been removed. Keep the footer credit when using the assets.
- Storyset permits modification under its license; it restricts resale, sublicensing and distribution as standalone stock resources. These assets are used as part of Skillmate, not as an asset library for redistribution.
- Do not remove attribution based merely on having a Freepik account. Storyset's terms specify a qualifying Flaticon Premium subscription and downloading during that subscription for attribution-free use. Retain the relevant license evidence if switching licenses.
- If handing this project to another owner or distributing the repository, review the terms' transfer/client-use conditions; these source files do not grant others a stock-asset license.

## Using an official animated export instead

All seven assets are installed; no downloads are required for the current animation treatment. To replace that treatment with an animation made in Storyset's editor:

1. Open the matching official illustration link above. Keep **Rafiki**, set the main color to `#102D72`, and choose a simple/hidden background as appropriate.
2. Select **Animate it**. Prefer a short fade/slide entrance and gentle float; avoid shaking or continuous rotation.
3. Export the animation for web as **HTML containing SVG and CSS** (see [Storyset FAQ](https://storyset.com/faqs)). Save it in this directory using the matching filename: `onboarding.html`, `search.html`, `saved.html`, `bookings.html`, `listings.html`, `messages.html`, or `success.html`.
4. Review the file, then add `animatedFile: "search.html"` (for example) to the matching entry in the `assets` registry in `/illustrations.js`. Keep the matching static `.svg` file; it supplies reduced-motion artwork and error recovery.
5. Preserve the supplied attribution and update `sources.json` with the export source, date, hash and changes. Bump the helper's cache version in `index.html` and `onboarding.html` when deploying changes.
6. Run `node tests/browser-mobile-smoke.cjs --illustrations-only`, then visually inspect the actual new export on mobile and desktop with reduced motion enabled and disabled.

The helper reads SVG/CSS only, isolates them in a shadow root, and rejects scripts, external resources, SVG SMIL and active embedded content. It does not execute exported HTML. Use Storyset's CSS web export. Unsupported or failed animation exports fall back to the original SVG; they do not affect bookings or navigation.

## Runtime behavior

The same official assets also appear on the main pages, independently of empty lists:

| Page | Location | Asset | Local URL |
| --- | --- | --- | --- |
| Landing (`landing.html`) | Large hero beside the headline; original marketplace mockup remains in an expandable preview | `onboarding.svg` (College students) | `http://localhost:3000/` (also `/landing.html`) |
| Login (`login.html`) | Auth showcase, beside the form on desktop and above it on mobile | `listings.svg` (Freelancer) | `http://localhost:3000/login.html` |
| Signup (`login.html`, signup mode) | Same auth showcase without changing form behavior | `listings.svg` (Freelancer) | `http://localhost:3000/login.html?mode=signup` |
| Dashboard (`index.html`) | Top welcome/search banner, with populated listings too | `onboarding.svg` (College students) | `http://localhost:3000/index.html#home` (sign-in required) |

The public hero and auth art are eager-loaded and have preloaded native image fallbacks, so they do not depend on scrolling or JavaScript to become visible. Each page footer includes an attribution link that remains visible with or without JavaScript. The existing seven placements are retained. No additional asset downloads or libraries are needed.

- `window.skillmateIllustrations.mount(container, name, existingIcon)` adds a reusable `<skillmate-illustration>` while retaining the existing icon as its fallback.
- Assets are fetched when visible (or immediately with `loading="eager"`), from this local directory, and cached in memory. No runtime Storyset requests or animation libraries are used.
- Shadow DOM isolates repeated SVG IDs, styles, and keyframes. Only known asset keys and local filenames are accepted.
- Offscreen/hidden-tab motion pauses. Motion settles to the original static SVG within 4.5 seconds of its first visible playback, including infinite exported animations.
- Reduced motion immediately shows static SVG artwork and responds to changes in the preference. Artwork is decorative; existing text conveys the state.
- Missing or invalid SVG files leave the existing icon, text and action usable. Screens with no pre-existing icon retain their copy and controls.
- The chat illustration follows the existing responsive chat-panel visibility; it does not replace the mobile conversation list.
- The booking receipt is shown after a successful write and retains the existing toast announcement. It describes a pending request, not a confirmed appointment or payment. Local demo saves are explicitly labeled as local.
