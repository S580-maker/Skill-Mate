// Real Chromium rendering with isolated Supabase data; no external writes.
// --baseline records pre-change evidence without requiring the new behavior.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { start } = require("./support/loading-harness.cjs");

const baseline = process.argv.includes("--baseline");
const phase = baseline ? "before" : "after";
const folder = path.resolve(__dirname, "../docs/modernization/screenshots");
const results = [];

(async () => {
  const h = await start();
  const run = script => h.evaluate(`(async () => { ${script} })()`);
  try {
    for (const theme of ["light", "dark"]) {
      await h.setTheme(theme);
      for (const width of [375, 768, 1280]) {
        await h.viewport(width, 900);
        await h.open("index.html?delay=4000#home");
        await h.waitFor('Boolean(document.querySelector(".sk-card"))');
        await h.wait(500);
        const metrics = await h.evaluate(`(() => {
          const root = document.querySelector("#dashboard-loading-skeleton");
          const animations = root.getAnimations({subtree:true}).filter(a=>a.playState === "running" && a.effect.getTiming().iterations === Infinity);
          return { width: innerWidth, theme: document.documentElement.dataset.theme, shapes: root.querySelectorAll(".sk").length, animations: animations.length, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
        })()`);
        results.push(metrics);
        assert.equal(metrics.overflow, false, "loading page fits viewport");
        if (!baseline) assert.ok(metrics.animations <= 12, "loading animation count stays bounded by regions");
        await h.screenshot(path.join(folder, `loading-${phase}-${theme}-${width}.png`));
      }
    }
    await h.emulate({ reducedMotion: true });
    await h.open("index.html?delay=4000#home");
    await h.wait(300);
    assert.equal(await h.evaluate('document.querySelector("#dashboard-loading-skeleton").getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations === Infinity).length'), 0);
    await h.screenshot(path.join(folder, `loading-${phase}-reduced-motion.png`));
    await h.emulate({ reducedMotion: false });

    await h.open("index.html#home");
    await h.waitFor('!document.body.classList.contains("app-auth-pending")', 20000);
    // A failed SVG must recover on reconnection without remounting the empty state.
    await run(`window.__originalFetch=window.fetch; window.__artRequests=0;
      window.fetch=(url,options)=>String(url).endsWith('/search.svg')?(window.__artRequests++,Promise.reject(new TypeError('Fixture offline'))):window.__originalFetch(url,options);
      renderMarketplace('marketplace-grid',[]);`);
    await h.waitFor('Boolean(document.querySelector("skillmate-illustration[name=search][data-unavailable]"))');
    await run('window.fetch=window.__originalFetch;window.dispatchEvent(new Event("online"))');
    await h.wait(600);
    const recovers = await h.evaluate('Boolean(document.querySelector("skillmate-illustration[name=search][data-ready]"))');
    results.push({ failedIllustrationRecoversOnline: recovers });
    if (!baseline) {
      assert.equal(recovers, true, "failed artwork recovers after reconnecting");
      assert.equal(await h.evaluate('document.querySelector("skillmate-illustration[name=search]").hasAttribute("data-unavailable")'), false);
      // Terminal fallback for a stuck local asset; shorten only the deadline in the test.
      await run(`window.__realTimeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>window.__realTimeout(fn,ms===8000?30:ms,...args);
        window.fetch=(url,options)=>String(url).endsWith('/saved.svg')?new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason))):window.__originalFetch(url,options);
        state.saved=[];showPage('saved');`);
      await h.waitFor('Boolean(document.querySelector("skillmate-illustration[name=saved][data-unavailable]"))');
      assert.equal(await h.evaluate('document.querySelector("skillmate-illustration[name=saved]").loading'), false, "timed out artwork releases the busy state");
      assert.ok(await h.evaluate('Boolean(document.querySelector("#saved-grid button, #saved-grid a"))'), "fallback keeps the empty-state action");
      await run('window.setTimeout=window.__realTimeout;window.fetch=window.__originalFetch;window.dispatchEvent(new Event("online"))');
      await h.waitFor('Boolean(document.querySelector("skillmate-illustration[name=saved][data-ready]"))');
      // Once settled, visibility changes must not clone the entire SVG again.
      await run('window.__art=document.querySelector("skillmate-illustration[name=saved]");window.__art.settle();window.__svg=window.__art.art.querySelector("svg");window.__art.setVisible(false);window.__art.setVisible(true)');
      assert.equal(await h.evaluate('window.__art.art.querySelector("svg")===window.__svg'), true);
      // A motion preference can change while the optional animated export is in flight.
      await h.open("index.html#home");
      await h.waitFor('!document.body.classList.contains("app-auth-pending")', 20000);
      await run(`window.__originalFetch=window.fetch;
        window.fetch=(url,options)=>String(url).endsWith('/search.html')?new Promise(resolve=>window.__finishExport=resolve):window.__originalFetch(url,options);
        renderMarketplace('marketplace-grid',[]);
        document.querySelector('skillmate-illustration[name=search]').asset.animatedFile='search.html';`);
      await h.waitFor('typeof window.__finishExport === "function"');
      await h.emulate({ reducedMotion: true });
      await run(`window.__finishExport(new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>@keyframes fixture{to{opacity:.5}}#late-export{animation:fixture 1s infinite}</style><circle id="late-export" cx="5" cy="5" r="4"/></svg>',{status:200}))`);
      await h.waitFor('Boolean(document.querySelector("skillmate-illustration[name=search][data-ready]"))');
      assert.equal(await h.evaluate('Boolean(document.querySelector("skillmate-illustration[name=search]").shadowRoot.querySelector("#late-export"))'), false, "late animated export does not override reduced motion");
      assert.equal(await h.evaluate('document.querySelector("skillmate-illustration[name=search]").animations().length'), 0);
      await h.emulate({ reducedMotion: false });
    }
    assert.deepEqual(h.pageErrors, [], "no uncaught browser errors");
    fs.writeFileSync(path.join(folder, `loading-${phase}-metrics.json`), JSON.stringify(results, null, 2) + "\n");
    console.log(JSON.stringify(results, null, 2));
    console.log(`PASS loading ${phase} visuals, motion and recovery checks`);
  } finally { await h.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
