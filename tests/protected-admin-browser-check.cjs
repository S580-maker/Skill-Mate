// Exercise the protected document and real SDK under Express CSP. All Supabase
// authentication and data responses are fixtures; no live database is contacted.
const assert = require("node:assert/strict");
const { start } = require("./support/loading-harness.cjs");

process.env.SUPABASE_URL = "https://review.supabase.invalid";
process.env.SUPABASE_ANON_KEY = "fixture-public";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service";
const user = { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.test" };
const profile = { ...user, full_name: "Review Admin", role: "admin" };
const expires = Math.floor(Date.now() / 1000) + 3600;
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, session_id: user.id, exp: expires })}.fixture`;
const realFetch = global.fetch;
global.fetch = async (input, options) => {
  const url = new URL(String(input));
  if (url.hostname !== "review.supabase.invalid") return realFetch(input, options);
  const body = url.pathname === "/auth/v1/user" ? user
    : url.pathname.includes("verified_auth_sessions") ? [{ session_id: user.id }]
      : url.pathname.includes("profiles") ? [profile] : [];
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
};
const { app } = require("../server");

(async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  let harness;
  try {
    harness = await start();
    const base = `http://127.0.0.1:${server.address().port}`;
    const session = { access_token: token, refresh_token: "fixture-refresh", expires_at: expires, expires_in: 3600, token_type: "bearer", user };
    await harness.call("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.__csp = [];
      document.addEventListener("securitypolicyviolation", event => window.__csp.push(event.blockedURI));
      localStorage.setItem("sb-review-auth-token", ${JSON.stringify(JSON.stringify(session))});
      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, options) => {
        const url = new URL(typeof input === "string" ? input : input.url, location.href);
        if (url.hostname !== "review.supabase.invalid") return realFetch(input, options);
        const headers = new Headers(options?.headers || input.headers);
        const single = headers.get("accept")?.includes("vnd.pgrst.object");
        const body = url.pathname === "/auth/v1/user" ? ${JSON.stringify(user)}
          : url.pathname.includes("/profiles") ? (single ? ${JSON.stringify(profile)} : [${JSON.stringify(profile)}]) : [];
        return new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "content-range": "0-0/1" } });
      };
    ` });
    await harness.call("Network.setCookie", { name: "skillmate_session", value: token, url: base });
    await harness.call("Page.navigate", { url: `${base}/admin.html` });
    await harness.waitFor('document.body.classList.contains("admin-ready")', 15000);
    assert.equal(await harness.evaluate('typeof window.supabase?.createClient'), "function");
    assert.equal(await harness.evaluate('Boolean(window.skillmateSupabase)'), true);
    assert.deepEqual(await harness.evaluate('window.__csp'), []);
    assert.deepEqual(harness.pageErrors, []);
    console.log("PASS protected admin initializes the real local SDK and dashboard under CSP");
  } catch (error) {
    if (harness) console.error(await harness.evaluate('({url:location.href,status:document.querySelector("#admin-auth-status")?.textContent,errors:window.__csp})'));
    throw error;
  } finally {
    if (harness) await harness.close();
    await new Promise(resolve => server.close(resolve));
    global.fetch = realFetch;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
