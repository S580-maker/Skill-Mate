const { rateLimit } = require("express-rate-limit");

const commonOptions = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
};

const apiRateLimit = rateLimit({ ...commonOptions, limit: 300 });
const authRateLimit = rateLimit({ ...commonOptions, limit: 60 });
const adminRateLimit = rateLimit({ ...commonOptions, limit: 60 });

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

module.exports = { apiRateLimit, authRateLimit, adminRateLimit, runRateLimited };
