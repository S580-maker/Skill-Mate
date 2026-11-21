// Real auth forms and request transport, stalled local fixtures. The deadline
// clock is accelerated so failure recovery is tested without 15-second sleeps.
const assert = require("node:assert/strict");
const { start } = require("./support/loading-harness.cjs");

(async () => {
  const h = await start();
  try {
    await h.call("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.__authRequests = [];
      window.__authDeadlines = [];
      const timeout = AbortSignal.timeout.bind(AbortSignal);
      AbortSignal.timeout = ms => { window.__authDeadlines.push(ms); return timeout(50); };
      const transport = window.fetch.bind(window);
      window.fetch = (url, options = {}) => {
        if (!String(url).startsWith('/api/auth/')) return transport(url, options);
        window.__authRequests.push(String(url));
        return new Promise((_resolve, reject) => {
          if (options.signal?.aborted) reject(options.signal.reason);
          else options.signal?.addEventListener('abort', () => reject(options.signal.reason), { once: true });
        });
      };
    ` });
    await h.open("login.html?signedout");
    await h.waitFor('document.querySelector("#auth-submit") && !document.querySelector("#auth-submit").disabled');
    await h.evaluate(`document.querySelector('#auth-email').value='student@example.test';document.querySelector('#auth-password').value='fixture-password';document.querySelector('#auth-form').requestSubmit()`);
    await h.waitFor('document.querySelector("#auth-message").textContent.includes("took too long")');
    assert.equal(await h.evaluate('document.querySelector("#auth-submit").disabled'), false);
    assert.equal(await h.evaluate('document.querySelector("#auth-password").value'), "fixture-password");
    assert.deepEqual(await h.evaluate('window.__authRequests'), ["/api/auth/sign-in"]);
    assert.deepEqual(await h.evaluate('window.__authDeadlines'), [15000]);
    console.log("PASS sign-in timeout settles, restores submit, preserves inputs, and sends once");

    await h.open("forgot-password.html");
    await h.evaluate(`document.querySelector('#recovery-email').value='student@example.test';document.querySelector('#forgot-password-form').requestSubmit()`);
    await h.waitFor('document.querySelector("#recovery-message").textContent.includes("took too long")');
    assert.equal(await h.evaluate('document.querySelector("#recovery-submit").disabled'), false);
    assert.equal(await h.evaluate('document.querySelector("#recovery-email").value'), "student@example.test");
    assert.deepEqual(await h.evaluate('window.__authRequests'), ["/api/auth/password-recovery"]);
    assert.deepEqual(await h.evaluate('window.__authDeadlines'), [15000]);
    assert.deepEqual(h.pageErrors, []);
    console.log("PASS password recovery timeout restores form without duplicate email requests");
  } finally { await h.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
