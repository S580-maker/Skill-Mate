const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const project = path.join(__dirname, "..");
const deletionSource = fs.readFileSync(path.join(project, "api/_lib/account-delete.js"), "utf8");

function deletionFixture({ key = "test-server-key", role = "student", failAt, missingServiceBucket = false } = {}) {
  const calls = [];
  const context = vm.createContext({
    module: { exports: {} },
    process: { env: { SUPABASE_URL: "https://test.invalid", SUPABASE_SERVICE_ROLE_KEY: key } },
    console: { error() {} },
    AbortSignal,
    require(name) {
      if (name === "node:crypto") return require(name);
      assert.equal(name, "./supabase");
      return { getSupabaseUser: async () => ({ id: "test-user" }), getUserRole: async () => role };
    },
    async fetch(url, options) {
      const pathname = new URL(url).pathname;
      calls.push({ pathname, method: options.method, body: JSON.parse(options.body || "null") });
      if (missingServiceBucket && pathname.endsWith("/object/list/service-covers")) {
        return new Response('{"message":"Bucket not found"}', { status: 400 });
      }
      if (pathname.includes(failAt || "never-fail")) return new Response("Failure", { status: 500 });
      return new Response(pathname.includes("/object/list/") ? "[]" : "{}", { status: 200 });
    },
  });
  vm.runInContext(deletionSource, context);
  const response = {
    statusCode: null, body: null,
    setHeader() {},
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
  return { calls, response, handle: context.module.exports.handleAccountDelete };
}

test("account closure disables sign-in before anonymization and file cleanup", async () => {
  const { handle, response, calls } = deletionFixture();
  await handle({ method: "POST", body: { confirmation: "DELETE" } }, response, "token");
  assert.equal(response.statusCode, 200);
  assert.equal(calls[0].pathname, "/auth/v1/admin/users/test-user");
  assert.equal(calls[0].body.ban_duration, "876000h");
  assert.equal(calls[1].pathname, "/rest/v1/rpc/anonymize_closed_account");
  assert.equal(calls.filter((call) => call.pathname.includes("/object/list/")).length, 4);
});

test("failed sign-in disable leaves profile and files untouched", async () => {
  const { handle, response, calls } = deletionFixture({ failAt: "/auth/v1/admin/" });
  await handle({ method: "POST", body: { confirmation: "DELETE" } }, response, "token");
  assert.equal(response.statusCode, 503);
  assert.equal(calls.length, 1);
});

test("account cleanup tolerates an unapplied service-cover migration", async () => {
  const { handle, response } = deletionFixture({ missingServiceBucket: true });
  await handle({ method: "POST", body: { confirmation: "DELETE" } }, response, "token");
  assert.equal(response.statusCode, 200);
});

test("anonymization failure occurs only after sign-in is disabled", async () => {
  const { handle, response, calls } = deletionFixture({ failAt: "/rpc/" });
  await handle({ method: "POST", body: { confirmation: "DELETE" } }, response, "token");
  assert.equal(response.statusCode, 503);
  assert.equal(calls.length, 2);
  assert.match(response.body.error, /Sign-in may already be disabled/);
});

test("missing server configuration cannot change the account", async () => {
  const { handle, response, calls } = deletionFixture({ key: "" });
  await handle({ method: "POST", body: { confirmation: "DELETE" } }, response, "token");
  assert.equal(response.statusCode, 503);
  assert.equal(calls.length, 0);
  assert.match(response.body.error, /No account changes were made/);
});

test("administrators cannot close their accounts", async () => {
  const { handle, response, calls } = deletionFixture({ role: "admin" });
  await handle({ method: "POST", body: { confirmation: "DELETE" } }, response, "token");
  assert.equal(response.statusCode, 403);
  assert.equal(calls.length, 0);
});

test("closure requires a session and explicit confirmation", async () => {
  for (const [body, token, status] of [[{}, "token", 400], [{ confirmation: "DELETE" }, "", 401]]) {
    const { handle, response, calls } = deletionFixture();
    await handle({ method: "POST", body }, response, token);
    assert.equal(response.statusCode, status);
    assert.equal(calls.length, 0);
  }
});

const userSource = fs.readFileSync(path.join(project, "user.js"), "utf8");
const profileHelper = userSource.slice(userSource.indexOf("const accountProfileColumns ="), userSource.indexOf("async function refreshSupabaseState()"));
function profileFixture(results) {
  const selections = [];
  const context = vm.createContext({ appSupabase: { from(table) {
    assert.equal(table, "profiles");
    return { select(columns) {
      selections.push(columns);
      return { eq(column, value) {
        assert.equal(column, "id"); assert.equal(value, "test-user");
        return { single: async () => results.shift() };
      } };
    } };
  } } });
  vm.runInContext(profileHelper, context);
  return { selections, read: () => vm.runInContext("loadAccountProfile('test-user')", context) };
}

test("legacy profile schema loads defaults and skips missing columns on later reads", async () => {
  const { read, selections } = profileFixture([
    { error: { code: "42703", message: "column profiles.phone_number does not exist" } },
    { data: { id: "test-user" }, error: null },
    { data: { id: "test-user" }, error: null },
  ]);
  const result = await read();
  assert.equal(result.data.phone_number, "");
  assert.equal(result.data.notify_messages, true);
  await read();
  assert.equal(selections.length, 3);
  assert(!selections[1].includes("phone_number"));
  assert(!selections[2].includes("phone_number"));
});

test("saved notification opt-outs survive loading", async () => {
  const { read } = profileFixture([{ data: { id: "test-user", notify_messages: false, phone_number: "123" }, error: null }]);
  const result = await read();
  assert.equal(result.data.notify_messages, false);
  assert.equal(result.data.phone_number, "123");
});

test("profile authorization errors are preserved", async () => {
  const { read, selections } = profileFixture([{ error: { code: "42501", message: "permission denied" } }]);
  assert.equal((await read()).error.code, "42501");
  assert.equal(selections.length, 1);
});

function profileSaveFixture({ campus = "Original campus", settingsReady = false, rpcReady = false } = {}) {
  const elements = {
    "#settings-full-name": { value: "Updated name" },
    "#settings-university": { value: campus },
    "#settings-bio": { value: "Updated bio" },
    "#settings-phone": { value: "" },
    "#settings-avatar-file": { files: [] },
    "#account-profile-feedback": {},
    "#profile-name": {}, "#profile-bio": {},
  };
  const writes = [];
  let submit;
  let pending;
  const state = { profile: { university: "Original campus", verified: true } };
  const context = vm.createContext({
    state, accountSettingsColumnsAvailable: settingsReady,
    appUser: { id: "test-user" },
    document: { querySelector(selector) {
      if (selector === "#account-profile-form") return { addEventListener(_event, handler) { submit = handler; } };
      assert(elements[selector], selector); return elements[selector];
    } },
    appSupabase: {
      async rpc(name, args) {
        assert.equal(name, "save_account_profile");
        if (!rpcReady) return { error: { code: "PGRST202" } };
        writes.push(args); return { error: null };
      },
      from(table) {
        assert.equal(table, "profiles");
        return { update(value) { writes.push(value); return { eq: async () => ({ error: null }) }; } };
      },
    },
    runAction(action) { pending = action(); return pending; },
    setSettingsFeedback() {}, renderAll() {}, loadAccountSettings() {}, showToast() {},
    loadAccountProfile: async () => ({ data: { campus_verified: false }, error: null }),
  });
  const marker = 'document.querySelector("#account-profile-form").addEventListener';
  const end = 'document.querySelector("#password-change-form").addEventListener';
  vm.runInContext(userSource.slice(userSource.indexOf(marker), userSource.indexOf(end)), context);
  return { state, writes, async save() {
    submit({ preventDefault() {}, currentTarget: { querySelector() { return {}; } } });
    await pending;
  } };
}

test("basic profile edits save on the legacy schema without writing missing settings columns", async () => {
  const { save, writes, state } = profileSaveFixture();
  await save();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].full_name, "Updated name");
  assert(!Object.hasOwn(writes[0], "phone_number"));
  assert(!Object.hasOwn(writes[0], "university"));
  assert.equal(state.profile.name, "Updated name");
});

test("campus changes cannot bypass identity synchronization when the RPC is missing", async () => {
  const { save, writes, state } = profileSaveFixture({ campus: "New campus" });
  await assert.rejects(save, (error) => error.userMessage.includes("Campus changes are unavailable"));
  assert.equal(writes.length, 0);
  assert.equal(state.profile.university, "Original campus");
});

test("campus edits use the profile RPC and refresh verification state", async () => {
  const { save, writes, state } = profileSaveFixture({ campus: "New campus", settingsReady: true, rpcReady: true });
  await save();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].p_university, "New campus");
  assert.equal(state.profile.verified, false);
  assert.equal(state.profile.university, "New campus");
});
