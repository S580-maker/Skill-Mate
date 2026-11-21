// Real Chromium renders, isolated Supabase fixtures. No live writes or credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { start } = require('./support/loading-harness.cjs');
const stage = process.argv.includes('--before') ? 'before' : 'after';
const folder = path.resolve(__dirname, '../docs/modernization/screenshots');
const corePages = [
  ['landing', 'landing.html'], ['login', 'login.html?signedout'],
  ['signup', 'login.html?signedout&mode=signup'], ['onboarding', 'onboarding.html?onboarding'],
  ['discover', 'index.html#home'], ['activity', 'index.html#activity'],
  ['bookings', 'index.html#bookings'], ['messages', 'index.html#messages'],
  ['saved', 'index.html#saved'], ['listings', 'index.html#provider'],
  ['earnings', 'index.html#earnings'], ['settings', 'index.html#profile-settings'],
  ['provider', 'index.html#home', 'openProviderProfile("p1","s1")'],
  ['booking-form', 'index.html#home', 'openBooking("p1","s1")'],
  ['admin', 'admin.html?admin'],
];
const extraPages = [['recovery','forgot-password.html'], ['reset','reset.html?signedout'], ['privacy','privacy.html'], ['terms','terms.html']];
const pages = process.argv.includes('--extra') ? extraPages : [...corePages, ...extraPages];
(async () => {
  const h = await start();
  const observations = [];
  try {
    await h.emulate({ reducedMotion: true });
    await h.call('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.__visualMetrics = { cls: 0, lcp: 0 };
      new PerformanceObserver(list => list.getEntries().forEach(e => {
        if (!e.hadRecentInput) window.__visualMetrics.cls += e.value;
      })).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(list => list.getEntries().forEach(e => window.__visualMetrics.lcp = e.startTime)).observe({ type: 'largest-contentful-paint', buffered: true });
    ` });
    for (const theme of ['light', 'dark']) {
      await h.setTheme(theme);
      for (const width of [375, 768, 1280]) {
        await h.viewport(width, 900);
        for (const [name, route, action] of pages) {
          await h.open(route);
          if (route.startsWith('index')) await h.waitFor('!document.body.classList.contains("app-auth-pending")');
          if (name === 'admin') await h.waitFor('document.body.classList.contains("admin-ready")');
          if (name === 'onboarding') await h.waitFor('document.querySelector("#onboarding-name")?.value');
          await h.evaluate('document.fonts.ready');
          if (action) await h.evaluate(action);
          await h.wait(180);
          const result = await h.evaluate(`(() => {
            const controls = [...document.querySelectorAll('button, a, input, select, textarea')].filter(e => e.getBoundingClientRect().width && e.getBoundingClientRect().height);
            return { path: location.pathname, overflow: document.documentElement.scrollWidth > innerWidth + 1,
              unnamed: controls.filter(e => !e.textContent.trim() && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !e.labels?.length && !e.title).map(e => e.id || e.className),
              ...window.__visualMetrics,
              resources: performance.getEntriesByType('resource').filter(e=>/\\.(css|js)(\\?|$)/.test(e.name)).map(e=>({name:new URL(e.name).pathname,bytes:e.decodedBodySize})) };
          })()`);
          if (stage === 'after') assert.equal(result.overflow, false, `${name} fits ${width}px ${theme}`);
          observations.push({ name, width, theme, ...result });
          await h.screenshot(path.join(folder, `${stage}-${name}-${theme}-${width}.png`));
        }
        console.log(`${stage}: captured ${pages.length} pages at ${width}px ${theme}`);
      }
    }
    assert.deepEqual(h.pageErrors, [], 'No uncaught browser exceptions');
    const metricFile = path.resolve(folder, `../${stage}-visual-metrics.json`);
    const previous = process.argv.includes('--extra') && fs.existsSync(metricFile) ? JSON.parse(fs.readFileSync(metricFile)) : [];
    fs.writeFileSync(metricFile, JSON.stringify([...previous.filter(row => !pages.some(([name]) => row.name === name)), ...observations], null, 2));
    console.log(`Screenshots: ${folder}`);
  } finally { await h.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
