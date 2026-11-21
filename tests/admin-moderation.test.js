const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const handler = require("../api/_lib/routes/admin-moderation");

const originalFetch = global.fetch;
const envKeys = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const originalEnvironment = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const adminId = "11111111-1111-4111-8111-111111111111";
const targetId = "33333333-3333-4333-8333-333333333333";
const actionId = "44444444-4444-4444-8444-444444444444";
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

function token() {
  const payload = Buffer.from(JSON.stringify({ session_id: sessionId, exp: Math.floor(Date.now() / 1000) + 3600 }))
    .toString("base64url");
  return `header.${payload}.signature`;
}

function request(action = "warning") {
  return {
    method: "POST",
    headers: {
      cookie: `skillmate_session=${token()}`,
      origin: "http://localhost:3000",
      host: "localhost:3000",
    },
    body: {
      reportId: action === "restore" ? null : "55555555-5555-4555-8555-555555555555",
      action,
      reportedUserId: targetId,
      reason: "Confirmed policy violation after reviewing the report.",
      message: "Please review Skillmate's community guidelines and contact support if needed.",
    },
  };
}

function configureEnvironment() {
  Object.assign(process.env, {
    SUPABASE_URL: "https://moderation-test.supabase.co",
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

test("moderation endpoint rejects cross-origin requests before touching Supabase", async () => {
  configureEnvironment();
  let called = false;
  global.fetch = async () => { called = true; };
  const response = responseStub();
  await handler({ ...request(), headers: { ...request().headers, origin: "https://attacker.example" } }, response);
  assert.equal(response.statusCode, 403);
  assert.equal(called, false);
});

test("warnings require a same-origin OTP-verified administrator and record through the database RPC", async () => {
  configureEnvironment();
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/v1/user")) return { ok: true, json: async () => ({ id: adminId }) };
    if (url.includes("/verified_auth_sessions?")) return { ok: true, json: async () => [{ session_id: sessionId }] };
    if (url.includes("/rest/v1/profiles?")) return { ok: true, json: async () => [{ role: "admin" }] };
    if (url.endsWith("/rpc/issue_moderation_action")) {
      assert.deepEqual(JSON.parse(options.body), {
        p_report_id: "55555555-5555-4555-8555-555555555555",
        p_action: "warning",
        p_reported_user_id: targetId,
        p_reason: "Confirmed policy violation after reviewing the report.",
        p_message: "Please review Skillmate's community guidelines and contact support if needed.",
      });
      return { ok: true, json: async () => ({ id: actionId, reported_user_id: targetId }) };
    }
    assert.fail(`Unexpected moderation request: ${url}`);
  };
  const response = responseStub();
  await handler(request(), response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { actionId, authRestrictionApplied: null });
  assert.equal(calls.length, 4);
});

test("account suspensions apply Supabase Auth ban duration and update the audit status", async () => {
  configureEnvironment();
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/v1/user")) return { ok: true, json: async () => ({ id: adminId }) };
    if (url.includes("/verified_auth_sessions?")) return { ok: true, json: async () => [{ session_id: sessionId }] };
    if (url.includes("/rest/v1/profiles?")) return { ok: true, json: async () => [{ role: "admin" }] };
    if (url.endsWith("/rpc/issue_moderation_action")) {
      return { ok: true, json: async () => ({ id: actionId, reported_user_id: targetId }) };
    }
    if (url.endsWith(`/auth/v1/admin/users/${targetId}`)) {
      assert.equal(options.method, "PUT");
      assert.deepEqual(JSON.parse(options.body), { ban_duration: "168h" });
      return { ok: true, json: async () => ({}) };
    }
    if (url.includes(`/rest/v1/moderation_actions?id=eq.${actionId}`)) {
      assert.equal(options.method, "PATCH");
      assert.deepEqual(JSON.parse(options.body), { auth_ban_applied: true });
      return { ok: true, json: async () => ({}) };
    }
    assert.fail(`Unexpected moderation request: ${url}`);
  };
  const response = responseStub();
  await handler(request("suspension"), response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { actionId, authRestrictionApplied: true });
  assert.equal(calls.length, 6);
});

test("account restoration removes the Supabase Auth ban and records the recovery", async () => {
  configureEnvironment();
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/v1/user")) return { ok: true, json: async () => ({ id: adminId }) };
    if (url.includes("/verified_auth_sessions?")) return { ok: true, json: async () => [{ session_id: sessionId }] };
    if (url.includes("/rest/v1/profiles?")) return { ok: true, json: async () => [{ role: "admin" }] };
    if (url.endsWith("/rpc/issue_moderation_action")) {
      assert.deepEqual(JSON.parse(options.body), {
        p_report_id: null,
        p_action: "restore",
        p_reported_user_id: targetId,
        p_reason: "Confirmed policy violation after reviewing the report.",
        p_message: "Please review Skillmate's community guidelines and contact support if needed.",
      });
      return { ok: true, json: async () => ({ id: actionId, reported_user_id: targetId }) };
    }
    if (url.endsWith(`/auth/v1/admin/users/${targetId}`)) {
      assert.deepEqual(JSON.parse(options.body), { ban_duration: "none" });
      return { ok: true, json: async () => ({}) };
    }
    if (url.includes(`/rest/v1/moderation_actions?id=eq.${actionId}`)) {
      return { ok: true, json: async () => ({}) };
    }
    assert.fail(`Unexpected moderation request: ${url}`);
  };
  const response = responseStub();
  await handler(request("restore"), response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.authRestrictionApplied, true);
  assert.equal(calls.length, 6);
});

test("moderation UI, action auditing, account gates, and booking-count error handling are wired", () => {
  const root = path.join(__dirname, "..");
  const admin = fs.readFileSync(path.join(root, "admin-auth.js"), "utf8");
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261108180000_admin_moderation.sql"), "utf8");
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  assert.match(admin, /fetch\("\/api\/admin-moderation"/);
  assert.match(admin, /data-open-moderation/);
  assert.match(admin, /data-restore-user-id/);
  assert.match(admin, /completionNotice\.textContent/);
  assert.match(migration, /create table if not exists public\.moderation_actions/);
  assert.match(migration, /create or replace function public\.issue_moderation_action/);
  assert.match(migration, /public\.is_moderated_verified_session\(\)/);
  assert.match(migration, /moderation_status = 'suspended' and profile\.moderation_until <= now\(\)/);
  assert.match(migration, /insert into public\.notifications/);
  assert.match(html, /id="moderation-history"/);
  assert.match(html, /value="ban">Ban account/);
});
