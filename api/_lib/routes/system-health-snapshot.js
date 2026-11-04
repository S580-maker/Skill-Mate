const { timingSafeEqual } = require("node:crypto");
const { getSupabaseConfig } = require("../supabase");
const { probeSupabase } = require("../supabase-health");

function isAuthorized(request) {
  const expected = process.env.CRON_SECRET?.trim();
  const header = request.headers?.authorization || request.headers?.Authorization || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  return Boolean(expected)
    && Buffer.byteLength(expected) === Buffer.byteLength(provided)
    && timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

module.exports = async function systemHealthSnapshot(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  if (!isAuthorized(request)) return response.status(401).json({ error: "Unauthorized." });

  try {
    const config = getSupabaseConfig();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceKey) throw new Error("Missing required server setting: SUPABASE_SERVICE_ROLE_KEY.");
    const services = await probeSupabase(config);
    const result = await fetch(`${config.url}/rest/v1/rpc/capture_system_health_snapshot`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_auth_ok: services.auth.status === "ok",
        p_auth_probe_ms: services.auth.latencyMs,
        p_database_ok: services.database.status === "ok",
        p_database_probe_ms: services.database.latencyMs,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) throw new Error(`Could not capture system health snapshot (HTTP ${result.status}).`);
    return response.status(200).json({ sampledAt: await result.json(), services });
  } catch (error) {
    console.error("Could not capture system health telemetry.", {
      name: error?.name || "Error",
      message: error?.message || "Unknown error",
    });
    return response.status(503).json({ error: "System health telemetry is temporarily unavailable." });
  }
};
