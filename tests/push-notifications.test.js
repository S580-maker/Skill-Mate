const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const webpush = require("web-push");
const {
  handlePushDispatch,
  handlePushSubscriptions,
  isAllowedPushEndpoint,
  validateSubscription,
} = require("../api/_lib/push");

const originalFetch = global.fetch;
const environmentKeys = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "PUSH_DISPATCH_SECRET",
];
const originalEnvironment = Object.fromEntries(environmentKeys.map((name) => [name, process.env[name]]));
const userId = "223e4567-e89b-42d3-a456-426614174000";
const sessionId = "123e4567-e89b-42d3-a456-426614174000";

function token(claims = {}) {
  return `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}

function configureSupabase() {
  process.env.SUPABASE_URL = "https://skillmate-test.supabase.co";
  process.env.SUPABASE_ANON_KEY = token({ role: "anon" });
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only-service-key";
}

function responseFixture() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

function subscription() {
  return {
    endpoint: "https://fcm.googleapis.com/fcm/send/endpoint-id",
    keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
  };
}

afterEach(() => {
  global.fetch = originalFetch;
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("push subscriptions accept supported HTTPS providers and reject arbitrary endpoints", () => {
  assert.equal(isAllowedPushEndpoint(subscription().endpoint), true);
  assert.equal(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/x"), false);
  assert.equal(isAllowedPushEndpoint("https://127.0.0.1:8080/"), false);
  assert.equal(isAllowedPushEndpoint("https://attacker.example/push"), false);
  assert.equal(validateSubscription(subscription()).p256dh.length, 87);
  assert.equal(validateSubscription({ ...subscription(), keys: { p256dh: "short", auth: "short" } }), null);
});

test("push subscription registration requires a signed-in OTP-verified session", async () => {
  configureSupabase();
  const accessToken = token({ session_id: sessionId });
  global.fetch = async (url) => {
    if (url.endsWith("/auth/v1/user")) {
      return { ok: true, status: 200, json: async () => ({ id: userId }) };
    }
    return { ok: true, status: 200, json: async () => [] };
  };
  const response = responseFixture();
  await handlePushSubscriptions({
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
    body: subscription(),
  }, response);
  assert.equal(response.statusCode, 403);
  assert.match(response.body.error, /Verify your email/);
});

test("push subscription registration stores ownership only after OTP verification", async () => {
  configureSupabase();
  const accessToken = token({ session_id: sessionId });
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith("/auth/v1/user")) {
      return { ok: true, status: 200, json: async () => ({ id: userId }) };
    }
    if (url.includes("/verified_auth_sessions?")) {
      return { ok: true, status: 200, json: async () => [{ session_id: sessionId }] };
    }
    return { ok: true, status: 201 };
  };
  const response = responseFixture();
  await handlePushSubscriptions({
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
    body: subscription(),
  }, response);
  assert.equal(response.statusCode, 201);
  const write = requests.at(-1);
  assert.match(write.url, /push_subscriptions\?on_conflict=user_id,endpoint$/);
  assert.equal(write.options.headers.apikey, "server-only-service-key");
  assert.deepEqual(JSON.parse(write.options.body), {
    user_id: userId,
    endpoint: subscription().endpoint,
    p256dh: subscription().keys.p256dh,
    auth: subscription().keys.auth,
  });
});

test("push dispatch rejects untrusted webhook requests before accessing subscriptions", async () => {
  process.env.PUSH_DISPATCH_SECRET = "expected-secret";
  const response = responseFixture();
  await handlePushDispatch({
    method: "POST",
    headers: { "x-skillmate-push-secret": "wrong-secret" },
    body: {},
  }, response);
  assert.equal(response.statusCode, 401);
});

test("push configuration is withheld until every server-side delivery setting exists", async () => {
  delete process.env.PUSH_DISPATCH_SECRET;
  process.env.VAPID_PUBLIC_KEY = "public";
  process.env.VAPID_PRIVATE_KEY = "private";
  process.env.VAPID_SUBJECT = "mailto:admin@skillmate.example";
  const response = responseFixture();
  const { handlePushConfig } = require("../api/_lib/push");
  await handlePushConfig({}, response);
  assert.equal(response.statusCode, 503);
});

test("push dispatch sends a valid notification insert to the recipient's subscriptions", async () => {
  configureSupabase();
  const vapid = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
  process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
  process.env.VAPID_SUBJECT = "mailto:admin@skillmate.example";
  process.env.PUSH_DISPATCH_SECRET = "expected-secret";
  let requestUrl = "";
  global.fetch = async (url) => {
    requestUrl = url;
    return { ok: true, status: 200, json: async () => [] };
  };
  const response = responseFixture();
  await handlePushDispatch({
    method: "POST",
    headers: { "x-skillmate-push-secret": "expected-secret" },
    body: {
      type: "INSERT",
      table: "notifications",
      schema: "public",
      record: {
        user_id: userId,
        kind: "message",
        title: "New message",
        body: "Private message contents",
        target_path: "messages",
      },
    },
  }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { sent: 0 });
  assert.match(requestUrl, new RegExp(`user_id=eq\\.${userId}`));
});

test("push dispatch accepts negotiation notification kinds and routes them to messages", async () => {
  configureSupabase();
  const vapid = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
  process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
  process.env.VAPID_SUBJECT = "mailto:admin@skillmate.example";
  process.env.PUSH_DISPATCH_SECRET = "expected-secret";
  let requestUrl = "";
  global.fetch = async (url) => {
    requestUrl = url;
    return { ok: true, status: 200, json: async () => [] };
  };
  const response = responseFixture();
  await handlePushDispatch({
    method: "POST",
    headers: { "x-skillmate-push-secret": "expected-secret" },
    body: {
      type: "INSERT",
      table: "notifications",
      schema: "public",
      record: {
        user_id: userId,
        kind: "negotiation_agreed",
        title: "Final price agreed",
        body: "A price was agreed.",
        target_path: "messages",
        conversation_id: "323e4567-e89b-42d3-a456-426614174000",
      },
    },
  }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { sent: 0 });
  assert.match(requestUrl, new RegExp(`user_id=eq\\.${userId}`));
});
