const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const {
  getSupabaseSessionId,
  isOtpVerifiedSession,
  extendOtpVerifiedSession,
  recordOtpVerifiedSession,
} = require("../api/_lib/supabase");
const sessionHandler = require("../api/_lib/routes/session");

const originalFetch = global.fetch;
const originalEnvironment = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

const userId = "223e4567-e89b-42d3-a456-426614174000";
const sessionId = "123e4567-e89b-42d3-a456-426614174000";

function token(claims = {}) {
  return `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}

function configureSupabase() {
  process.env.SUPABASE_URL = "https://skillflex-test.supabase.co";
  process.env.SUPABASE_ANON_KEY = token({ role: "anon" });
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only-service-key";
}

afterEach(() => {
  global.fetch = originalFetch;
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("session identity is accepted only from a UUID session_id claim", () => {
  assert.equal(getSupabaseSessionId(token({ session_id: sessionId })), sessionId);
  assert.equal(getSupabaseSessionId(token({ session_id: "not-a-session" })), "");
  assert.equal(getSupabaseSessionId("not-a-jwt"), "");
});

test("verified OTP session lookup is bound to the exact user and auth session", async () => {
  configureSupabase();
  let requestUrl = "";
  let requestHeaders;
  global.fetch = async (url, options) => {
    requestUrl = url;
    requestHeaders = options.headers;
    return { ok: true, json: async () => [{ session_id: sessionId }] };
  };

  assert.equal(await isOtpVerifiedSession(token({ session_id: sessionId }), userId), true);
  assert.match(requestUrl, new RegExp(`session_id=eq\\.${sessionId}`));
  assert.match(requestUrl, new RegExp(`user_id=eq\\.${userId}`));
  assert.match(requestUrl, /expires_at=gt\./);
  assert.equal(requestHeaders.apikey, "server-only-service-key");
  assert.equal(await isOtpVerifiedSession(token({ session_id: "invalid" }), userId), false);
});

test("OTP completion records only a valid Supabase auth session", async () => {
  configureSupabase();
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith("/auth/v1/user")) {
      return { ok: true, status: 200, json: async () => ({ id: userId }) };
    }
    return { ok: true, status: 201, json: async () => [] };
  };

  const user = await recordOtpVerifiedSession(token({ session_id: sessionId }));

  assert.equal(user.id, userId);
  assert.equal(requests.length, 3);
  assert.match(requests[1].url, /verified_auth_sessions\?on_conflict=session_id$/);
  const recorded = JSON.parse(requests[1].options.body);
  assert.deepEqual(Object.keys(recorded).sort(), ["expires_at", "session_id", "user_id"]);
  assert.equal(Date.parse(recorded.expires_at) > Date.now() + 29 * 24 * 60 * 60 * 1000, true);
  assert.equal(Date.parse(recorded.expires_at) < Date.now() + 31 * 24 * 60 * 60 * 1000, true);
  assert.deepEqual({ session_id: recorded.session_id, user_id: recorded.user_id }, {
    session_id: sessionId,
    user_id: userId,
  });
  assert.equal(requests[1].options.headers.apikey, "server-only-service-key");
  assert.equal(requests[2].options.method, "DELETE");
});

test("OTP-verified session renewal extends only a non-expired matching user session", async () => {
  configureSupabase();
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      json: async () => options.method === "PATCH" ? [{ session_id: sessionId }] : [],
    };
  };
  assert.equal(await extendOtpVerifiedSession(token({ session_id: sessionId }), userId), true);
  assert.match(requests[0].url, new RegExp(`session_id=eq\\.${sessionId}`));
  assert.match(requests[0].url, new RegExp(`user_id=eq\\.${userId}`));
  assert.match(requests[0].url, /expires_at=gt\./);
  const expiresAt = JSON.parse(requests[0].options.body).expires_at;
  assert.equal(Date.parse(expiresAt) > Date.now() + 29 * 24 * 60 * 60 * 1000, true);
});

test("session endpoint requires OTP proof before issuing its server cookie", async () => {
  configureSupabase();
  const accessToken = token({ session_id: sessionId });
  global.fetch = async (url) => {
    if (url.endsWith("/auth/v1/user")) {
      return { ok: true, status: 200, json: async () => ({ id: userId }) };
    }
    return { ok: true, json: async () => [] };
  };
  const result = {
    statusCode: 0,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };

  await sessionHandler({
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
  }, result);

  assert.equal(result.statusCode, 403);
  assert.equal(result.body.code, "OTP_VERIFICATION_REQUIRED");
  assert.match(result.headers["Set-Cookie"], /Max-Age=0/);
});

test("OTP-verified persistent sessions continue to receive the server cookie", async () => {
  configureSupabase();
  const accessToken = token({ session_id: sessionId });
  global.fetch = async (url, options) => {
    if (url.endsWith("/auth/v1/user")) {
      return { ok: true, status: 200, json: async () => ({ id: userId }) };
    }
    return {
      ok: true,
      json: async () => options.method === "PATCH" ? [{ session_id: sessionId }] : [{ session_id: sessionId }],
    };
  };
  const result = {
    statusCode: 0,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    end() { return this; },
  };

  await sessionHandler({
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
  }, result);

  assert.equal(result.statusCode, 204);
  assert.match(result.headers["Set-Cookie"], /skillflex_session=/);
  assert.doesNotMatch(result.headers["Set-Cookie"], /Max-Age=0/);
});
