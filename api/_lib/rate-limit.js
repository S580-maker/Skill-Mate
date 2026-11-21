const { createHash } = require("node:crypto");
const { isIP } = require("node:net");
const { rateLimit } = require("express-rate-limit");

function assertProductionRateLimitStore() {
  if (process.env.NODE_ENV === "production"
    && (!process.env.UPSTASH_REDIS_REST_URL?.trim() || !process.env.UPSTASH_REDIS_REST_TOKEN?.trim())) {
    throw new Error("Production requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN; refusing to start without shared rate-limit storage.");
  }
}

function rateLimitError(message, code, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function clientAddress(request) {
  if (process.env.VERCEL === "1") {
    const forwardedFor = request.headers?.["x-forwarded-for"];
    if (typeof forwardedFor === "string" && isIP(forwardedFor.trim())) return forwardedFor.trim();
  }
  const requestIp = request.ip;
  if (typeof requestIp === "string" && isIP(requestIp)) return requestIp;
  throw rateLimitError("The client IP could not be determined for rate limiting.", "RATE_LIMIT_CLIENT_IP_UNAVAILABLE");
}

function rateLimitKey(request) {
  return createHash("sha256").update(clientAddress(request)).digest("hex");
}

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
      try {
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
      } catch (cause) {
        const error = rateLimitError("The shared rate-limit store could not be reached.", "RATE_LIMIT_STORE_UNAVAILABLE", cause);
        throw error;
      }
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
  const limiter = rateLimit({
    ...commonOptions,
    ...options,
    keyGenerator: rateLimitKey,
    passOnStoreError: false,
    ...(store ? { store } : {}),
  });
  return (request, response, next) => limiter(request, response, error => {
    if (error?.code === "RATE_LIMIT_STORE_UNAVAILABLE" || error?.code === "RATE_LIMIT_CLIENT_IP_UNAVAILABLE") {
      console.error("Rate limiting failed; rejecting the request.", error);
      return response.status(503).json({ error: "Request protection is temporarily unavailable. Please try again shortly." });
    }
    return next(error);
  });
}

assertProductionRateLimitStore();

const apiRateLimit = createRateLimit({ limit: 300 }, "api");
const authRateLimit = createRateLimit({ limit: 60 }, "auth");
const adminRateLimit = createRateLimit({ limit: 60 }, "admin");
const endpointRateLimits = {
  "push-subscriptions": createRateLimit({ limit: 20 }, "push-subscriptions"),
  "payments/quote": createRateLimit({ limit: 30 }, "payments-quote"),
  "payments/initialize": createRateLimit({ limit: 10 }, "payments-initialize"),
  "payments/verify": createRateLimit({ limit: 30 }, "payments-verify"),
  "payouts": createRateLimit({ limit: 30 }, "payouts"),
  "paystack-transfer-webhook": createRateLimit({ limit: 120 }, "paystack-transfer-webhook"),
  "paystack-webhook": createRateLimit({ limit: 120 }, "paystack-webhook"),
  "auth/sign-in": createRateLimit({ limit: 10 }, "sign-in"),
  "auth/google-2fa": createRateLimit({ limit: 10 }, "google-2fa"),
  "auth/session-otp": createRateLimit({ limit: 10 }, "session-otp"),
  "auth/sign-up": createRateLimit({ limit: 5 }, "sign-up"),
  "auth/verify": createRateLimit({ limit: 15 }, "verify"),
  "auth/resend": createRateLimit({ limit: 5 }, "resend"),
  "auth/password-recovery": createRateLimit({ limit: 10 }, "password-recovery"),
  "session": createRateLimit({ limit: 20 }, "session"),
  "account-delete": createRateLimit({ limit: 5 }, "account-delete"),
  "booking-reminders": createRateLimit({ limit: 10 }, "booking-reminders"),
  "email-notifications": createRateLimit({ limit: 60 }, "email-notifications"),
  "admin-observability": createRateLimit({ limit: 60 }, "admin-observability"),
  "admin-moderation": createRateLimit({ limit: 10 }, "admin-moderation"),
  "system-health-snapshot": createRateLimit({ limit: 30 }, "system-health-snapshot"),
  "push-dispatch": createRateLimit({ limit: 60 }, "push-dispatch"),
  "push-config": createRateLimit({ limit: 60 }, "push-config"),
};

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
    const onLimit = error => {
      if (error) {
        settle(error);
        return;
      }
      handlerStarted = true;
      Promise.resolve().then(handler).then(() => settle(), settle);
    };
    if (hasResponseEvents) {
      response.once("finish", onFinish);
      response.once("close", onClose);
    }
    try {
      limiter(request, response, onLimit);
    } catch (error) {
      settle(error);
    }
  });
}

module.exports = {
  apiRateLimit, authRateLimit, adminRateLimit, endpointRateLimits,
  createRateLimit, createUpstashStore, assertProductionRateLimitStore, runRateLimited,
};
