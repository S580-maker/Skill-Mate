const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/_lib/routes/system-health-snapshot");

const originalFetch = global.fetch;
const envKeys = ["CRON_SECRET", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const originalEnvironment = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function responseStub() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(status) { this.statusCode = status; return this; },
    json(body) { this.body = body; return this; },
  };
}

function configureEnvironment() {
  Object.assign(process.env, {
    CRON_SECRET: "health-cron-test-secret",
    SUPABASE_URL: "https://health-test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

test("system telemetry collector rejects untrusted requests before probing Supabase", async () => {
  configureEnvironment();
  global.fetch = () => assert.fail("Unauthorized requests cannot probe or write system metrics");
  const response = responseStub();
  await handler({ method: "POST", headers: { authorization: "Bearer wrong" } }, response);
  assert.equal(response.statusCode, 401);
});

test("system telemetry collector records timed service health probes through the service role", async () => {
  configureEnvironment();
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/v1/health")) return { ok: true };
    if (url.endsWith("/rest/v1/profiles?select=id&limit=0")) return { ok: true };
    if (url.endsWith("/rpc/capture_system_health_snapshot")) {
      assert.equal(options.headers.authorization, "Bearer test-service-role");
      const body = JSON.parse(options.body);
      assert.equal(body.p_auth_ok, true);
      assert.equal(body.p_database_ok, true);
      assert.ok(Number.isInteger(body.p_auth_probe_ms));
      assert.ok(Number.isInteger(body.p_database_probe_ms));
      return { ok: true, json: async () => "2026-11-04T09:00:00.000Z" };
    }
    assert.fail(`Unexpected request: ${url}`);
  };
  const response = responseStub();
  await handler({ method: "POST", headers: { authorization: "Bearer health-cron-test-secret" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.sampledAt, "2026-11-04T09:00:00.000Z");
  assert.equal(response.body.services.auth.status, "ok");
  assert.equal(response.body.services.database.status, "ok");
  assert.equal(calls.length, 3);
});
