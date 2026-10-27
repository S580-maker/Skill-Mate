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
    .find((part) => part.startsWith("skillmate_session="));
  if (!cookie) return "";
  try {
    return decodeURIComponent(cookie.slice("skillmate_session=".length));
  } catch {
    return "";
  }
}

function setSessionCookie(response, token) {
  const maxAge = Math.floor(getAccessTokenExpiry(token) / 1000);
  response.setHeader(
    "Set-Cookie",
    `skillmate_session=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  );
}

function clearSessionCookie(response) {
  response.setHeader(
    "Set-Cookie",
    "skillmate_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
  );
}

module.exports = {
  clearSessionCookie,
  getBearerToken,
  getSessionCookie,
  getSupabaseConfig,
  getSupabaseUser,
  getUserRole,
  setSessionCookie,
};
