const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createRateLimit, createUpstashStore, runRateLimited } = require("../api/_lib/rate-limit");

const originalFetch = global.fetch;
const originalEnvironment = {
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  VERCEL: process.env.VERCEL,
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
  assert.ok(calls.every(call => call.body[3] === "skillflex:rate-limit:v1:auth:127.0.0.1"));
});

test("rate-limit factory accepts configured shared storage", () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  assert.equal(typeof createRateLimit({ limit: 1 }, "test"), "function");
});

function rateLimitResponse() {
  return Object.assign(new EventEmitter(), {
    statusCode: 200,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; this.writableEnded = true; this.emit("finish"); return this; },
  });
}

const rateLimitRequest = () => ({
  method: "POST", ip: "127.0.0.1", headers: {}, app: { get: () => false },
});

test("shared rate-limit storage failure rejects without executing the API handler", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  global.fetch = async () => { throw new Error("Redis unavailable"); };
  const limiter = createRateLimit({ limit: 1 }, "failure-regression");
  const response = rateLimitResponse();
  let calls = 0;
  await assert.rejects(runRateLimited(rateLimitRequest(), response, limiter, () => { calls++; }), /Redis unavailable/);
  assert.equal(calls, 0);
  assert.equal(response.listenerCount("finish"), 0);
  assert.equal(response.listenerCount("close"), 0);
});

test("rate-limit wrapper executes allowed handlers and preserves 429 responses", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  let hits = 0;
  global.fetch = async () => ({ ok: true, json: async () => ({ result: [++hits, 60_000] }) });
  const limiter = createRateLimit({ limit: 1 }, "limit-regression");
  let calls = 0;
  const allowed = rateLimitResponse();
  await runRateLimited(rateLimitRequest(), allowed, limiter, () => { calls++; });
  const blocked = rateLimitResponse();
  await runRateLimited(rateLimitRequest(), blocked, limiter, () => { calls++; });
  assert.equal(calls, 1);
  assert.equal(blocked.statusCode, 429);
  assert.match(blocked.body.error, /Too many requests/);
  for (const response of [allowed, blocked]) {
    assert.equal(response.listenerCount("finish"), 0);
    assert.equal(response.listenerCount("close"), 0);
  }
});

test("raw Vercel requests use platform client IPs and local requests ignore forwarded headers", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  const keys = [];
  global.fetch = async (_url, options) => {
    keys.push(JSON.parse(options.body)[3]);
    return { ok: true, json: async () => ({ result: [1, 60_000] }) };
  };
  const limiter = createRateLimit({ limit: 1 }, "client-ip-regression");
  process.env.VERCEL = "1";
  for (const ip of ["192.0.2.1", "192.0.2.2"]) {
    await runRateLimited({ headers: { "x-vercel-forwarded-for": ip, "x-forwarded-for": "192.0.2.99" } },
      rateLimitResponse(), limiter, () => {});
  }
  delete process.env.VERCEL;
  await runRateLimited({ headers: { "x-forwarded-for": "192.0.2.99" }, socket: { remoteAddress: "127.0.0.1" } },
    rateLimitResponse(), limiter, () => {});
  assert.deepEqual(keys, ["192.0.2.1", "192.0.2.2", "127.0.0.1"].map(ip => `skillflex:rate-limit:v1:client-ip-regression:${ip}`));
});
