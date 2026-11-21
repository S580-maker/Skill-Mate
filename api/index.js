const routes = {
  "booking-reminders": require("./_lib/routes/booking-reminders"),
  "email-notifications": require("./_lib/routes/email-notifications"),
  "admin-observability": require("./_lib/routes/admin-observability"),
  "admin-moderation": require("./_lib/routes/admin-moderation"),
  "system-health-snapshot": require("./_lib/routes/system-health-snapshot"),
  "account-delete": require("./_lib/routes/account-delete"),
  health: require("./_lib/routes/health"),
  "push-config": require("./_lib/routes/push-config"),
  "push-dispatch": require("./_lib/routes/push-dispatch"),
  "push-subscriptions": require("./_lib/routes/push-subscriptions"),
  "payments/quote": require("./_lib/routes/payments/quote"),
  "payments/initialize": require("./_lib/routes/payments/initialize"),
  "payments/verify": require("./_lib/routes/payments/verify"),
  payouts: require("./_lib/routes/payouts"),
  session: require("./_lib/routes/session"),
  "supabase-config": require("./_lib/routes/supabase-config"),
  "auth/google-2fa": require("./_lib/routes/auth/google-2fa"),
  "auth/password-recovery": require("./_lib/routes/auth/password-recovery"),
  "auth/resend": require("./_lib/routes/auth/resend"),
  "auth/session-otp": require("./_lib/routes/auth/session-otp"),
  "auth/sign-in": require("./_lib/routes/auth/sign-in"),
  "auth/sign-up": require("./_lib/routes/auth/sign-up"),
  "auth/verify": require("./_lib/routes/auth/verify"),
};
const { apiRateLimit, authRateLimit, endpointRateLimits, runRateLimited } = require("./_lib/rate-limit");

async function dispatchApiRequest(request, response, route) {
  const handler = routes[route];
  if (!handler) return response.status(404).json({ error: "Not found." });
  return handler(request, response);
}

module.exports = function apiRouter(request, response) {
  return runRateLimited(request, response, apiRateLimit, () => {
    const routeParam = request.query?.path;
    const route = Array.isArray(routeParam)
      ? routeParam.join("/")
      : typeof routeParam === "string"
        ? routeParam
        : new URL(request.url, "http://localhost").pathname.replace(/^\/api\/?/, "");
    const dispatch = () => {
      const endpointLimiter = endpointRateLimits[route];
      if (endpointLimiter) {
        return runRateLimited(request, response, endpointLimiter, () => dispatchApiRequest(request, response, route));
      }
      return dispatchApiRequest(request, response, route);
    };
    if (route.startsWith("auth/")) {
      return runRateLimited(request, response, authRateLimit, dispatch);
    }
    return dispatch();
  });
};
