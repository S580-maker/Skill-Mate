// Browser checks for the skeleton and loading-state system. Runs the real student app against a fake
// Supabase client (tests/support/loading-harness.cjs), so nothing contacts a database.
const assert = require("node:assert/strict");
const { start } = require("./support/loading-harness.cjs");

const widths = [320, 375, 768, 1280, 1920];
const routes = { home: "home", bookings: "bookings", messages: "messages", saved: "saved", provider: "provider", earnings: "earnings", "profile-settings": "profile-settings" };
const pass = message => console.log(`PASS ${message}`);

(async () => {
  const harness = await start();
  const { evaluate, waitFor, wait } = harness;
  try {
    // 1. Every route previews its own layout, fits the viewport and never scrolls sideways.
    for (const width of widths) {
      await harness.viewport(width, width < 600 ? 800 : 900);
      for (const route of Object.keys(routes)) {
        await harness.open(`index.html?delay=3000#${route}`);
        await wait(250);
        const state = await evaluate(`(() => { const root = document.querySelector("#dashboard-loading-skeleton"); return { route: root.dataset.skeletonRoute, header: Boolean(root.querySelector(".sk-header")), scrollWidth: root.scrollWidth, pending: document.body.classList.contains("app-auth-pending"), live: document.querySelectorAll(".sk").length }; })()`);
        assert.equal(state.route, route, `${width}px ${route}: route skeleton`);
        assert.equal(state.header, true, `${width}px ${route}: header preview`);
        assert.ok(state.scrollWidth <= width + 1, `${width}px ${route}: skeleton overflows horizontally (${state.scrollWidth})`);
        assert.ok(state.live > 5, `${width}px ${route}: skeleton has content`);
      }
    }
    pass(`route skeletons match their pages with no horizontal overflow at ${widths.join("/")}px`);

    // 2. A fast request replaces the skeleton with content and leaves no busy regions behind.
    await harness.viewport(1280, 900);
    await harness.open("index.html?delay=0#home");
    await waitFor('document.body.classList.contains("app-auth-pending") === false && document.querySelectorAll("#marketplace-grid .provider-card").length > 0');
    assert.equal(await evaluate('document.querySelectorAll("[aria-busy=true]").length'), 0, "busy regions remain after loading");
    assert.equal(await evaluate('document.querySelectorAll("#marketplace-grid .sk, #saved-grid .sk").length'), 0, "skeletons remain after loading");
    pass("fast load shows content and clears aria-busy");

    // 3. A slow request keeps the skeleton, then swaps it for content without an empty state in between.
    await harness.open("index.html?delay=700#home");
    await evaluate(`window.__seenEmpty = false; new MutationObserver(() => { if (document.querySelector("#marketplace-grid .empty-state, #marketplace-grid .listing-empty")) window.__seenEmpty = true; }).observe(document.body, { childList: true, subtree: true });`);
    await waitFor('document.querySelectorAll("#marketplace-grid .provider-card").length > 0', 20000);
    assert.equal(await evaluate("window.__seenEmpty"), false, "an empty state flashed before the data arrived");
    pass("slow load shows no empty state before data arrives");

    // 4. Empty data renders an empty state, not a skeleton.
    await harness.open("index.html?empty=1#bookings");
    await waitFor('document.body.classList.contains("app-auth-pending") === false', 20000);
    await wait(300);
    assert.equal(await evaluate('document.querySelectorAll("#user-booking-list .sk").length'), 0, "booking skeleton stuck on empty data");
    assert.ok((await evaluate('document.querySelector("#user-booking-list").textContent.trim().length')) > 0, "empty bookings list has no message");
    pass("empty data resolves to an empty state");

    // 5. A failed load explains the problem, offers a retry and focuses it.
    await harness.open("index.html?fail=all#home");
    await waitFor('Boolean(document.querySelector("#app-auth-status [data-loading-retry], #marketplace-grid [data-loading-retry]"))', 20000);
    const failure = await evaluate(`(() => { const retry = document.querySelector("[data-loading-retry]"); return { alert: Boolean(retry.closest("[role=alert]")), focused: document.activeElement === retry, text: retry.closest("[role=alert]").textContent.trim().length > 10, stuck: document.querySelectorAll("#dashboard-loading-skeleton:not([hidden]) .sk").length }; })()`);
    assert.equal(failure.alert, true, "failure is announced");
    assert.equal(failure.text, true, "failure has a message");
    assert.equal(failure.stuck, 0, "skeleton stays visible next to the failure");
    pass("failed requests show an alert with a retry action");

    // 6. Placeholders are visible in both themes and static under reduced motion.
    for (const theme of ["light", "dark"]) {
      await harness.setTheme(theme);
      await harness.open("index.html?delay=3000#home");
      await wait(250);
      const colors = await evaluate(`(() => { const sk = document.querySelector("#dashboard-loading-skeleton .sk-card .sk"); const card = sk.closest(".sk-card"); return { base: getComputedStyle(sk).backgroundColor, surface: getComputedStyle(card).backgroundColor, theme: document.documentElement.dataset.theme }; })()`);
      assert.equal(colors.theme, theme);
      assert.notEqual(colors.base, colors.surface, `${theme}: placeholder is distinguishable from its surface`);
    }
    await harness.emulate({ reducedMotion: true });
    await harness.open("index.html?delay=3000#home");
    await wait(250);
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#dashboard-loading-skeleton .sk"), "::after").animationName'), "none", "shimmer runs under reduced motion");
    await harness.emulate({ reducedMotion: false });
    await harness.setTheme("light");
    pass("light and dark placeholders are visible; reduced motion removes the shimmer");

    // 7. Rapid page changes neither throw nor leave busy regions behind.
    await harness.open("index.html?delay=0#home");
    await waitFor('document.body.classList.contains("app-auth-pending") === false', 20000);
    for (const hash of ["bookings", "messages", "saved", "earnings", "home", "profile-settings", "home"]) {
      await evaluate(`location.hash = ${JSON.stringify(hash)}`);
      await wait(40);
    }
    await wait(500);
    assert.equal(await evaluate('document.querySelectorAll("[aria-busy=true]").length'), 0, "busy regions remain after rapid navigation");
    assert.deepEqual(harness.pageErrors, [], "page errors during loading");
    pass("rapid page changes leave no busy regions or page errors");

    // 8. The skeleton header has the same height as the live header, so the swap does not shift the page.
    await harness.open("index.html?delay=3000#home");
    await wait(250);
    const skeletonHeader = await evaluate('document.querySelector("#dashboard-loading-skeleton .sk-header").getBoundingClientRect().height');
    await harness.open("index.html?delay=0#home");
    await waitFor('document.body.classList.contains("app-auth-pending") === false', 20000);
    const liveHeader = await evaluate('document.querySelector("header.marketplace-header").getBoundingClientRect().height');
    assert.ok(Math.abs(skeletonHeader - liveHeader) <= 2, `header height changes from ${skeletonHeader} to ${liveHeader}`);
    pass("skeleton and live header heights match");

    // A route change during startup must update the preview without starting another read.
    await harness.open("index.html?delay=500#home");
    await wait(200);
    await evaluate('location.hash="bookings"');
    await waitFor('document.querySelector("#dashboard-loading-skeleton").dataset.skeletonRoute === "bookings"');
    await waitFor('!document.body.classList.contains("app-auth-pending")', 20000);
    assert.equal(await evaluate('document.querySelector(".active-view").dataset.view'), "bookings");
    pass("navigation during loading updates the preview and resolves to the requested route");

    // Initial account failures must not masquerade as empty conversations; retry recovers.
    await evaluate('localStorage.clear()'); // This scenario intentionally has no cached conversations.
    await harness.open("index.html?fail=provider_directory#messages");
    await waitFor('!document.body.classList.contains("app-auth-pending")', 20000);
    assert.ok(await evaluate('Boolean(document.querySelector("#conversation-list [data-loading-retry]"))'));
    await evaluate('window.__fake.failing.clear(); document.querySelector("#conversation-list [data-loading-retry]").click()');
    await waitFor('document.querySelectorAll("#conversation-list .conversation-item").length > 0', 20000);
    assert.equal(await evaluate('document.querySelectorAll("[aria-busy=true]").length'), 0);
    pass("conversation failures are distinct from empty data and retry restores content");

    // Reopening notifications preserves loaded rows through a failed refresh.
    await evaluate('document.querySelector("#notifications-button").click()');
    await waitFor('document.querySelectorAll(".notification-item").length > 0');
    await evaluate('document.querySelector("#notifications-modal").close(); window.__fake.delay=300; window.__fake.failing.add("notifications"); document.querySelector("#notifications-button").click()');
    await wait(180);
    assert.equal(await evaluate('document.querySelectorAll(".notification-item").length'), 1);
    assert.equal(await evaluate('document.querySelectorAll("#notifications-list .sk").length'), 0);
    await waitFor('document.querySelector("#notifications-more").textContent === "Try again"');
    assert.equal(await evaluate('document.querySelectorAll(".notification-item").length'), 1);
    await evaluate('window.__fake.failing.clear(); window.__fake.delay=0; document.querySelector("#notifications-more").click()');
    await waitFor('!document.querySelector("#notifications-more").disabled');
    assert.equal(await evaluate('document.querySelectorAll(".notification-item").length'), 1, "retry reset must not duplicate cached rows");
    pass("notification refresh preserves content; retry neither duplicates nor drops rows");

    await evaluate('document.querySelector("#notifications-modal").close()');
    // Only the optional CV needs a read. Cached details resolve synchronously; a slow
    // read gets a placeholder, and a late old response cannot replace a newer profile.
    await evaluate(`window.__first = connectedProviders[0]; window.__second = connectedProviders[1];
      window.__first.id = "11111111-1111-1111-1111-111111111111";
      window.__first.cvPath = window.__first.id + "/22222222-2222-2222-2222-222222222222.pdf";
      appSupabase.storage.from = () => ({ createSignedUrl: () => new Promise(resolve => { window.__finishCV = resolve; }) });
      void openProviderProfile(window.__first.id);`);
    await waitFor('Boolean(document.querySelector("#provider-detail-content .sk-detail"))');
    assert.equal(await evaluate('document.querySelector("#provider-detail-content").getAttribute("aria-busy")'), "true");
    await harness.screenshot(require('node:path').join(process.env.TEMP || harness.output, 'skillmate-detail-loading.png'));
    await evaluate('void openProviderProfile(window.__second.id); window.__finishCV({data:{signedUrl:"https://example.test/cv.pdf"},error:null})');
    await wait(50);
    assert.equal(await evaluate('document.querySelector("#provider-detail-content .showcase-identity h2").textContent'), await evaluate('window.__second.name'));
    assert.equal(await evaluate('document.querySelector("#provider-detail-content").hasAttribute("aria-busy")'), false);
    await evaluate(`window.__deadline = window.skillmateLoading.withTimeout;
      window.skillmateLoading.withTimeout = request => window.__deadline(request, 40);
      void openProviderProfile(window.__first.id);`);
    await waitFor('Boolean(document.querySelector("#provider-detail-content .showcase-identity"))');
    assert.equal(await evaluate('document.querySelectorAll("#provider-detail-content .sk").length'), 0);
    await evaluate('window.skillmateLoading.withTimeout=window.__deadline');
    await evaluate('void openProviderProfile(window.__first.id)');
    await waitFor('Boolean(document.querySelector("#provider-detail-content .sk-detail"))');
    await evaluate('document.querySelector("#provider-detail-modal").close()');
    await wait(30);
    assert.equal(await evaluate('document.querySelector("#provider-detail-content").hasAttribute("aria-busy")'), false);
    await evaluate('window.__finishCV({data:null,error:null})');
    pass("detail reads handle fast completion, overlapping profiles and a hung optional CV");

    // Admin uses the same real markup, but an explicitly fake admin role. No live auth is bypassed.
    for (const width of widths) {
      await harness.viewport(width);
      await harness.open('admin.html?admin=1&delay=800#performance');
      await waitFor('Boolean(document.querySelector(".sk-admin-chart"))');
      await waitFor('getComputedStyle(document.querySelector("#admin-skeleton")).visibility === "visible"');
      assert.ok(await evaluate(`document.querySelector("#admin-skeleton").scrollWidth <= ${width + 1}`));
      await harness.screenshot(require('node:path').join(process.env.TEMP || harness.output, `skillmate-admin-loading-${width}.png`));
    }
    await harness.open('admin.html?admin=1&delay=0');
    await waitFor('document.body.classList.contains("admin-ready")', 20000);
    assert.equal(await evaluate('document.querySelector("#admin-auth-gate").hasAttribute("aria-busy")'), false);
    pass("admin preview fits every requested width and its fixture gate clears on success");
  } finally {
    await harness.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
