const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

function fixture(transport) {
  let sdkOptions;
  const deadlines = [];
  const context = {
    URL, Request, console, fetch: transport,
    AbortSignal: {
      any: AbortSignal.any.bind(AbortSignal),
      timeout(ms) { deadlines.push(ms); return AbortSignal.timeout(10); },
    },
    SKILLMATE_SUPABASE_CONFIG: { url: "https://network-fixture.supabase.invalid", anonKey: "fixture-public" },
    supabase: { createClient(_url, _key, options) {
      sdkOptions = options;
      return { auth: { onAuthStateChange() {} } };
    } },
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ["api-client.js", "auth-utils.js", "supabase-client.js"]) vm.runInContext(read(file), context);
  return { context, deadlines, sdkFetch: sdkOptions.global.fetch };
}

test("Supabase uses bounded transport for database writes and allows longer uploads", async () => {
  const calls = [];
  const { sdkFetch, deadlines } = fixture(async (input, options) => {
    calls.push({ input, options });
    return new Response("{}");
  });
  const insert = { method: "POST", body: '{"id":"fixture"}', headers: { authorization: "Bearer fixture" } };
  await sdkFetch("https://network-fixture.supabase.invalid/rest/v1/bookings", insert);
  await sdkFetch(new URL("https://network-fixture.supabase.invalid/storage/v1/object/profile-avatars/fixture/photo.webp"), { method: "PUT", body: "fixture" });
  assert.deepEqual(deadlines, [15000, 60000]);
  assert.equal(calls[0].options.body, insert.body);
  assert.equal(calls[0].options.headers, insert.headers);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.options.signal instanceof AbortSignal));
});

test("Supabase aborts stalled writes and preserves caller cancellation without retrying", async () => {
  let calls = 0;
  const { sdkFetch } = fixture((_input, { signal }) => {
    calls++;
    return new Promise((_resolve, reject) => {
      if (signal.aborted) reject(signal.reason);
      else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  });
  const timer = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(sdkFetch("https://network-fixture.supabase.invalid/rest/v1/bookings", { method: "POST", body: "{}" }), { name: "TimeoutError" });
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(sdkFetch("https://network-fixture.supabase.invalid/rest/v1/profiles", { signal: controller.signal }), { name: "AbortError" });
    assert.equal(calls, 2);
  } finally { clearTimeout(timer); }
});

test("auth timeouts use actionable feedback and preserve HTTP failures for callers", async () => {
  const timer = setTimeout(() => {}, 1000);
  try {
    let calls = 0;
    const { context } = fixture((_url, { signal }) => {
      calls++;
      return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
    });
    await assert.rejects(context.skillmateAuthUtils.requestAuth("/api/auth/sign-in", { method: "POST" }), /took too long.*try again/);
    assert.equal(calls, 1);
    const errorResponse = new Response('{"error":"Too many requests"}', { status: 429 });
    const failed = fixture(async () => errorResponse);
    assert.equal(await failed.context.skillmateAuthUtils.requestAuth("/api/auth/sign-in", { method: "POST" }), errorResponse);
  } finally { clearTimeout(timer); }
});
