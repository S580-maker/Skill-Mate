const buckets = [50, 100, 250, 500, 1000, 2500, 5000];
const state = {
  active: 0,
  completed: 0,
  errors: 0,
  responseBytes: 0,
  durationTotalMs: 0,
  durationMaxMs: 0,
  durationBuckets: Array(buckets.length + 1).fill(0),
  statusClasses: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 },
  intervalStartedAt: Date.now(),
};

function beginRequest() {
  state.active += 1;
  const startedAt = performance.now();
  let finished = false;
  return (statusCode = 0, responseBytes = 0) => {
    if (finished) return;
    finished = true;
    const durationMs = Math.max(0, performance.now() - startedAt);
    state.active = Math.max(0, state.active - 1);
    state.completed += 1;
    state.errors += statusCode >= 500 ? 1 : 0;
    state.responseBytes += Math.max(0, Number(responseBytes) || 0);
    state.durationTotalMs += durationMs;
    state.durationMaxMs = Math.max(state.durationMaxMs, durationMs);
    const bucket = buckets.findIndex(limit => durationMs <= limit);
    state.durationBuckets[bucket < 0 ? buckets.length : bucket] += 1;
    const statusClass = `${Math.floor(statusCode / 100)}xx`;
    if (Object.hasOwn(state.statusClasses, statusClass)) state.statusClasses[statusClass] += 1;
    else state.statusClasses.other += 1;
    if (Date.now() - state.intervalStartedAt >= 60_000 || state.completed >= 100) logAndReset();
  };
}

function logAndReset() {
  if (!state.completed) {
    state.intervalStartedAt = Date.now();
    return;
  }
  const count = state.completed;
  let percentileIndex = state.durationBuckets.findIndex((hits, index) => {
    const cumulative = state.durationBuckets.slice(0, index + 1).reduce((sum, value) => sum + value, 0);
    return cumulative >= Math.ceil(count * 0.95);
  });
  if (percentileIndex < 0) percentileIndex = buckets.length;
  console.info("Skill Flex HTTP performance", JSON.stringify({
    windowSeconds: Math.max(1, Math.round((Date.now() - state.intervalStartedAt) / 1000)),
    requests: count,
    activeRequests: state.active,
    serverErrors: state.errors,
    statusClasses: state.statusClasses,
    responseBytes: state.responseBytes,
    averageLatencyMs: Math.round(state.durationTotalMs / count),
    p95LatencyMs: percentileIndex < buckets.length ? buckets[percentileIndex] : `>${buckets.at(-1)}`,
    maxLatencyMs: Math.round(state.durationMaxMs),
    processMemoryBytes: process.memoryUsage().rss,
  }));
  state.completed = 0;
  state.errors = 0;
  state.responseBytes = 0;
  state.durationTotalMs = 0;
  state.durationMaxMs = 0;
  state.durationBuckets.fill(0);
  for (const key of Object.keys(state.statusClasses)) state.statusClasses[key] = 0;
  state.intervalStartedAt = Date.now();
}

function requestMetrics(request, response, next) {
  const finish = beginRequest();
  let responseBytes = 0;
  const countBytes = (chunk, encoding) => {
    if (chunk === undefined || chunk === null) return;
    if (Buffer.isBuffer(chunk) || ArrayBuffer.isView(chunk)) responseBytes += chunk.byteLength;
    else if (chunk instanceof ArrayBuffer) responseBytes += chunk.byteLength;
    else responseBytes += Buffer.byteLength(String(chunk), typeof encoding === "string" ? encoding : "utf8");
  };
  const originalWrite = response.write;
  const originalEnd = response.end;
  response.write = function writeWithMetrics(chunk, ...args) {
    countBytes(chunk, args[0]);
    return originalWrite.call(this, chunk, ...args);
  };
  response.end = function endWithMetrics(chunk, ...args) {
    countBytes(chunk, args[0]);
    return originalEnd.call(this, chunk, ...args);
  };
  const complete = () => finish(response.statusCode, responseBytes);
  response.once("finish", complete);
  response.once("close", complete);
  next();
}

module.exports = { beginRequest, requestMetrics };
