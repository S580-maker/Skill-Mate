const { test, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const dotenv = require("dotenv");

// Load the real Express app without reading workstation secrets or contacting
// a real project. Only loopback HTTP and the explicit upstream fixture are used.
const originalConfig = dotenv.config;
dotenv.config = () => ({ parsed: {} });
process.env.SUPABASE_URL = "https://auth-boundary.supabase.invalid";
process.env.SUPABASE_ANON_KEY = "fixture-public";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service";
process.env.NODE_ENV = "test";
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
const { app } = require("../server");
dotenv.config = originalConfig;

const realFetch = global.fetch;
const server = app.listen(0, "127.0.0.1");
const ready = new Promise(resolve => server.once("listening", resolve));
afterEach(() => { global.fetch = realFetch; });
after(async () => { await new Promise(resolve => server.close(resolve)); });
const userId = "11111111-1111-4111-8111-111111111111";
const token = `fixture.${Buffer.from(JSON.stringify({ session_id: userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;

async function request(path, options = {}) {
  await ready;
  return realFetch(`http://127.0.0.1:${server.address().port}${path}`, options);
}

test("Express rejects adversarial auth fields and continues serving requests", async () => {
  global.fetch = async () => { throw new Error("Invalid inputs must not contact Supabase"); };
  for (const endpoint of ["sign-in", "sign-up"]) {
    const result = await request(`/api/auth/${endpoint}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: { toString: null }, password: "fixture-password" }),
    });
    assert.equal(result.status, 400);
    assert.equal(typeof (await result.json()).error, "string");
  }
  assert.equal((await request("/landing.html")).status, 200);
});

test("Express serves public assets but keeps tooling, builds and source documentation private", async () => {
  for (const file of ['/docs/JOURNEY-IMPROVEMENTS-2026-11-11.md', '/tests/booking-policy.test.js', '/scripts/build.cjs', '/dist/api/_lib/admin.html', '/dist/server.js', '/package.json', '/server.js', '/content-security-policy.json', '/assets/..%2fserver.js', '/assets/%2e%2e%2fapi/_lib/supabase.js', '/assets/%2e%2e%5cserver.js']) {
    assert.equal((await request(file)).status, 404, file);
  }
  assert.equal((await request('/assets/vendor/supabase-js-2.119.0.js')).status, 200);
  assert.equal((await request('/user.js')).status, 200);
});

test("Express renews the same verified OTP session before issuing a cookie", async () => {
  const upstream = [];
  global.fetch = async (input, options = {}) => {
    const url = new URL(input);
    assert.equal(url.hostname, "auth-boundary.supabase.invalid");
    upstream.push({ url, options });
    const body = url.pathname === "/auth/v1/user" ? { id: userId } : [{ session_id: userId }];
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  };
  const result = await request("/api/session", { method: "POST", headers: { authorization: `Bearer ${token}` } });
  assert.equal(result.status, 204);
  const renewal = upstream.find(call => call.options.method === "PATCH");
  assert.ok(renewal, "session refresh must renew OTP proof on Express as on Vercel");
  assert.equal(renewal.url.searchParams.get("user_id"), `eq.${userId}`);
  assert.equal(renewal.url.searchParams.get("session_id"), `eq.${userId}`);
  assert.match(result.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
  assert.doesNotMatch(result.headers.get("set-cookie"), /Secure/);
  assert.equal(result.headers.get("cache-control"), "private, no-store");
});

test("Express clears stale cookies when a session is no longer valid", async () => {
  global.fetch = async () => new Response("{}", { status: 401 });
  const result = await request("/api/session", { method: "POST", headers: { authorization: `Bearer ${token}` } });
  assert.equal(result.status, 401);
  assert.match(result.headers.get("set-cookie"), /Max-Age=0/);
});

test("Express denies a session cookie if OTP renewal loses its verification row", async () => {
  global.fetch = async (input, options = {}) => {
    const body = new URL(input).pathname === "/auth/v1/user" ? { id: userId }
      : options.method === "PATCH" ? [] : [{ session_id: userId }];
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  };
  const result = await request("/api/session", { method: "POST", headers: { authorization: `Bearer ${token}` } });
  assert.equal(result.status, 403);
  assert.equal((await result.json()).code, "OTP_VERIFICATION_REQUIRED");
  assert.match(result.headers.get("set-cookie"), /Max-Age=0/);
});

test("malformed and oversized JSON return client errors without logging credential bodies", async () => {
  const originalError = console.error;
  const logs = [];
  console.error = (...values) => { logs.push(values); };
  try {
    const malformed = await request("/api/auth/sign-in", {
      method: "POST", headers: { "content-type": "application/json" },
      body: '{"password":"DUMMY-CREDENTIAL-MARKER",',
    });
    assert.equal(malformed.status, 400);
    assert.match((await malformed.json()).error, /valid JSON/i);
    const oversized = await request("/api/auth/sign-in", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "DUMMY-CREDENTIAL-MARKER", extra: "x".repeat(17000) }),
    });
    assert.equal(oversized.status, 413);
    assert.match((await oversized.json()).error, /too large/i);
    assert.doesNotMatch(JSON.stringify(logs), /DUMMY-CREDENTIAL-MARKER/);
    assert.ok(logs.every(([, details]) => !details.error?.body));
  } finally {
    console.error = originalError;
  }
});
