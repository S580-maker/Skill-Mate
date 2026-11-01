const { timingSafeEqual } = require("node:crypto");
const webpush = require("web-push");
const {
  getBearerToken,
  getSupabaseConfig,
  getSupabaseUser,
  isOtpVerifiedSession,
} = require("./supabase");

const subscriptionTable = "/rest/v1/push_subscriptions";

function getHeader(request, name) {
  return request.headers?.[name.toLowerCase()] || request.get?.(name) || "";
}

function isAllowedPushEndpoint(value) {
  let endpoint;
  try {
    endpoint = new URL(value);
  } catch {
    return false;
  }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.port) return false;
  const hostname = endpoint.hostname.toLowerCase();
  return hostname === "fcm.googleapis.com"
    || hostname.endsWith(".push.services.mozilla.com")
    || hostname === "updates.push.services.mozilla.com"
    || hostname.endsWith(".notify.windows.com")
    || hostname === "web.push.apple.com";
}

function validateSubscription(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || typeof value.endpoint !== "string" || value.endpoint.length > 2048
    || !isAllowedPushEndpoint(value.endpoint)
    || !value.keys || typeof value.keys !== "object"
    || typeof value.keys.p256dh !== "string" || !/^[A-Za-z0-9_-]{80,100}$/.test(value.keys.p256dh)
    || typeof value.keys.auth !== "string" || !/^[A-Za-z0-9_-]{16,32}$/.test(value.keys.auth)) {
    return null;
  }
  return {
    endpoint: value.endpoint,
    p256dh: value.keys.p256dh,
    auth: value.keys.auth,
  };
}

async function getAuthenticatedUser(request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) return { response: { status: 401, error: "Sign in to manage push notifications." } };
  const user = await getSupabaseUser(accessToken);
  if (!user?.id) return { response: { status: 401, error: "Your sign-in session has expired." } };
  if (!await isOtpVerifiedSession(accessToken, user.id)) {
    return { response: { status: 403, error: "Verify your email before managing push notifications." } };
  }
  return { user };
}

function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("Push subscription storage is not configured on this server.");
  return key;
}

async function requestSupabase(path, options = {}) {
  const config = getSupabaseConfig();
  const serviceRoleKey = getServiceRoleKey();
  const response = await fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Push subscription storage returned HTTP ${response.status}.`);
  }
  return response;
}

async function handlePushConfig(_request, response) {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  const dispatchSecret = process.env.PUSH_DISPATCH_SECRET?.trim();
  if (!publicKey || !privateKey || !subject || !dispatchSecret
    || !process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_ANON_KEY?.trim()
    || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return response.status(503).json({ error: "Browser push notifications are not configured yet." });
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (error) {
    console.error("Browser push VAPID configuration is invalid.", error);
    return response.status(503).json({ error: "Browser push notifications are not configured yet." });
  }
  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json({ publicKey });
}

async function handlePushSubscriptions(request, response) {
  if (!["POST", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "POST, DELETE");
    return response.status(405).json({ error: "Method not allowed." });
  }
  try {
    const authentication = await getAuthenticatedUser(request);
    if (authentication.response) {
      return response.status(authentication.response.status).json({ error: authentication.response.error });
    }
    const { user } = authentication;
    const subscription = validateSubscription(request.body);
    if (!subscription) {
      return response.status(400).json({ error: "The browser push subscription is invalid or unsupported." });
    }
    const query = new URLSearchParams({
      user_id: `eq.${user.id}`,
      endpoint: `eq.${subscription.endpoint}`,
    });
    if (request.method === "DELETE") {
      await requestSupabase(`${subscriptionTable}?${query}`, { method: "DELETE" });
      return response.status(204).end();
    }

    await requestSupabase(`${subscriptionTable}?on_conflict=user_id,endpoint`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: user.id, ...subscription }),
    });
    return response.status(201).json({ message: "Push notifications are enabled on this device." });
  } catch (error) {
    console.error("Could not manage Skillmate push subscriptions.", error);
    return response.status(503).json({ error: "Push notifications could not be updated. Please try again." });
  }
}

function hasValidDispatchSecret(request) {
  const expected = process.env.PUSH_DISPATCH_SECRET?.trim();
  const provided = getHeader(request, "x-skillmate-push-secret");
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

function getPushEvent(request) {
  const event = request.body;
  if (!event || event.type !== "INSERT" || event.table !== "notifications"
    || event.schema !== "public" || !event.record || typeof event.record !== "object") return null;
  const record = event.record;
  if (typeof record.user_id !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.user_id)
    || typeof record.title !== "string" || record.title.length > 120
    || typeof record.body !== "string" || record.body.length > 500
    || !["bookings", "messages"].includes(record.target_path)
    || !["booking_request", "booking_update", "message"].includes(record.kind)) return null;
  return record;
}

async function handlePushDispatch(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  if (!hasValidDispatchSecret(request)) return response.status(401).json({ error: "Unauthorized webhook." });

  const notification = getPushEvent(request);
  if (!notification) return response.status(400).json({ error: "Unsupported notification webhook event." });

  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.VAPID_SUBJECT?.trim();
    if (!publicKey || !privateKey || !subject) throw new Error("VAPID push delivery is not configured.");
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const query = new URLSearchParams({
      select: "endpoint,p256dh,auth",
      user_id: `eq.${notification.user_id}`,
    });
    const result = await requestSupabase(`${subscriptionTable}?${query}`);
    const subscriptions = await result.json();
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.kind === "message"
        ? "You have a new message in Skillmate."
        : notification.body,
      path: notification.target_path === "messages" ? "/index.html#messages" : "/index.html#bookings",
    });
    const failures = [];
    let sent = 0;
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, payload, { TTL: 60 * 60 });
        sent += 1;
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          const deleteQuery = new URLSearchParams({
            user_id: `eq.${notification.user_id}`,
            endpoint: `eq.${subscription.endpoint}`,
          });
          try {
            await requestSupabase(`${subscriptionTable}?${deleteQuery}`, { method: "DELETE" });
          } catch (cleanupError) {
            failures.push(cleanupError);
          }
        } else {
          failures.push(error);
        }
      }
    }));
    if (failures.length) {
      console.error("Some Skillmate push notifications could not be delivered.", {
        userId: notification.user_id,
        failedCount: failures.length,
        statusCodes: failures.map((error) => error.statusCode || null),
      });
      return response.status(502).json({ error: "Some push notifications could not be delivered." });
    }
    return response.status(200).json({ sent });
  } catch (error) {
    console.error("Could not dispatch Skillmate push notifications.", error);
    return response.status(503).json({ error: "Push notifications could not be dispatched." });
  }
}

module.exports = {
  handlePushConfig,
  handlePushDispatch,
  handlePushSubscriptions,
  isAllowedPushEndpoint,
  validateSubscription,
};
