const assert = require("node:assert/strict");
module.exports = async ({ call, evaluate, navigate, wait, screenshot, checkWidth }) => {
  const ready = async selector => {
    for (let i = 0; i < 60; i++) {
      if (await evaluate(`document.querySelector(${JSON.stringify(selector)})?.hasAttribute("data-ready")`)) return;
      await wait(50);
    }
    throw new Error(`Visible illustration failed to load: ${selector}`);
  };
  const visible = async selector => {
    const box = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight};})()`);
    assert.ok(box.w >= 90 && box.h > 90 && box.y >= 0 && box.bottom <= box.vh && box.x >= 0 && box.right <= box.vw, `Illustration is visible without scrolling: ${JSON.stringify(box)}`);
    assert.equal(await evaluate('document.querySelectorAll(".storyset-credit").length'), 1, "Attribution is consolidated in the page footer");
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector)}).shadowRoot.querySelector('.credit')`), null, "No label beneath the illustration");
  };
  for (const width of [320, 390, 768, 1366, 1920]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 });
    await navigate("index.html");
    await ready(".dashboard-welcome-illustration");
    await visible(".dashboard-welcome-illustration");
    assert.ok(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length') > 0, "Welcome illustration shows with populated listings");
    await checkWidth(`${width}:dashboard welcome`);
    await wait(650); await screenshot(`main-dashboard-${width}`);
    await evaluate('globalSearch.value="calculus";document.querySelector("#marketplace-search-submit").click()');
    assert.ok(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length') > 0, "Search still works");
    for (const mode of ["signin", "signup"]) {
      await navigate(`login.html?mode=${mode}`);
      await ready(".auth-welcome-illustration");
      await visible(".auth-welcome-illustration");
      await checkWidth(`${width}:${mode}`);
      assert.equal(await evaluate('document.body.dataset.authMode'), mode);
      const overlap = await evaluate(`(()=>{const a=document.querySelector('.auth-welcome-illustration').getBoundingClientRect(),b=document.querySelector('#auth-form').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;})()`);
      assert.equal(overlap, false, "Art never overlaps the form");
      await evaluate('document.querySelector("#auth-email").focus()');
      assert.equal(await evaluate('document.activeElement.id'), "auth-email");
      await evaluate('scrollTo(0,0)'); await wait(650); await screenshot(`main-${mode}-${width}`);
      await evaluate('document.querySelector("#'+(mode === "signup" ? "signin" : "signup")+'-tab").click()');
      assert.equal(await evaluate('document.body.dataset.authMode'), mode === "signup" ? "signin" : "signup");
    }
    console.log(`PASS main dashboard, login and signup illustrations: ${width}px`);
  }
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await navigate("login.html"); await ready(".auth-welcome-illustration");
  assert.equal(await evaluate('document.querySelector(".auth-welcome-illustration").shadowRoot.querySelector(".art").getAnimations({subtree:true}).length'), 0);
  await call("Emulation.setEmulatedMedia", { features: [] });
  await navigate("login.html"); await ready(".auth-welcome-illustration");
  assert.ok(await evaluate('document.querySelector(".auth-welcome-illustration").shadowRoot.querySelector(".art").getAnimations({subtree:true}).length') > 0);
  console.log("PASS main-page motion and reduced-motion behavior");
};
