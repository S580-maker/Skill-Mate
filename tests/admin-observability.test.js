const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/_lib/routes/admin-observability");

const originalFetch = global.fetch;
const envKeys = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_LIMIT_BYTES",
  "SUPABASE_STORAGE_LIMIT_BYTES",
];
const originalEnvironment = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const userId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";

function responseStub() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(status) { this.statusCode = status; return this; },
    json(body) { this.body = body; return this; },
  };
}

function accessToken() {
  const payload = Buffer.from(JSON.stringify({ session_id: sessionId, exp: Math.floor(Date.now() / 1000) + 3600 }))
    .toString("base64url");
  return `header.${payload}.signature`;
}

function configureEnvironment() {
  Object.assign(process.env, {
    SUPABASE_URL: "https://observability-test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    SUPABASE_DB_LIMIT_BYTES: "1000000000",
    SUPABASE_STORAGE_LIMIT_BYTES: "2000000000",
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

test("observability endpoint rejects users without an OTP-verified admin session", async () => {
  configureEnvironment();
  let queriedSnapshot = false;
  global.fetch = async (url) => {
    if (url.endsWith("/auth/v1/user")) return { ok: true, json: async () => ({ id: userId }) };
    if (url.includes("/verified_auth_sessions?")) return { ok: true, json: async () => [] };
    if (url.endsWith("/rpc/read_system_health_snapshots")) queriedSnapshot = true;
    return { ok: true, json: async () => [] };
  };
  const response = responseStub();
  await handler({ method: "GET", headers: { cookie: `skillflex_session=${accessToken()}` } }, response);
  assert.equal(response.statusCode, 403);
  assert.equal(queriedSnapshot, false);
  assert.equal(response.headers["cache-control"], "private, no-store");
});

test("observability endpoint returns sampled telemetry and explicitly configured quota limits to admins", async () => {
  configureEnvironment();
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/v1/user")) return { ok: true, json: async () => ({ id: userId }) };
    if (url.includes("/verified_auth_sessions?")) return { ok: true, json: async () => [{ session_id: sessionId }] };
    if (url.includes("/rest/v1/profiles?")) return { ok: true, json: async () => [{ role: "admin" }] };
    if (url.endsWith("/rpc/read_system_health_snapshots")) {
      assert.equal(options.headers.authorization, "Bearer test-service-role");
      assert.deepEqual(JSON.parse(options.body), { p_hours: 168 });
      return {
        ok: true,
        json: async () => [{
          sampled_at: new Date().toISOString(),
          database_bytes: 1200,
          storage_bytes: 2400,
          active_connections: 5,
          max_connections: 100,
          auth_ok: true,
          auth_probe_ms: 100,
          database_ok: true,
          database_probe_ms: 110,
        }],
      };
    }
    assert.fail(`Unexpected request: ${url}`);
  };
  const response = responseStub();
  await handler({ method: "GET", headers: { cookie: `skillflex_session=${accessToken()}` } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.limits.databaseBytes, 1_000_000_000);
  assert.equal(response.body.limits.storageBytes, 2_000_000_000);
  assert.equal(response.body.analysis.current.database_bytes, 1200);
  assert.equal(response.body.samples.length, 1);
  assert.equal(calls.length, 4);
});
