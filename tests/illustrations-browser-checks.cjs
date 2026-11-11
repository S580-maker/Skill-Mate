// Runs through browser-mobile-smoke.cjs --illustrations-only, using its isolated fixtures.
const assert = require("node:assert/strict");
module.exports = async ({ call, evaluate, navigate, wait, screenshot, checkWidth }) => {
  const ready = async name => {
    await evaluate(`document.querySelector('skillmate-illustration[name="${name}"]')?.scrollIntoView({block:"center"})`);
    for (let i = 0; i < 60; i++) {
      if (await evaluate(`!!document.querySelector('skillmate-illustration[name="${name}"][data-ready]')`)) return;
      await wait(50);
    }
    throw new Error(`Illustration did not load: ${name}: ` + await evaluate(`document.querySelector('skillmate-illustration[name="${name}"]')?.outerHTML`));
  };
  for (const width of [320, 390, 768, 1366, 1920]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await navigate("index.html");
    assert.equal(await evaluate('!!window.skillmateIllustrations'), true);
    assert.equal(await evaluate('performance.getEntriesByType("resource").filter(r=>r.name.includes("/illustrations/storyset/")&&!r.name.endsWith("/onboarding.svg")).length'), 0, "Hidden empty-state illustrations are not fetched");
    await evaluate('showPage("home");state.services=[];renderMarketplace("marketplace-grid",[])');
    await ready("search");
    await checkWidth(`${width}:empty search`);
    assert.equal(await evaluate('document.querySelector("#marketplace-grid [data-clear-search]").textContent'), "Clear search & filters");
    await screenshot(`storyset-search-${width}`);
    await evaluate('document.querySelector("#marketplace-grid [data-clear-search]").click()');
    assert.ok(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length') > 0, "Explore services still works");
    await evaluate('state.saved=[];showPage("saved")');
    await ready("saved");
    await checkWidth(`${width}:saved`);
    await evaluate('state.bookings=[];showPage("bookings")');
    await ready("bookings");
    await checkWidth(`${width}:bookings`);
    await evaluate('window.skillmateIllustrations.showBookingSuccess()');
    await ready("success");
    assert.match(await evaluate('document.querySelector("#booking-success").textContent'), /Awaiting provider confirmation/);
    await checkWidth(`${width}:receipt`);
    await screenshot(`storyset-receipt-${width}`);
    await evaluate('document.querySelector("[data-dismiss-booking-success]").click()');
    assert.equal(await evaluate('document.querySelector("#booking-success").hidden'), true);
    await evaluate('state.services=[];showPage("provider");renderListings()');
    await ready("listings");
    await checkWidth(`${width}:listings`);
    assert.equal(await evaluate('!!document.querySelector("#listing-list [data-open=service-modal]")'), true);
    await evaluate('showPage("messages");renderEmptyChat()');
    // Mobile intentionally hides the unselected chat panel. Do not force a new mobile flow.
    if (await evaluate('getComputedStyle(document.querySelector("#chat-panel")).display !== "none"')) { await ready("messages"); await checkWidth(`${width}:messages`); }
    await navigate("onboarding.html");
    await ready("onboarding");
    await checkWidth(`${width}:onboarding`);
    assert.equal(await evaluate('document.querySelector("#onboarding-name").value'), "Test Student");
    await screenshot(`storyset-onboarding-${width}`);
    if (width === 390) {
      await evaluate('document.querySelector("#onboarding-campus").value="University of Ghana";document.querySelector("#onboarding-form").requestSubmit()');
      await wait(200);
      assert.equal(await evaluate('JSON.parse(sessionStorage.getItem("onboarding-fixture")).onboarding_completed'), true, "Onboarding saves through the existing handler");
    }
    console.log(`PASS Storyset placements and existing actions at ${width}px`);
  }
  // In-flight / failed / successful real submit handlers, backed only by local mock writes.
  await navigate("index.html");
  await evaluate(`window.__testDisableRealtime=true;appUser={id:"illustration-customer"};
    connectedServices=[{id:"illustration-service",providerId:"daniel",title:"Laptop help",category:"Tech",price:50,priceType:"fixed",currency:"GHS",active:true,delivery:"in-person",negotiationMode:"fixed"}];
    providerServices=()=>connectedServices;refreshSupabaseState=async()=>{};refreshLiveActivity=async()=>{};
    appSupabase={from:()=>({insert:()=>new Promise(resolve=>{window.__finishBooking=resolve;})})};
    openBooking("daniel","illustration-service");
    document.querySelector('#booking-date').value='2035-05-10';document.querySelector('#booking-time').value='12:00';
    document.querySelector('#booking-location-type').value='campus';document.querySelector('#booking-location-type').dispatchEvent(new Event('change'));
    document.querySelector('#booking-confirm-details').checked=true;
    document.querySelector('#booking-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));`);
  assert.equal(await evaluate('typeof window.__finishBooking'), "function", "The booking write started");
  assert.equal(await evaluate('document.querySelector("#booking-success").hidden'), true, "No premature success during pending write");
  await evaluate('window.__finishBooking({error:{message:"Fixture rejected"}})'); await wait(100);
  assert.equal(await evaluate('document.querySelector("#booking-success").hidden'), true, "No success after failed write");
  assert.equal(await evaluate('document.querySelector("#booking-modal").open'), true, "Failed booking restores existing dialog");
  await evaluate('document.querySelector("#booking-form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');
  await evaluate('window.__finishBooking({error:null})'); await wait(150);
  assert.equal(await evaluate('document.querySelector("#booking-success").hidden'), false, "Success only after saved booking");
  await evaluate('showPage("home")');
  assert.equal(await evaluate('document.querySelector("#booking-success").hidden'), true, "Navigation clears old receipt");
  console.log("PASS booking pending, failure, retry, success and navigation");

  await navigate("index.html");
  await evaluate('state.services=[];renderMarketplace("marketplace-grid",[])'); await ready("search");
  assert.ok(await evaluate('document.querySelector("skillmate-illustration[name=search]").shadowRoot.querySelector(".art").getAnimations({subtree:true}).length') > 0, "Subtle CSS motion starts");
  await evaluate('showPage("saved")'); await wait(100);
  assert.equal(await evaluate('document.querySelector("skillmate-illustration[name=search]").shadowRoot.querySelector(".art").getAnimations({subtree:true}).every(a=>a.playState==="paused")'), true, "Hidden view pauses motion");
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await wait(100);
  await evaluate('showPage("home");state.services=[];renderMarketplace("marketplace-grid",[])'); await ready("search");
  assert.equal(await evaluate('document.querySelector("skillmate-illustration[name=search]").shadowRoot.querySelector(".art").getAnimations({subtree:true}).length'), 0, "Reduced motion shows static original artwork");
  await screenshot("storyset-reduced-motion");
  await call("Emulation.setEmulatedMedia", { features: [] });
  await evaluate('state.services=[];renderMarketplace("marketplace-grid",[])'); await ready("search"); await wait(4700);
  assert.equal(await evaluate('document.querySelector("skillmate-illustration[name=search]").shadowRoot.querySelector(".art").getAnimations({subtree:true}).length'), 0, "Motion settles within five seconds");
  const requests = await evaluate('performance.getEntriesByType("resource").filter(r=>r.name.endsWith("/search.svg")).length');
  assert.equal(requests, 1, "Repeated render uses cached SVG");
  await evaluate('document.documentElement.dataset.theme="dark"'); await screenshot("storyset-dark");
  await evaluate('document.documentElement.dataset.theme="light"'); await screenshot("storyset-light");

  // Synthetic parser fixture only: never installed as a product illustration.
  await navigate("index.html?export-test=1");
  await evaluate(`window.__exportFetch=window.fetch;window.fetch=(url,...args)=>String(url).endsWith('/search.html')?Promise.resolve(new Response('<html><body><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>#export-fixture{animation:float 1s infinite} @keyframes float{to{opacity:.9}}</style><circle id="export-fixture" cx="5" cy="5" r="4"/></svg><a href="https://storyset.com">Storyset</a></body></html>',{status:200})):window.__exportFetch(url,...args);state.services=[];renderMarketplace('marketplace-grid',[])`);
  await ready("search");
  assert.equal(await evaluate('!!document.querySelector("skillmate-illustration[name=search]").shadowRoot.querySelector("#export-fixture")'), true, "Official-format HTML SVG/CSS can be loaded");
  assert.equal(await evaluate('document.querySelector("#export-fixture")'), null, "Export IDs stay isolated inside the shadow root");
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await wait(100);
  assert.equal(await evaluate('!!document.querySelector("skillmate-illustration[name=search]").shadowRoot.querySelector("#export-fixture")'), false, "Reduced motion replaces exported animation with original static art");
  await call("Emulation.setEmulatedMedia", { features: [] });
  await navigate("index.html?export-test=1");
  await evaluate(`window.__exportFetch=window.fetch;window.fetch=(url,...args)=>String(url).endsWith('/search.html')?Promise.resolve(new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>window.__unsafeRan=true</script></svg>',{status:200})):window.__exportFetch(url,...args);state.services=[];renderMarketplace('marketplace-grid',[])`);
  await ready("search");
  assert.equal(await evaluate('!!window.__unsafeRan'), false, "Active export content is never executed");
  assert.equal(await evaluate('!!document.querySelector("skillmate-illustration[name=search]").shadowRoot.querySelector("svg path")'), true, "Invalid export falls back to genuine static SVG");
  console.log("PASS exported HTML/CSS isolation, reduced motion and unsafe-export fallback");

  // Missing artwork must preserve the original icon, text and action, without a broken image.
  await navigate("index.html");
  await evaluate(`const realFetch=window.fetch;window.fetch=(url,...args)=>String(url).includes('/illustrations/storyset/search.svg')?Promise.resolve(new Response('',{status:404})):realFetch(url,...args);state.services=[];renderMarketplace('marketplace-grid',[])`);
  await wait(200);
  assert.equal(await evaluate('!!document.querySelector("skillmate-illustration[name=search][data-unavailable]")'), true);
  assert.equal(await evaluate('document.querySelector("skillmate-illustration[name=search]").textContent.trim()'), "⌕", "Existing search icon remains");
  assert.equal(await evaluate('document.querySelector("#marketplace-grid strong").textContent'), "No services found");
  await evaluate('document.querySelector("[data-clear-search]").click()');
  assert.ok(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length') > 0);
  console.log("PASS reduced motion, offscreen pause, animation cap, caching, missing-asset fallback");
};
