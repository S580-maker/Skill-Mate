const assert = require("node:assert/strict");
const { start } = require("./support/loading-harness.cjs");

(async () => {
  const h = await start();
  const run = source => h.evaluate(`(()=>{${source}})()`);
  const enter = async () => {
    await h.call("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await h.call("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  };
  try {
    await h.viewport(1280); await h.open("index.html#home");
    await h.waitFor('!document.body.classList.contains("app-auth-pending")');
    await run('globalSearch.focus();showPage("home",{restoreScroll:0})');
    assert.equal(await h.evaluate('document.activeElement.id'), "global-search");
    await run('document.querySelector(".nav-link[data-page=saved]").focus()');
    await enter();
    assert.equal(await h.evaluate('document.activeElement.textContent'), "Saved providers");
    assert.equal(await h.evaluate('document.activeElement.tagName'), "H1");
    await h.viewport(375);
    await run('document.querySelector("#menu-toggle").click();document.querySelector(".nav-link[data-page=bookings]").focus()');
    await enter();
    assert.equal(await h.evaluate('document.activeElement.textContent'), "My bookings");
    assert.equal(await h.evaluate('document.querySelector("#sidebar").classList.contains("open")'), false);
    await run('document.querySelector("#menu-toggle").click();document.querySelector(".nav-link[data-page=messages]").focus()');
    await enter();
    assert.equal(await h.evaluate('document.activeElement.closest("[data-view]")?.dataset.view'), "messages");
    assert.ok(await h.evaluate('document.activeElement.getClientRects().length>0'));
    await run(`showPage('activity');activeBookingFilter='all';state.bookings.push({...state.bookings[0],id:'past-customer-booking',status:'Completed'});
      document.querySelector('#view-activity [data-activity-count=bookings]').closest('a').focus();`);
    await enter();
    assert.equal(await h.evaluate('activeBookingFilter'), "upcoming");
    assert.equal(await h.evaluate('Boolean(document.querySelector("[data-booking-card-id=past-customer-booking]"))'), false);
    assert.equal(await h.evaluate('document.querySelector("[data-booking-filter=upcoming]").classList.contains("active")'), true);
    assert.deepEqual(h.pageErrors, []);
    console.log("PASS keyboard navigation focuses visible destinations; background/history restores preserve focus");
    console.log("PASS Upcoming bookings activity link applies its visible filter to the actual list");
  } finally { await h.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
