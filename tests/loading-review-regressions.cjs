// Real app markup and scripts, isolated Supabase transport. No live authentication or writes.
const assert = require("node:assert/strict");
const { start } = require("./support/loading-harness.cjs");

(async () => {
  const h = await start();
  const run = script => h.evaluate(`(async () => { ${script} })()`);
  const ready = () => h.waitFor('!document.body.classList.contains("app-auth-pending")', 20000);
  try {
    for (const width of [320, 375, 768, 1280, 1920]) {
      await h.viewport(width);
      for (const [query, expected] of [["delay=20", "cards"], ["empty=1", "empty"], ["fail=saved_services", "error"]]) {
        await h.open(`index.html?${query}#saved`);
        await ready();
        assert.equal(await h.evaluate('document.querySelectorAll("#saved-grid .sk").length'), 0);
        assert.equal(await h.evaluate('document.querySelector("#saved-grid").hasAttribute("aria-busy")'), false);
        assert.ok(await h.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
        if (expected === "cards") assert.equal(await h.evaluate('document.querySelectorAll("#saved-grid .provider-card").length'), 2);
        if (expected === "empty") assert.ok(await h.evaluate('Boolean(document.querySelector("#saved-grid .empty-card"))'));
        if (expected === "error") assert.ok(await h.evaluate('Boolean(document.querySelector("#saved-grid [data-loading-retry]"))'));
      }
    }
    console.log("PASS direct Saved route resolves success, empty and failure at all five widths");

    // A hung retry releases the shared promise; the late obsolete response cannot change recovered state.
    await h.open('index.html?fail=provider_directory#home'); await ready();
    await run(`window.__from = appSupabase.from; window.__timeout = window.skillflexLoading.withTimeout;
      window.__fake.failing.clear();
      window.skillflexLoading.withTimeout = (request, ms) => window.__timeout(request, Math.min(ms, 80));
      appSupabase.from = table => {
        if (table !== "provider_directory") return window.__from(table);
        const builder = new Proxy({}, { get(_, key) {
          if (key === "then") return (resolve, reject) => new Promise(done => { window.__lateDirectory = done; }).then(resolve, reject);
          return () => builder;
        }}); return builder;
      }; await retryDashboardData();`);
    assert.ok(await h.evaluate('Boolean(dashboardLoadError) && dashboardRefreshPromise === null'));
    assert.equal(await h.evaluate('document.querySelectorAll("[aria-busy=true]").length'), 0);
    await run('appSupabase.from=window.__from;window.skillflexLoading.withTimeout=window.__timeout;await retryDashboardData()');
    const recovered = await h.evaluate('connectedProviders.length');
    assert.ok(recovered > 0);
    await run('window.__lateDirectory({data:[],error:null})'); await h.wait(50);
    assert.equal(await h.evaluate('connectedProviders.length'), recovered);
    assert.equal(await h.evaluate('dashboardLoadError'), null);
    console.log("PASS hung dashboard retry releases its lock and ignores late data after recovery");

    await h.open('index.html?fail=campus_request_directory#requests'); await ready();
    await h.waitFor('Boolean(document.querySelector("#request-board-grid [data-loading-retry]"))');
    await run('document.querySelector("#request-board-grid [data-loading-retry]").focus();window.__fake.failing.clear();document.activeElement.click()');
    await h.waitFor('document.activeElement.id === "request-board-grid"');
    await run('window.__fake.failing.add("campus_request_directory");await window.skillflexGrowth.refreshBoard()');
    await run('window.__fake.failing.clear();window.__fake.delay=100;document.querySelector("#request-board-grid [data-loading-retry]").focus();document.activeElement.click();document.querySelector("#request-board-filter").focus()');
    await h.waitFor('!document.querySelector("#request-board-refresh").disabled');
    assert.equal(await h.evaluate('document.activeElement.id'), "request-board-filter");
    console.log("PASS request-board retry restores keyboard focus without stealing moved focus");

    await h.open('index.html#home'); await ready();
    await run(`window.__first=connectedProviders[0];window.__second=connectedProviders[1];
      window.__first.id="11111111-1111-1111-1111-111111111111";
      window.__first.cvPath=window.__first.id+"/22222222-2222-2222-2222-222222222222.pdf";
      appSupabase.storage.from=()=>({createSignedUrl:()=>new Promise(done=>window.__cv=done)});
      await openProviderProfile(window.__first.id); window.__identity=document.querySelector(".showcase-identity");`);
    assert.equal(await h.evaluate('document.querySelector("#provider-detail-book").disabled'), false);
    assert.equal(await h.evaluate('document.querySelector("#provider-detail-message").disabled'), false);
    assert.equal(await h.evaluate('document.querySelector("[data-provider-cv]").getAttribute("aria-busy")'), "true");
    await run('window.__cv({data:{signedUrl:"https://example.test/cv.pdf"},error:null})');
    await h.waitFor('Boolean(document.querySelector(".showcase-cv-link"))');
    assert.ok(await h.evaluate('window.__identity===document.querySelector(".showcase-identity")'));
    await run('await openProviderProfile(window.__first.id);window.__oldCV=window.__cv;await openProviderProfile(window.__second.id);window.__oldCV({data:{signedUrl:"https://example.test/old.pdf"},error:null})');
    await h.wait(30);
    assert.equal(await h.evaluate('document.querySelector(".showcase-identity h2").textContent'), await h.evaluate('window.__second.name'));
    assert.equal(await h.evaluate('document.querySelector(".showcase-cv-link")'), null);
    await run('window.__timeout=window.skillflexLoading.withTimeout;window.skillflexLoading.withTimeout=request=>window.__timeout(request,40);await openProviderProfile(window.__first.id)');
    await h.waitFor('document.querySelector("[data-provider-cv]").textContent.includes("Retry CV")');
    assert.equal(await h.evaluate('document.querySelector("#provider-detail-book").disabled'), false);
    await run('window.skillflexLoading.withTimeout=window.__timeout;document.querySelector("[data-provider-cv] button").focus();document.activeElement.click();window.__cv({data:{signedUrl:"https://example.test/retry.pdf"},error:null})');
    await h.waitFor('document.activeElement.classList.contains("showcase-cv-link")');
    await run('await openProviderProfile(window.__first.id);document.querySelector("#provider-detail-modal").close()'); await h.wait(30);
    assert.equal(await h.evaluate('document.querySelector("[data-provider-cv]").hasAttribute("aria-busy")'), false);
    await run('window.__cv({data:null,error:null})');
    console.log("PASS optional CV loads independently, retries with focus, and ignores stale or closed profiles");

    await h.open('admin.html?admin=1'); await h.waitFor('document.body.classList.contains("admin-ready")', 20000);
    await run(`window.__queue=[];window.__from=adminClient.from;
      adminClient.from=table=>table==='support_tickets'?{select(){return this},in(){return this},order(){return this},limit(){return new Promise(done=>window.__queue.push(done))}}:window.__from(table);
      void fetchSupportTickets();void fetchSupportTickets();
      window.__ticket=message=>({data:[{id:message,user_id:'student',category:'Help',message,status:'open',created_at:new Date().toISOString()}],error:null});
      window.__queue[1](window.__ticket('new result'));`); await h.wait(30);
    await run('window.__queue[0](window.__ticket("old result"))'); await h.wait(30);
    assert.ok((await h.evaluate('document.querySelector("#support-ticket-rows").textContent')).includes('new result'));
    assert.ok(!(await h.evaluate('document.querySelector("#support-ticket-rows").textContent')).includes('old result'));
    console.log("PASS admin support queue ignores out-of-order responses");

    await run('window.__inlineExecuted=false;const script=document.createElement("script");script.textContent="window.__inlineExecuted=true";document.head.append(script)');
    assert.equal(await h.evaluate('window.__inlineExecuted'), false);
    assert.deepEqual(h.pageErrors, []);
    console.log("PASS CSP blocks inline scripts while app and Storyset code load without exceptions");
  } finally { await h.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
