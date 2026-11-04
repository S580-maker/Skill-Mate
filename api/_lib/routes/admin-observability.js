const {
  getSessionCookie,
  getSupabaseConfig,
  getSupabaseUser,
  getUserRole,
  isOtpVerifiedSession,
} = require("../supabase");
const { analyzeOperations } = require("../observability");

function configuredLimit(name) {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer representing bytes.`);
  }
  return value;
}

module.exports = async function adminObservability(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const accessToken = getSessionCookie(request);
    if (!accessToken) return response.status(401).json({ error: "Administrator session required." });
    const user = await getSupabaseUser(accessToken);
    if (!user?.id) return response.status(401).json({ error: "Administrator session is invalid." });
    const [otpVerified, role] = await Promise.all([
      isOtpVerifiedSession(accessToken, user.id),
      getUserRole(user.id, accessToken),
    ]);
    if (!otpVerified) {
      return response.status(403).json({ error: "Complete email verification to view system telemetry." });
    }
    if (role !== "admin") {
      return response.status(403).json({ error: "Administrator access required." });
    }

    const databaseLimitBytes = configuredLimit("SUPABASE_DB_LIMIT_BYTES");
    const storageLimitBytes = configuredLimit("SUPABASE_STORAGE_LIMIT_BYTES");
    const { url } = getSupabaseConfig();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceKey) throw new Error("Missing required server setting: SUPABASE_SERVICE_ROLE_KEY.");
    const result = await fetch(`${url}/rest/v1/rpc/read_system_health_snapshots`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_hours: 168 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) throw new Error(`Could not read system health snapshots (HTTP ${result.status}).`);
    const samples = await result.json();
    if (!Array.isArray(samples)) throw new Error("System health snapshots returned an invalid response.");
    const analysis = analyzeOperations({ samples, databaseLimitBytes, storageLimitBytes });
    return response.status(200).json({
      status: "ok",
      limits: { databaseBytes: databaseLimitBytes, storageBytes: storageLimitBytes },
      analysis,
      samples,
    });
  } catch (error) {
    console.error("Could not load administrator system telemetry.", {
      name: error?.name || "Error",
      message: error?.message || "Unknown error",
    });
    return response.status(503).json({ error: "System telemetry is temporarily unavailable." });
  }
};
