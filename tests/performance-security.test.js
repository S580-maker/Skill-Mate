const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const {
  assertProductionRateLimitStore, createRateLimit, createUpstashStore, endpointRateLimits,
} = require("../api/_lib/rate-limit");

const originalFetch = global.fetch;
const originalEnvironment = {
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
};

afterEach(() => {
  global.fetch = originalFetch;
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

async function serve(app) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(resolve => {
      server.closeAllConnections();
      server.close(resolve);
    }),
  };
}

test("shared rate-limit storage uses memory unless both Upstash settings are provided", () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.equal(createUpstashStore("test"), undefined);
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
  assert.throws(() => createUpstashStore("test"), /Set both/);
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  assert.throws(() => {
    process.env.UPSTASH_REDIS_REST_URL = "http://redis.example.com";
    createUpstashStore("test");
  }, /must use HTTPS/);
});

test("Upstash store increments with TTL and supports decrement and reset", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    const result = calls.length === 1 ? [2, 45_000] : 1;
    return { ok: true, json: async () => ({ result }) };
  };
  const store = createUpstashStore("auth");
  store.init({ windowMs: 60_000 });
  const increment = await store.increment("127.0.0.1");
  assert.equal(increment.totalHits, 2);
  assert.ok(increment.resetTime.getTime() >= Date.now() + 44_000);
  await store.decrement("127.0.0.1");
  await store.resetKey("127.0.0.1");
  assert.equal(calls.length, 3);
  assert.ok(calls.every(call => new URL(call.url).origin === "https://redis.example.com"));
  assert.deepEqual(calls.map(call => call.body.slice(0, 3)), [
    ["EVAL", calls[0].body[1], "1"],
    ["EVAL", calls[1].body[1], "1"],
    ["EVAL", "return redis.call('DEL',KEYS[1])", "1"],
  ]);
  assert.ok(calls.every(call => call.body[3] === "skillflex:rate-limit:v1:auth:127.0.0.1"));
});

test("rate-limit factory accepts configured shared storage", () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  assert.equal(typeof createRateLimit({ limit: 1 }, "test"), "function");
});

test("production requires both shared rate-limit settings", () => {
  process.env.NODE_ENV = "production";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.throws(assertProductionRateLimitStore, /Production requires/);
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
  assert.throws(assertProductionRateLimitStore, /Production requires/);
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  assert.doesNotThrow(assertProductionRateLimitStore);
});

test("configured limiter returns 429 after the per-IP threshold", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const app = express();
  app.get("/", createRateLimit({ limit: 2 }, "integration-limit"), (_request, response) => response.sendStatus(200));
  const server = await serve(app);
  try {
    const responses = [];
    for (let count = 0; count < 3; count++) responses.push(await originalFetch(server.url));
    assert.deepEqual(responses.map(response => response.status), [200, 200, 429]);
    assert.ok(responses[0].headers.get("ratelimit"));
  } finally {
    await server.close();
  }
});

test("Vercel forwarded client IP is used when Express request.ip is unavailable", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.VERCEL = "1";
  const app = express();
  app.use((request, _response, next) => {
    Object.defineProperty(request, "ip", { configurable: true, value: undefined });
    next();
  });
  app.get("/", createRateLimit({ limit: 1 }, "vercel-ip"), (_request, response) => response.sendStatus(200));
  const server = await serve(app);
  try {
    const first = await originalFetch(server.url, { headers: { "x-forwarded-for": "203.0.113.1" } });
    const blocked = await originalFetch(server.url, { headers: { "x-forwarded-for": "203.0.113.1" } });
    const otherIp = await originalFetch(server.url, { headers: { "x-forwarded-for": "203.0.113.2" } });
    assert.deepEqual([first.status, blocked.status, otherIp.status], [200, 429, 200]);
    const originalError = console.error;
    console.error = () => {};
    try {
      const untrustedChain = await originalFetch(server.url, { headers: { "x-forwarded-for": "203.0.113.3, 203.0.113.4" } });
      assert.equal(untrustedChain.status, 503);
    } finally {
      console.error = originalError;
    }
  } finally {
    await server.close();
  }
});

test("shared-store failure rejects requests instead of bypassing protection", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  global.fetch = async () => ({ ok: false, status: 503 });
  const app = express();
  app.get("/", createRateLimit({ limit: 10 }, "store-failure"), (_request, response) => response.sendStatus(200));
  const server = await serve(app);
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await originalFetch(server.url);
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /protection is temporarily unavailable/);
  } finally {
    console.error = originalError;
    await server.close();
  }
});

test("sensitive routes have specific shared limiters in the serverless router", () => {
  for (const route of [
    "auth/sign-in", "auth/sign-up", "auth/verify", "auth/resend",
    "auth/password-recovery", "account-delete", "push-subscriptions",
    "booking-reminders", "email-notifications", "push-dispatch", "admin-moderation",
  ]) assert.equal(typeof endpointRateLimits[route], "function", `${route} has an endpoint limiter`);
  const apiSource = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "api", "index.js"), "utf8");
  assert.match(apiSource, /endpointRateLimits\[route\]/);
});

test("hot paths have scaling indexes and a combined unread count query", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "..", "supabase", "migrations", "20261121120000_hot_path_scaling.sql"),
    "utf8",
  );
  assert.match(migration, /notifications_user_unread_created_idx/);
  assert.match(migration, /messages_unread_idx/);
  assert.match(migration, /conversation_members_user_idx/);
  assert.match(migration, /bookings_customer_status_scheduled_idx/);
  assert.match(migration, /bookings_provider_status_scheduled_idx/);
  assert.match(migration, /create or replace function public\.skillmate_unread_counts/);
  assert.match(migration, /grant execute on function public\.skillmate_unread_counts\(\) to authenticated/);
});
