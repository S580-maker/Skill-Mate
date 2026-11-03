const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/_lib/routes/booking-reminders");
const originalFetch = global.fetch;
const keys = ["CRON_SECRET", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const environment = Object.fromEntries(keys.map(key => [key, process.env[key]]));
afterEach(() => { global.fetch = originalFetch; for (const key of keys) { if (environment[key] === undefined) delete process.env[key]; else process.env[key] = environment[key]; } });
const response = () => ({ code: 0, body: null, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
test("reminder endpoint rejects untrusted requests before contacting the database", async () => {
  process.env.CRON_SECRET = "test-reminder-secret";
  global.fetch = () => assert.fail("Unauthorized requests cannot access the database");
  for (const authorization of [undefined, "Bearer wrong", "Bearer test-reminder-secret-extra"]) {
    const res = response(); await handler({ method: "GET", headers: { authorization } }, res); assert.equal(res.code, 401);
  }
});
test("scheduler uses its server-only credential and returns the number of new reminders", async () => {
  Object.assign(process.env, { CRON_SECRET: "test-secret", SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_ANON_KEY: "publishable-test", SUPABASE_SERVICE_ROLE_KEY: "server-only-test" });
  global.fetch = async (url, options) => {
    assert.equal(url, "https://fixture.supabase.co/rest/v1/rpc/generate_booking_reminders");
    assert.equal(options.headers.authorization, "Bearer server-only-test");
    return { ok: true, json: async () => 3 };
  };
  const res = response(); await handler({ method: "GET", headers: { authorization: "Bearer test-secret" } }, res);
  assert.equal(res.code, 200); assert.deepEqual(res.body, { created: 3 });
});
test("failed reminder generation returns a retryable response without leaking credentials", async () => {
  Object.assign(process.env, { CRON_SECRET: "test-secret", SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_ANON_KEY: "publishable-test", SUPABASE_SERVICE_ROLE_KEY: "server-only-test" });
  global.fetch = async () => ({ ok: false });
  const res = response(); await handler({ method: "POST", headers: { authorization: "Bearer test-secret" } }, res);
  assert.equal(res.code, 503); assert.doesNotMatch(JSON.stringify(res.body), /server-only-test/);
});
