const { rateLimit } = require("express-rate-limit");

function createUpstashStore(prefix) {
  const rawUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!rawUrl && !token) return undefined;
  if (!rawUrl || !token) throw new Error("Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable shared rate limits.");
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("UPSTASH_REDIS_REST_URL must use HTTPS.");
  let windowMs = 0;
  const script = "local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; return {count,redis.call('PTTL',KEYS[1])}";
  const decrementScript = "local count=redis.call('DECR',KEYS[1]); if count<0 then redis.call('DEL',KEYS[1]); return 0; end; return count";
  return {
    localKeys: false,
    init(options) { windowMs = options.windowMs; },
    async command(command, key, ttl = windowMs) {
      const response = await fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(["EVAL", command, "1", `skillmate:rate-limit:v1:${prefix}:${key}`, String(ttl)]),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error(`Shared rate-limit store returned HTTP ${response.status}.`);
      const result = await response.json();
      if (result.error) throw new Error(`Shared rate-limit store error: ${result.error}`);
      return result.result;
    },
    async increment(key) {
      const [totalHits, ttl] = await this.command(script, key);
      return { totalHits: Number(totalHits), resetTime: new Date(Date.now() + Math.max(0, Number(ttl))) };
    },
    async decrement(key) {
      await this.command(decrementScript, key);
    },
    async resetKey(key) {
      await this.command("return redis.call('DEL',KEYS[1])", key);
    },
  };
}

const commonOptions = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
};

function createRateLimit(options, prefix) {
  const store = createUpstashStore(prefix);
  return rateLimit({
    ...commonOptions,
    ...options,
    ...(store ? { store } : {}),
  });
}

const apiRateLimit = createRateLimit({ limit: 300 }, "api");
const authRateLimit = createRateLimit({ limit: 60 }, "auth");
const adminRateLimit = createRateLimit({ limit: 60 }, "admin");

function runRateLimited(request, response, limiter, handler) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let handlerStarted = false;
    const hasResponseEvents = typeof response.once === "function"
      && typeof response.removeListener === "function";
    const cleanup = () => {
      if (hasResponseEvents) {
        response.removeListener("finish", onFinish);
        response.removeListener("close", onClose);
      }
    };
    const settle = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onFinish = () => settle();
    const onClose = () => {
      if (!handlerStarted) settle();
    };
    if (hasResponseEvents) {
      response.once("finish", onFinish);
      response.once("close", onClose);
    }
    try {
      limiter(request, response, () => {
        handlerStarted = true;
        Promise.resolve().then(handler).then(() => settle(), settle);
      });
    } catch (error) {
      settle(error);
    }
  });
}

module.exports = { apiRateLimit, authRateLimit, adminRateLimit, createRateLimit, createUpstashStore, runRateLimited };
