const { getSupabaseConfig } = require("../supabase");

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
  const check = async (path) => {
    try {
      const result = await fetch(`${config.url}${path}`, {
        headers: { apikey: config.anonKey }, signal: AbortSignal.timeout(5000),
      });
      if (result.ok) return "ok";
      if (path.startsWith("/rest/v1/") && result.status === 401) {
        const body = await result.json();
        if (body.code === "42501" && body.message === "permission denied for schema public") return "ok";
      }
      return "unavailable";
    } catch { return "unavailable"; }
  };
  const [auth, database] = await Promise.all([
    check("/auth/v1/health"), check("/rest/v1/profiles?select=id&limit=0"),
  ]);
  const healthy = auth === "ok" && database === "ok";
  return response.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded", supabaseConfigured: true,
    services: { auth, database },
  });
};
