const { getSupabaseConfig } = require("../supabase");
const { probeSupabase } = require("../supabase-health");

// Shared by the Vercel function and the Express route.
module.exports = async function health(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }
  let config;
  try {
    config = getSupabaseConfig();
  } catch {
    return response.status(503).json({
      status: "unavailable", supabaseConfigured: false,
      services: { auth: "unavailable", database: "unavailable" },
    });
  }
  const services = await probeSupabase(config);
  const healthy = services.auth.status === "ok" && services.database.status === "ok";
  return response.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded", supabaseConfigured: true,
    services: { auth: services.auth.status, database: services.database.status },
  });
};
