const otpSessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const expiredOtpSessionCleanupIntervalMs = 6 * 60 * 60 * 1000;
let lastExpiredOtpSessionCleanupAt = 0;

function getSupabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !anonKey) {
    throw new Error("Set both SUPABASE_URL and SUPABASE_ANON_KEY in the deployment environment.");
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
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.anonKey, authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error(`Supabase authentication returned HTTP ${response.status}.`);
  return response.json();
}

function getSupabaseSessionId(accessToken) {
  try {
    const claims = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
    const sessionId = claims.session_id;
    return typeof sessionId === "string"
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)
      ? sessionId
      : "";
  } catch {
    return "";
  }
}

async function isOtpVerifiedSession(accessToken, userId) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) throw new Error("OTP session verification is not configured on this server.");
  const sessionId = getSupabaseSessionId(accessToken);
  if (!sessionId) return false;
  const config = getSupabaseConfig();
  const query = new URLSearchParams({
    select: "session_id",
    session_id: `eq.${sessionId}`,
    user_id: `eq.${userId}`,
    expires_at: `gt.${new Date().toISOString()}`,
    limit: "1",
  });
  const response = await fetch(`${config.url}/rest/v1/verified_auth_sessions?${query}`, {
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`OTP session lookup returned HTTP ${response.status}.`);
  const rows = await response.json();
  return rows.length > 0;
}

async function cleanupExpiredOtpSessions(config, serviceRoleKey) {
  if (Date.now() - lastExpiredOtpSessionCleanupAt < expiredOtpSessionCleanupIntervalMs) return;
  const query = new URLSearchParams({ expires_at: `lt.${new Date().toISOString()}` });
  const response = await fetch(`${config.url}/rest/v1/verified_auth_sessions?${query}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=minimal",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Could not clean up expired verified sessions (HTTP ${response.status}).`);
  lastExpiredOtpSessionCleanupAt = Date.now();
}

async function recordOtpVerifiedSession(accessToken) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) throw new Error("OTP session verification is not configured on this server.");
  const sessionId = getSupabaseSessionId(accessToken);
  if (!sessionId) throw new Error("The verified sign-in session has no valid session identifier.");
  const user = await getSupabaseUser(accessToken);
  if (!user?.id) throw new Error("The verified sign-in session is no longer valid.");
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/verified_auth_sessions?on_conflict=session_id`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      session_id: sessionId,
      user_id: user.id,
      expires_at: new Date(Date.now() + otpSessionLifetimeMs).toISOString(),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Could not record the verified OTP session (HTTP ${response.status}).`);
  await cleanupExpiredOtpSessions(config, serviceRoleKey);
  return user;
}

async function extendOtpVerifiedSession(accessToken, userId) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) throw new Error("OTP session verification is not configured on this server.");
  const sessionId = getSupabaseSessionId(accessToken);
  if (!sessionId) return false;
  const config = getSupabaseConfig();
  const now = new Date().toISOString();
  const query = new URLSearchParams({
    session_id: `eq.${sessionId}`,
    user_id: `eq.${userId}`,
    expires_at: `gt.${now}`,
  });
  const response = await fetch(`${config.url}/rest/v1/verified_auth_sessions?${query}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ expires_at: new Date(Date.now() + otpSessionLifetimeMs).toISOString() }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Could not extend the verified sign-in session (HTTP ${response.status}).`);
  const updatedSessions = await response.json();
  await cleanupExpiredOtpSessions(config, serviceRoleKey);
  return updatedSessions.length > 0;
}

async function getUserRole(userId, accessToken) {
  const config = getSupabaseConfig();
  const query = new URLSearchParams({ select: "role", id: `eq.${userId}`, limit: "1" });
  const response = await fetch(`${config.url}/rest/v1/profiles?${query}`, {
    headers: { apikey: config.anonKey, authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Supabase profile lookup returned HTTP ${response.status}.`);
  const profiles = await response.json();
  return profiles[0]?.role || null;
}

function getBearerToken(request) {
  const authorization = request.headers?.authorization || request.get?.("authorization") || "";
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

function getSessionCookie(request) {
  const cookieHeader = request.headers?.cookie || "";
  const cookie = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith("skillflex_session="));
  if (!cookie) return "";
  try {
    return decodeURIComponent(cookie.slice("skillflex_session=".length));
  } catch {
    return "";
  }
}

function setSessionCookie(response, token) {
  const maxAge = Math.floor(getAccessTokenExpiry(token) / 1000);
  const secure = process.env.NODE_ENV === "production" || response.req?.protocol !== "http";
  response.setHeader(
    "Set-Cookie",
    `skillflex_session=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
  );
}

function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === "production" || response.req?.protocol !== "http";
  response.setHeader(
    "Set-Cookie",
    `skillflex_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
  );
}

module.exports = {
  clearSessionCookie,
  getBearerToken,
  getSessionCookie,
  getSupabaseSessionId,
  getSupabaseConfig,
  getSupabaseUser,
  getUserRole,
  isOtpVerifiedSession,
  extendOtpVerifiedSession,
  recordOtpVerifiedSession,
  setSessionCookie,
};
