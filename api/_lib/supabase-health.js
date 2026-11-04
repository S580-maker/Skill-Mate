async function checkSupabaseService(config, pathname) {
  const startedAt = performance.now();
  try {
    const result = await fetch(`${config.url}${pathname}`, {
      headers: { apikey: config.anonKey },
      signal: AbortSignal.timeout(5000),
    });
    if (result.ok) return { status: "ok", latencyMs: Math.round(performance.now() - startedAt) };
    if (pathname.startsWith("/rest/v1/") && result.status === 401) {
      const body = await result.json();
      if (body.code === "42501" && body.message === "permission denied for schema public") {
        return { status: "ok", latencyMs: Math.round(performance.now() - startedAt) };
      }
    }
    return { status: "unavailable", latencyMs: Math.round(performance.now() - startedAt) };
  } catch {
    return { status: "unavailable", latencyMs: Math.round(performance.now() - startedAt) };
  }
}

async function probeSupabase(config) {
  const [auth, database] = await Promise.all([
    checkSupabaseService(config, "/auth/v1/health"),
    checkSupabaseService(config, "/rest/v1/profiles?select=id&limit=0"),
  ]);
  return { auth, database };
}

module.exports = { probeSupabase };
