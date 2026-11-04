const { test } = require("node:test");
const assert = require("node:assert/strict");
const { analyzeOperations } = require("../api/_lib/observability");

function sample(overrides = {}) {
  return {
    sampled_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    database_bytes: 100,
    storage_bytes: 200,
    active_connections: 20,
    max_connections: 100,
    auth_ok: true,
    auth_probe_ms: 100,
    database_ok: true,
    database_probe_ms: 100,
    ...overrides,
  };
}

test("capacity forecaster requires a configured quota and meaningful sample history", () => {
  const analysis = analyzeOperations({
    samples: [sample()],
    databaseLimitBytes: null,
    storageLimitBytes: null,
  });
  assert.equal(analysis.sampleCount, 1);
  assert.equal(analysis.forecasts.database.configured, false);
  assert.equal(analysis.forecasts.storage.configured, false);
  assert.ok(analysis.alerts.every((alert) => !alert.code.endsWith("-forecast")));
});

test("capacity forecaster flags approaching database limits and connection saturation", () => {
  const now = Date.now();
  const samples = Array.from({ length: 6 }, (_value, index) => sample({
    sampled_at: new Date(now - (5 - index) * 60 * 60 * 1000).toISOString(),
    database_bytes: 500 + index * 75,
    storage_bytes: 200,
    active_connections: 40 + index * 7,
  }));
  const analysis = analyzeOperations({
    samples,
    databaseLimitBytes: 1000,
    storageLimitBytes: 1000,
    now,
  });
  assert.ok(analysis.forecasts.database.utilization >= 0.8);
  assert.ok(analysis.forecasts.connections.utilization >= 0.75);
  assert.ok(analysis.alerts.some((alert) => alert.code === "database-capacity"));
  assert.ok(analysis.alerts.some((alert) => alert.code === "connection-capacity"));
});

test("repeated failed service probes create a critical availability signal", () => {
  const now = Date.now();
  const samples = Array.from({ length: 6 }, (_value, index) => sample({
    sampled_at: new Date(now - (5 - index) * 5 * 60 * 1000).toISOString(),
    auth_ok: index > 2,
  }));
  const analysis = analyzeOperations({ samples, now });
  assert.ok(analysis.alerts.some((alert) =>
    alert.code === "authentication-availability" && alert.severity === "critical"));
});
