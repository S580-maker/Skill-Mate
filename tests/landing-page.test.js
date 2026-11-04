const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { app } = require("../server");

test("public homepage serves without a session while existing app routes remain available", async () => {
  const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await fetch(base, { redirect: "manual" });
    assert.equal(home.status, 200);
    assert.equal(home.headers.get("set-cookie"), null);
    const html = await home.text();
    assert.match(html, /id="hero-title"/);
    assert.doesNotMatch(html, /src="[^\"]*(?:auth\.js|supabase|user\.js)/);
    for (const [route, marker] of [
      ["/login.html", 'id="auth-form"'],
      ["/login.html?mode=signup", 'id="signup-tab"'],
      ["/index.html", 'id="app-shell"'],
      ["/privacy.html", "Privacy"],
      ["/terms.html", "Terms"],
    ]) {
      const response = await fetch(base + route, { redirect: "manual" });
      assert.equal(response.status, 200, route);
      assert.ok((await response.text()).includes(marker), `${route} keeps its original page`);
    }
    const admin = await fetch(base + "/admin.html", { redirect: "manual" });
    assert.equal(admin.status, 302);
    assert.equal(admin.headers.get("location"), "/login.html?next=admin");
    for (const asset of ["/landing.css", "/landing.js", "/aurora.css", "/aurora.js"]) {
      assert.equal((await fetch(base + asset)).status, 200, asset);
    }
    assert.equal((html.match(/data-aurora/g) || []).length, 4);
    assert.match(html, /landing-gold\.css/);
    assert.equal((await fetch(base + "/landing-gold.css")).status, 200);
    const aurora = await (await fetch(base + "/aurora.css")).text();
    assert.match(aurora, /pointer-events:none/);
    assert.match(aurora, /prefers-reduced-motion:reduce/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("Vercel maps only the public root to the landing page and retains API rewrites", () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../vercel.json"), "utf8"));
  assert.deepEqual(config.redirects.find(rule => rule.source === "/"), { source: "/", destination: "/landing.html", permanent: false });
  assert.ok(!config.rewrites.some(rule => rule.source === "/"));
  assert.ok(config.rewrites.some(rule => rule.source === "/api/:path*" && rule.destination === "/api/index?path=:path*"));
  assert.ok(!config.rewrites.some(rule => rule.source === "/index.html" || rule.source === "/login.html"));
});
