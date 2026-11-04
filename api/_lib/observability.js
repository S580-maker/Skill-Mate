function linearTrend(samples, valueKey, timeKey = "sampled_at") {
  const points = samples
    .map((sample) => ({
      x: Date.parse(sample[timeKey]),
      y: Number(sample[valueKey]),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (points.length < 3) return null;

  const origin = points[0].x;
  const xs = points.map((point) => (point.x - origin) / 86_400_000);
  const ys = points.map((point) => point.y);
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const denominator = xs.reduce((sum, value) => sum + ((value - meanX) ** 2), 0);
  if (!denominator) return null;

  const slopePerDay = xs.reduce((sum, value, index) =>
    sum + ((value - meanX) * (ys[index] - meanY)), 0) / denominator;
  return Number.isFinite(slopePerDay) ? slopePerDay : null;
}

function forecastLimit({ samples, valueKey, current, limit, threshold = 0.8 }) {
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(current)) {
    return { configured: false, utilization: null, daysUntilThreshold: null, trendPerDay: null };
  }
  const trendPerDay = linearTrend(samples, valueKey);
  const thresholdValue = limit * threshold;
  const daysUntilThreshold = trendPerDay > 0 && current < thresholdValue
    ? (thresholdValue - current) / trendPerDay
    : current >= thresholdValue ? 0 : null;
  return {
    configured: true,
    utilization: current / limit,
    daysUntilThreshold: Number.isFinite(daysUntilThreshold) ? daysUntilThreshold : null,
    trendPerDay,
  };
}

function forecastConnections(samples, current, limit) {
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(current)) {
    return { utilization: null, minutesUntilThreshold: null, trendPerMinute: null };
  }
  const trendPerDay = linearTrend(samples, "active_connections");
  const trendPerMinute = trendPerDay === null ? null : trendPerDay / 1440;
  const threshold = limit * 0.75;
  const minutesUntilThreshold = current >= threshold
    ? 0
    : trendPerMinute > 0
      ? (threshold - current) / trendPerMinute
      : null;
  return {
    utilization: current / limit,
    minutesUntilThreshold: Number.isFinite(minutesUntilThreshold) ? minutesUntilThreshold : null,
    trendPerMinute,
  };
}

function analyzeOperations({ samples, databaseLimitBytes, storageLimitBytes, now = Date.now() }) {
  const ordered = [...samples].sort((a, b) => Date.parse(a.sampled_at) - Date.parse(b.sampled_at));
  const current = ordered.at(-1) || null;
  if (!current) return { current: null, forecasts: null, alerts: [], sampleCount: 0 };

  const recent = ordered.filter((sample) => Date.parse(sample.sampled_at) >= now - 24 * 60 * 60 * 1000);
  const database = forecastLimit({
    samples: recent,
    valueKey: "database_bytes",
    current: Number(current.database_bytes),
    limit: databaseLimitBytes,
  });
  const storage = forecastLimit({
    samples: recent,
    valueKey: "storage_bytes",
    current: Number(current.storage_bytes),
    limit: storageLimitBytes,
  });
  const connections = forecastConnections(recent, Number(current.active_connections), Number(current.max_connections));
  const alerts = [];
  const ageMinutes = Math.max(0, (now - Date.parse(current.sampled_at)) / 60_000);
  const probeSamples = ordered.slice(-6);

  if (ageMinutes > 15) {
    alerts.push({
      severity: "warning",
      code: "stale-samples",
      message: `Telemetry is ${Math.floor(ageMinutes)} minutes old; verify the scheduled collector.`,
    });
  }
  for (const [resource, forecast] of [["database", database], ["storage", storage]]) {
    if (!forecast.configured) continue;
    if (forecast.utilization >= 0.95) {
      alerts.push({ severity: "critical", code: `${resource}-capacity`, message: `${resource} usage is at least 95% of its configured limit.` });
    } else if (forecast.utilization >= 0.8) {
      alerts.push({ severity: "warning", code: `${resource}-capacity`, message: `${resource} usage is at least 80% of its configured limit.` });
    } else if (forecast.daysUntilThreshold !== null && forecast.daysUntilThreshold <= 30) {
      alerts.push({
        severity: "warning",
        code: `${resource}-forecast`,
        message: `${resource} is trending to 80% of its configured limit in about ${Math.max(1, Math.ceil(forecast.daysUntilThreshold))} day(s).`,
      });
    }
  }
  if (connections.utilization >= 0.9) {
    alerts.push({ severity: "critical", code: "connection-capacity", message: "Active database connections are at least 90% of the reported server limit." });
  } else if (connections.utilization >= 0.75) {
    alerts.push({ severity: "warning", code: "connection-capacity", message: "Active database connections are at least 75% of the reported server limit." });
  } else if (connections.minutesUntilThreshold !== null && connections.minutesUntilThreshold <= 60) {
    alerts.push({
      severity: "warning",
      code: "connection-forecast",
      message: `Connections are trending to 75% of the reported server limit in about ${Math.max(1, Math.ceil(connections.minutesUntilThreshold))} minute(s).`,
    });
  }
  for (const [service, okKey, latencyKey] of [
    ["Authentication", "auth_ok", "auth_probe_ms"],
    ["Database", "database_ok", "database_probe_ms"],
  ]) {
    const failures = probeSamples.filter((sample) => sample[okKey] === false).length;
    if (failures >= 3) {
      alerts.push({ severity: "critical", code: `${service.toLowerCase()}-availability`, message: `${service} failed ${failures} of the last ${probeSamples.length} scheduled probes.` });
    } else if (failures > 0) {
      alerts.push({ severity: "warning", code: `${service.toLowerCase()}-availability`, message: `${service} failed ${failures} of the last ${probeSamples.length} scheduled probes; check upstream health and network errors.` });
    }
    const latency = Number(current[latencyKey]);
    if (current[okKey] && latency >= 5000) {
      alerts.push({ severity: "critical", code: `${service.toLowerCase()}-latency`, message: `${service} probe latency is at least 5 seconds.` });
    } else if (current[okKey] && latency >= 2000) {
      alerts.push({ severity: "warning", code: `${service.toLowerCase()}-latency`, message: `${service} probe latency is at least 2 seconds.` });
    }
  }

  return {
    current,
    forecasts: { database, storage, connections },
    availability: {
      authFailures: probeSamples.filter((sample) => sample.auth_ok === false).length,
      databaseFailures: probeSamples.filter((sample) => sample.database_ok === false).length,
      probeCount: probeSamples.length,
    },
    alerts,
    sampleCount: recent.length,
    windowHours: recent.length ? Math.max(0, (Date.parse(recent.at(-1).sampled_at) - Date.parse(recent[0].sampled_at)) / 3_600_000) : 0,
  };
}

module.exports = { analyzeOperations, forecastConnections, forecastLimit, linearTrend };
