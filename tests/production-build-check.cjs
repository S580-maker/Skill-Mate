// Starts the exact artifact with fixture-only configuration, then exercises its
// minified browser globals against the same isolated data used by journey tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dist = path.resolve(__dirname, '../dist');
process.env.SUPABASE_URL = 'https://build.supabase.invalid';
process.env.SUPABASE_ANON_KEY = 'fixture-public';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-service';
process.env.SKILLMATE_TEST_ROOT = path.join(dist, 'public');
const { app } = require('../dist/server');
const { start } = require('./support/loading-harness.cjs');
(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  let h;
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(base)).status, 200, 'Production landing route starts');
    assert.equal((await fetch(base + '/admin.html', { redirect: 'manual' })).status, 302, 'Protected admin remains gated');
    for (const file of ['/server.js', '/api/_lib/admin.html', '/.env', '/.env%20ad', '/tests/production-build-check.cjs', '/supabase/schema.sql', '/scripts/build.cjs', '/docs/MODERNIZATION-2026-11-11.md']) {
      assert.equal((await fetch(base + file)).status, 404, `${file} stays private/absent`);
    }
    for (const name of ['.env', '.env ad', 'tests', 'docs', '.git', 'node_modules', 'supabase', 'admin.html']) assert.equal(fs.existsSync(path.join(dist, name)), false, `${name} not packaged`);
    const sourceVendor = fs.readFileSync(path.resolve(__dirname, '../assets/vendor/supabase-js-2.119.0.js'));
    const builtVendor = fs.readFileSync(path.join(dist, 'public/assets/vendor/supabase-js-2.119.0.js'));
    assert.deepEqual(builtVendor, sourceVendor, 'SRI vendor asset remains byte-identical');
    const report = JSON.parse(fs.readFileSync(path.join(dist, 'build-report.json')));
    for (const page of report.pages) {
      const html = fs.readFileSync(path.join(dist, page.file.startsWith('api/') ? page.file : `public/${page.file}`), 'utf8');
      assert.equal([...html.matchAll(/rel="stylesheet"/g)].length, 1, `${page.file} has one stylesheet`);
      const css = fs.readFileSync(path.join(dist, 'public', page.bundle));
      assert.ok(page.bundle.includes(crypto.createHash('sha256').update(css).digest('hex').slice(0, 12)));
      for (const [, relative] of html.matchAll(/(?:src|href)="\/?([^"?#]+)(?:\?[^"#]*)?"/g)) {
        if (!/\.(css|js|svg|woff2)$/.test(relative) || relative === 'supabase-config.js' || /^https?:/.test(relative)) continue;
        assert.equal(fs.existsSync(path.join(dist, 'public', relative)), true, `${page.file}: ${relative} exists`);
      }
    }
    for (const file of ['server.js','package.json','api','build-report.json','content-security-policy.json']) assert.equal(fs.existsSync(path.join(dist,'public',file)),false, `${file} cannot be published statically`);
    const vercel = require('../vercel.json');
    assert.equal(vercel.outputDirectory,'dist/public');
    assert.equal(vercel.functions['api/admin.js'].includeFiles,'dist/api/_lib/admin.html');
    // Execute the Vercel function locally against the compiled private template.
    const realFetch = global.fetch;
    const previousVercel = process.env.VERCEL;
    const account = '11111111-1111-4111-8111-111111111111';
    const accessToken = `fixture.${Buffer.from(JSON.stringify({sub:account,session_id:account,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.signature`;
    let role = 'admin';
    global.fetch = async (input, options) => {
      const url = new URL(String(input));
      if (url.hostname !== 'build.supabase.invalid') return realFetch(input, options);
      return new Response(JSON.stringify(url.pathname === '/auth/v1/user' ? { id: account }
        : url.pathname.includes('verified_auth_sessions') ? [{session_id:account}] : [{id:account,role}]), {headers:{'content-type':'application/json'}});
    };
    process.env.VERCEL = '1';
    const vercelApp = require('express')();
    vercelApp.get('/admin.html', require('../api/admin'));
    const vercelServer = vercelApp.listen(0,'127.0.0.1');
    await new Promise(resolve=>vercelServer.once('listening',resolve));
    try {
      const route = `http://127.0.0.1:${vercelServer.address().port}/admin.html`;
      const options = {redirect:'manual',headers:{cookie:`skillmate_session=${accessToken}`,'x-vercel-forwarded-for':'127.0.0.1'}};
      const adminResponse = await realFetch(route,options);
      assert.equal(adminResponse.status,200);
      assert.ok((await adminResponse.text()).includes(report.pages.find(page=>page.file==='api/_lib/admin.html').bundle));
      assert.equal(adminResponse.headers.get('cache-control'),'private, no-store');
      role = 'student';
      assert.equal((await realFetch(route,options)).status,302);
    } finally {
      global.fetch = realFetch;
      if(previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
      await new Promise(resolve=>vercelServer.close(resolve));
    }
    h = await start();
    for (const width of [375, 1280]) {
      await h.viewport(width); await h.open('index.html#home');
      await h.waitFor('!document.body.classList.contains("app-auth-pending")');
      assert.ok(await h.evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length > 0'));
      for (const page of ['bookings', 'messages', 'saved', 'provider', 'earnings', 'profile-settings']) {
        await h.evaluate(`showPage(${JSON.stringify(page)})`);
        assert.equal(await h.evaluate('document.querySelector(".active-view").dataset.view'), page);
        assert.ok(await h.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
      }
      await h.evaluate('openBooking("p1","s1")');
      assert.equal(await h.evaluate('document.querySelector("#booking-modal").open'), true);
      await h.evaluate('document.querySelector("#booking-modal").close(); openProviderProfile("p1","s1")');
      assert.equal(await h.evaluate('Boolean(document.querySelector(".provider-evidence"))'), true);
    }
    assert.deepEqual(h.pageErrors, [], 'Built scripts run without browser exceptions');
    console.log('PASS production artifact: server startup, protected routes, excluded private files, intact SRI, content hashes, CSS bundles and student journeys');
  } finally { if (h) await h.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
