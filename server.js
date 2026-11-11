require("dotenv").config();

const path = require("node:path");
const { existsSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const { contentSecurityPolicy } = require("./api/_lib/content-security-policy");
const { getSupabaseConfig, getSupabaseUser, getUserRole, isOtpVerifiedSession } = require("./api/_lib/supabase");
const sessionHandler = require("./api/_lib/routes/session");
const { apiRateLimit, authRateLimit, createRateLimit } = require("./api/_lib/rate-limit");
const { requestMetrics } = require("./api/_lib/http-metrics");

const app = express();
const projectRoot = existsSync(path.join(__dirname, "public")) ? path.join(__dirname, "public") : __dirname;
const sessionCookieName = "skillmate_session";
const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "1");
// Allow framing (e.g. editor preview panes) outside production only.
app.use(helmet({
  contentSecurityPolicy: { useDefaults: false, directives: contentSecurityPolicy() },
  crossOriginEmbedderPolicy: false,
  frameguard: process.env.NODE_ENV === "production" ? { action: "sameorigin" } : false
}));
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());
app.use(requestMetrics);
app.use("/api", apiRateLimit);
app.use("/api/auth", authRateLimit);

app.get("/supabase-config.js", (_request, response, next) => {
  try {
    const config = getSupabaseConfig();
    response
      .type("application/javascript")
      .set("Cache-Control", "no-store")
      .send(`window.SKILLMATE_SUPABASE_CONFIG = ${JSON.stringify(config)};`);
  } catch (error) {
    next(error);
  }
});

app.get("/api/health", require("./api/_lib/routes/health"));
app.get("/api/push-config", (request, response) => {
  const { handlePushConfig } = require("./api/_lib/push");
  return handlePushConfig(request, response);
});
app.all("/api/push-subscriptions", createRateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }, "push-subscriptions"), (request, response) => {
  const { handlePushSubscriptions } = require("./api/_lib/push");
  return handlePushSubscriptions(request, response);
});
app.all("/api/booking-reminders", require("./api/_lib/routes/booking-reminders"));
app.all("/api/email-notifications", require("./api/_lib/routes/email-notifications"));
app.get("/api/admin-observability", require("./api/_lib/routes/admin-observability"));
app.all("/api/system-health-snapshot", require("./api/_lib/routes/system-health-snapshot"));
app.post("/api/push-dispatch", (request, response) => {
  const { handlePushDispatch } = require("./api/_lib/push");
  return handlePushDispatch(request, response);
});

app.post("/api/auth/sign-in", createRateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false }, "sign-in"), (request, response) => {
  const { signIn } = require("./api/_lib/email-2fa");
  return signIn(request, response);
});
app.post("/api/auth/google-2fa", createRateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false }, "google-2fa"), (request, response) => {
  const { googleSignIn } = require("./api/_lib/email-2fa");
  return googleSignIn(request, response);
});
app.post("/api/auth/session-otp", createRateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false }, "session-otp"), (request, response) => {
  const { sessionSignIn } = require("./api/_lib/email-2fa");
  return sessionSignIn(request, response);
});
app.post("/api/auth/sign-up", createRateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false }, "sign-up"), (request, response) => {
  const { signUp } = require("./api/_lib/email-2fa");
  return signUp(request, response);
});
app.delete("/api/auth/sign-in", (request, response) => {
  const { signIn } = require("./api/_lib/email-2fa");
  return signIn(request, response);
});
app.post("/api/auth/verify", createRateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: "draft-7", legacyHeaders: false }, "verify"), (request, response) => {
  const { verify } = require("./api/_lib/email-2fa");
  return verify(request, response);
});
app.post("/api/auth/resend", createRateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false }, "resend"), (request, response) => {
  const { resend } = require("./api/_lib/email-2fa");
  return resend(request, response);
});
app.all("/api/auth/password-recovery", createRateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false }, "password-recovery"), (request, response) => {
  const { requestPasswordRecovery, updateRecoveredPassword } = require("./api/_lib/email-2fa");
  if (request.method === "POST") return requestPasswordRecovery(request, response);
  if (request.method === "PUT") return updateRecoveredPassword(request, response);
  response.setHeader("Allow", "POST, PUT");
  return response.status(405).json({ error: "Method not allowed." });
});

app.post(
  "/api/session",
  createRateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }, "session"),
  sessionHandler,
);
app.delete("/api/session", sessionHandler);

app.post("/api/account/delete", (request, response) => {
  const { handleAccountDelete } = require("./api/_lib/account-delete");
  return handleAccountDelete(request, response, request.cookies[sessionCookieName]);
});

app.get("/admin.html", async (request, response) => {
  const accessToken = request.cookies[sessionCookieName];
  if (!accessToken) return response.redirect(302, "/login.html?next=admin");

  try {
    const user = await getSupabaseUser(accessToken);
    if (!user?.id) {
      response.clearCookie(sessionCookieName, sessionCookieOptions);
      return response.redirect(302, "/login.html?next=admin");
    }
    if (!await isOtpVerifiedSession(accessToken, user.id)) {
      response.clearCookie(sessionCookieName, sessionCookieOptions);
      return response.redirect(302, "/login.html?verify=required&next=admin");
    }
    const role = await getUserRole(user.id, accessToken);
    if (role !== "admin") return response.redirect(302, "/index.html");

    response.set("Cache-Control", "private, no-store");
    return response.sendFile(path.join(__dirname, "api", "_lib", "admin.html"));
  } catch (error) {
    console.error("Could not verify administrator access.", error);
    return response.status(503).send("Administrator access could not be verified. Please reload shortly.");
  }
});

app.get("/", (_request, response) => response.sendFile(path.join(projectRoot, "landing.html")));

app.use((request, response, next) => {
  // Normalize after decoding, before checking the public prefix. Otherwise an
  // encoded separator can turn /assets/..%2fserver.js into a private root file.
  const pathname = path.posix.normalize(decodeURIComponent(request.path).replaceAll("\\", "/"));
  const publicFile = /^\/[\w-]+\.(?:html|css|js|svg|ico|webmanifest)$/i.test(pathname) && pathname.toLowerCase() !== "/server.js";
  const publicAsset = pathname.startsWith("/assets/");
  if (!publicFile && !publicAsset) {
    return response.sendStatus(404);
  }
  return next();
});

app.use(express.static(projectRoot, { dotfiles: "deny", index: false }));

app.use((error, request, response, _next) => {
  const errorId = randomUUID();
  const status = error?.type === "entity.parse.failed" || error instanceof URIError ? 400
    : error?.type === "entity.too.large" ? 413 : 500;
  const message = status === 400 ? "Send a valid JSON request."
    : status === 413 ? "That request is too large."
      : `Sorry, we couldn't complete that request. Please try again. If it keeps happening, contact support with reference ${errorId}.`;
  console.error("Skillmate request failed.", {
    errorId,
    method: request.method,
    path: request.path,
    status,
    // Parser errors contain the raw request body, including passwords. Keep
    // only classification metadata; neither the body nor exception message is
    // safe to write to the application log.
    error: { name: error?.name || "Error", type: error?.type || "internal" },
  });
  if (response.headersSent) return;
  response.set("X-Skillmate-Error-Id", errorId).status(status);
  if (request.path.startsWith("/api/")) return response.json({ error: message, reference: errorId });
  return response.send(message);
});

if (require.main === module) {
  try {
    getSupabaseConfig();
    const port = Number(process.env.PORT) || 3000;
    app.listen(port, () => {
      console.log(`Skillmate is running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error(`Skillmate could not start: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { app, getSupabaseConfig };
