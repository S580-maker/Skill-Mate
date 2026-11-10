// Measures the real app DOM with a fake read-only Supabase transport, not a live sign-in.
const { start } = require('./support/loading-harness.cjs');
const assert = require('node:assert/strict');
(async () => {
  const h = await start();
  try {
    for (const width of [320, 375, 768, 1280, 1920]) {
      await h.viewport(width);
      await h.open('index.html?delay=500#home');
      await h.waitFor('Boolean(document.querySelector(".sk-card"))');
      const read = selectors => h.evaluate(`(${JSON.stringify(selectors)}).map(s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return {s,x:r?.x,y:r?.y,w:r?.width,h:r?.height}})`);
      const before = await read(['.sk-header', '.sk-welcome', '.sk-discovery .sk-card', '.sk-side-card']);
      await h.waitFor('!document.body.classList.contains("app-auth-pending")', 20000);
      await h.wait(400);
      const after = await read(['header.marketplace-header', '#view-home .discover-intro', '#marketplace-grid .provider-card', '.welcome-card']);
      for (const i of [0, 1]) {
        assert.ok(Math.abs(before[i].h - after[i].h) <= 2, `${width}: header/hero height changes`);
        assert.ok(Math.abs(before[i].y - after[i].y) <= 2, `${width}: header/hero moves`);
      }
      assert.ok(Math.abs(before[2].w - after[2].w) <= 1, `${width}: card columns differ`);
      assert.ok(Math.abs(before[2].y - after[2].y) <= 20, `${width}: first card moves more than 20px`);
      assert.ok(Math.abs(before[2].h - after[2].h) <= 32, `${width}: representative card height differs by more than two lines`);
      console.log(JSON.stringify({ width, before, after }));
    }
  } finally { await h.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
