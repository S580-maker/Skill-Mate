const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const { createRateLimit, createUpstashStore } = require("../api/_lib/rate-limit");

const originalFetch = global.fetch;
const originalEnvironment = {
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
};

afterEach(() => {
  global.fetch = originalFetch;
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

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
  assert.ok(calls.every(call => call.body[3] === "skillmate:rate-limit:v1:auth:127.0.0.1"));
});

test("rate-limit factory accepts configured shared storage", () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  assert.equal(typeof createRateLimit({ limit: 1 }, "test"), "function");
});
