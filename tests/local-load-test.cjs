const baseUrl = new URL(process.env.SKILLFLEX_LOCAL_URL || "http://127.0.0.1:3000");
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const requestCount = 1000;
const concurrency = 25;

if (!localHosts.has(baseUrl.hostname)) {
  throw new Error("The load check is restricted to localhost. Do not send synthetic load to a deployed site.");
}

baseUrl.pathname = "/login.html";
baseUrl.search = "";
baseUrl.hash = "";

async function main() {
  const latencies = [];
  let nextRequest = 0;
  let failures = 0;
  const startedAt = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (nextRequest < requestCount) {
      const current = nextRequest++;
      const requestStartedAt = performance.now();
      const response = await fetch(baseUrl, { headers: { "cache-control": "no-cache" } });
      latencies[current] = performance.now() - requestStartedAt;
      if (!response.ok) failures++;
      await response.body?.cancel();
    }
  }));
  const durationMs = performance.now() - startedAt;
  latencies.sort((left, right) => left - right);
  const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1];
  console.info(JSON.stringify({
    target: baseUrl.origin,
    path: baseUrl.pathname,
    requests: requestCount,
    concurrency,
    failures,
    durationMs: Math.round(durationMs),
    requestsPerSecond: Math.round(requestCount / (durationMs / 1000)),
    p95LatencyMs: Math.round(p95),
  }, null, 2));
  if (failures) process.exitCode = 1;
}

main().catch(error => {
  console.error("Local Skillflex load check failed.", error);
  process.exitCode = 1;
});
