function isNotificationInsert(event) {
  if (!event || typeof event !== "object") return false;
  const value = event;
  if (value.type !== "INSERT" || value.table !== "notifications" || value.schema !== "public"
    || !value.record || typeof value.record !== "object") return false;

  const record = value.record;
  return typeof record.user_id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.user_id)
    && typeof record.kind === "string"
    && ["booking_request", "booking_update", "message", "negotiation_offer",
      "negotiation_accepted", "negotiation_rejected", "negotiation_counter",
      "negotiation_agreed", "booking_reminder", "request_response", "booking_appointment_proposed", "booking_appointment_accepted", "booking_appointment_rejected"].includes(record.kind)
    && typeof record.title === "string"
    && record.title.length >= 2
    && record.title.length <= 120
    && typeof record.body === "string"
    && record.body.length <= 500
    && typeof record.target_path === "string"
    && ["bookings", "messages", "requests"].includes(record.target_path);
}

function getDispatchUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password
      || url.search || url.hash || !url.pathname.endsWith("/api/push-dispatch")) return null;
    return url;
  } catch {
    return null;
  }
}

export function createPushWebhookHandler({ getEnv, fetcher = fetch, logError = console.error }) {
  return async (request) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed." }, { status: 405, headers: { Allow: "POST" } });
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 64 * 1024) {
      return Response.json({ error: "Webhook payload is too large." }, { status: 413 });
    }

    let event;
    try {
      event = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
    }
    if (!isNotificationInsert(event)) {
      return Response.json({ error: "Unsupported notification webhook event." }, { status: 400 });
    }

    const dispatchUrl = getDispatchUrl(getEnv("PUSH_DISPATCH_URL") || "");
    const dispatchSecret = getEnv("PUSH_DISPATCH_SECRET") || "";
    if (!dispatchUrl || !dispatchSecret) {
      logError("Push webhook relay is missing a valid dispatch URL or secret.");
      return Response.json({ error: "Push notification delivery is not configured." }, { status: 503 });
    }

    try {
      const delivery = await fetcher(dispatchUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-skillflex-push-secret": dispatchSecret,
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(10000),
      });
      if (!delivery.ok) {
        logError("Push delivery endpoint returned HTTP", delivery.status);
        return Response.json({ error: "Push notification delivery failed." }, { status: 502 });
      }
      return Response.json({ ok: true }, { status: 200 });
    } catch (error) {
      logError("Could not reach the push delivery endpoint.", error);
      return Response.json({ error: "Push notification delivery is temporarily unavailable." }, { status: 502 });
    }
  };
}
