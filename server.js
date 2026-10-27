require("dotenv").config();

const path = require("node:path");
const { randomUUID } = require("node:crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");

const app = express();
const projectRoot = __dirname;
const sessionCookieName = "skillmate_session";
const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "1");
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());

function getSupabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !anonKey) {
    throw new Error("Set both SUPABASE_URL and SUPABASE_ANON_KEY in .env.");
  }

  let projectUrl;
  try {
    projectUrl = new URL(rawUrl);
  } catch {
    throw new Error("SUPABASE_URL must be the project URL from Supabase Project Settings → API.");
  }
  const apiPath = projectUrl.pathname.replace(/\/+$/, "");
  if (!["https:", "http:"].includes(projectUrl.protocol)
    || projectUrl.hostname.includes("pooler")
    || (apiPath !== "" && apiPath !== "/rest/v1")
    || projectUrl.search
    || projectUrl.hash) {
    throw new Error("SUPABASE_URL must be the Supabase Project URL, not a database pooler URL.");
  }
  let keyRole = "";
  try {
    keyRole = JSON.parse(Buffer.from(anonKey.split(".")[1], "base64url").toString("utf8")).role || "";
  } catch {
    if (anonKey.startsWith("sb_secret_")) {
      throw new Error("SUPABASE_ANON_KEY must be a public anon/publishable key, never a secret key.");
    }
  }
  if (keyRole === "service_role" || anonKey.startsWith("sb_secret_")) {
    throw new Error("SUPABASE_ANON_KEY must be a public anon/publishable key, never a service-role/secret key.");
  }

  return {
    url: projectUrl.origin, anonKey,
    supportEmail: process.env.SUPPORT_EMAIL?.trim() || "ezekielnyarku1@gmail.com,steveobodai@gmail.com",
    supportWhatsApp: process.env.SUPPORT_WHATSAPP?.trim() || "",
    accountDeletionAvailable: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  };
}

async function getSupabaseUser(accessToken) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured on this server.");
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error(`Supabase authentication returned HTTP ${response.status}.`);
  return response.json();
}

async function getUserRole(userId, accessToken) {
  const config = getSupabaseConfig();
  const query = new URLSearchParams({
    select: "role",
    id: `eq.${userId}`,
    limit: "1",
  });
  const response = await fetch(`${config.url}/rest/v1/profiles?${query}`, {
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Supabase profile lookup returned HTTP ${response.status}.`);
  const profiles = await response.json();
  return profiles[0]?.role || null;
}

function getBearerToken(request) {
  const authorization = request.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+([A-Za-z0-9._~-]+)$/i);
  return match?.[1] || "";
}

function getAccessTokenExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    const remaining = Number(payload.exp) * 1000 - Date.now();
    return Number.isFinite(remaining) ? Math.max(1000, Math.min(remaining, 60 * 60 * 1000)) : 60 * 60 * 1000;
  } catch {
    return 60 * 60 * 1000;
  }
}

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

app.get("/api/health", require("./api/health"));

app.post(
  "/api/session",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }),
  async (request, response) => {
    const accessToken = getBearerToken(request);
    if (!accessToken) return response.status(401).json({ error: "A valid Supabase sign-in session is required." });

    try {
      const user = await getSupabaseUser(accessToken);
      if (!user?.id) {
        response.clearCookie(sessionCookieName, sessionCookieOptions);
        return response.status(401).json({ error: "Your sign-in session has expired. Please sign in again." });
      }
      response.cookie(sessionCookieName, accessToken, {
        ...sessionCookieOptions,
        maxAge: getAccessTokenExpiry(accessToken),
      });
      return response.status(204).end();
    } catch (error) {
      console.error("Could not validate the Skillmate session.", error);
      return response.status(503).json({ error: "Skillmate could not validate your session. Please try again." });
    }
  },
);

app.delete("/api/session", (_request, response) => {
  response.clearCookie(sessionCookieName, sessionCookieOptions);
  response.status(204).end();
});

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
    const role = await getUserRole(user.id, accessToken);
    if (role !== "admin") return response.redirect(302, "/index.html");

    response.set("Cache-Control", "private, no-store");
    return response.sendFile(path.join(projectRoot, "api", "_lib", "admin.html"));
  } catch (error) {
    console.error("Could not verify administrator access.", error);
    return response.status(503).send("Administrator access could not be verified. Please reload shortly.");
  }
});

app.get("/", (_request, response) => response.redirect(302, "/login.html"));

app.use((request, response, next) => {
  const pathname = decodeURIComponent(request.path);
  if (/^\/(?:api(?:\/|$)|server\.js|package(?:-lock)?\.json|\.env(?:\..*)?|\.git(?:\/|$)|node_modules(?:\/|$)|supabase(?:\/|$))/i.test(pathname)) {
    return response.sendStatus(404);
  }
  return next();
});

app.use(express.static(projectRoot, { dotfiles: "deny", index: false }));

app.use((error, request, response, _next) => {
  const errorId = randomUUID();
  console.error("Skillmate request failed.", {
    errorId,
    method: request.method,
    path: request.path,
    error,
  });
  if (response.headersSent) return;
  response
    .set("X-Skillmate-Error-Id", errorId)
    .status(500)
    .send(`Sorry, we couldn’t complete that request. Please try again. If it keeps happening, contact support with reference ${errorId}.`);
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
