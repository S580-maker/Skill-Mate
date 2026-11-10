// Real Express routes and real local SDK. No fixtures, cookies, sign-ins, or auth bypasses.
const assert = require("node:assert/strict");
module.exports = async ({ base, call, evaluate, screenshot, wait }) => {
  const visit = async route => {
    await call("Page.navigate", { url: base + route });
    for (let i = 0; i < 120; i++) {
      if (await evaluate('document.readyState === "complete"').catch(() => false)) break;
      await wait(50);
    }
    await wait(500);
  };
  for (const width of [320, 375, 768, 1280, 1920]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    for (const [name, route] of [["landing", "/"], ["login", "/login.html"], ["signup", "/login.html?mode=signup"]]) {
      await visit(route);
      assert.equal(await evaluate('location.pathname'), name === "landing" ? "/" : "/login.html");
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth+1'), `${name}:${width} fits`);
      if (name !== "landing") {
        assert.equal(await evaluate('typeof window.supabase?.createClient'), "function", "Local official SDK loaded and passed SRI");
        assert.equal(await evaluate('document.body.dataset.authMode'), name === "signup" ? "signup" : "signin");
        assert.ok(await evaluate('document.querySelector("#auth-form").getBoundingClientRect().width') > 0);
        if (name === "signup") {
          const sizes = await evaluate('["#auth-name","#auth-university","#auth-email","#auth-password"].map(s=>document.querySelector(s).getBoundingClientRect().height)');
          assert.ok(Math.max(...sizes)-Math.min(...sizes)<=2, `Signup inputs retain equal heights: ${sizes}`);
        }
      }
      await screenshot(`real-${name}-${width}`);
    }
    for (const route of ["/onboarding.html", "/index.html#home", "/admin.html"]) {
      await visit(route);
      for (let i = 0; i < 80 && !await evaluate('location.pathname === "/login.html"'); i++) await wait(50);
      const destination = await evaluate('location.pathname+location.search');
      assert.ok(destination.startsWith("/login.html"), `Protected page remains gated: ${route} -> ${destination}`);
      console.log(`NOT VERIFIED: ${route} at ${width}px requires authentication; redirected to ${destination}`);
    }
    console.log(`PASS real public pages and access gates: ${width}px`);
  }
};
