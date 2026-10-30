const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const nodemailer = require("nodemailer");

const originalFetch = global.fetch;
const originalTransport = nodemailer.createTransport;
const otpSecret = "password-recovery-test-secret-32-characters";
process.env.SUPABASE_URL = "https://recovery-test.supabase.co";
process.env.SUPABASE_ANON_KEY = "recovery-test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "recovery-test-service-key";
process.env.AUTH_OTP_SECRET = otpSecret;
process.env.SMTP_HOST = "smtp.example.test";
process.env.SMTP_PORT = "587";
process.env.SMTP_USER = "mailer@example.test";
process.env.SMTP_PASS = "test-password";
process.env.SMTP_FROM = "Skillmate <mailer@example.test>";

const {
  requestPasswordRecovery,
  updateRecoveredPassword,
  verify,
} = require("../api/_lib/email-2fa");

function responseStub() {
  const headers = {};
  return {
    headers,
    req: { headers: {}, protocol: "http" },
    statusCode: 200,
    status(status) { this.statusCode = status; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { headers[name.toLowerCase()] = value; return this; },
    getHeader(name) { return headers[name.toLowerCase()]; },
  };
}

function envelope(value) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(otpSecret).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: encrypted.toString("base64url"),
  };
}

test("password recovery sends a six-digit code, verifies it, and redeems a one-time reset grant", async () => {
  const requests = [];
  const consumedChallenges = new Set();
  let emailMessage;
  nodemailer.createTransport = () => ({
    async sendMail(message) { emailMessage = message; },
  });
  global.fetch = async (url, options = {}) => {
    const parsedUrl = new URL(url);
    requests.push({ path: `${parsedUrl.pathname}${parsedUrl.search}`, method: options.method || "GET", body: options.body ? JSON.parse(options.body) : null });
    if (parsedUrl.pathname.endsWith("/auth/v1/admin/generate_link")) {
      return { ok: true, status: 200, json: async () => ({ user: { id: "student-user-id" } }) };
    }
    if (parsedUrl.pathname.endsWith("/rest/v1/auth_login_challenges") && !options.method) {
      return { ok: true, status: 200, json: async () => [] };
    }
    if (parsedUrl.pathname.endsWith("/rest/v1/rpc/consume_email_login_challenge")) {
      const requestBody = JSON.parse(options.body);
      if (consumedChallenges.has(requestBody.p_challenge_hash)) {
        return { ok: true, status: 200, json: async () => ({ status: "invalid" }) };
      }
      consumedChallenges.add(requestBody.p_challenge_hash);
      const type = requests.filter(request => request.path.includes("/rpc/")).length === 1
        ? "recovery"
        : "recovery-grant";
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: "verified",
          session: envelope({ type, userId: "student-user-id" }),
        }),
      };
    }
    if (parsedUrl.pathname.endsWith("/auth/v1/admin/users/student-user-id")) {
      return { ok: true, status: 200, json: async () => ({ id: "student-user-id" }) };
    }
    return { ok: true, status: 204, json: async () => ({}) };
  };

  try {
    const startResponse = responseStub();
    await requestPasswordRecovery(
      { method: "POST", body: { email: "student@example.test" } },
      startResponse,
    );
    assert.equal(startResponse.statusCode, 200);
    assert.match(startResponse.body.message, /six-digit verification code/);
    assert.match(emailMessage.subject, /password reset code/i);
    const code = emailMessage.text.match(/code is (\d{6})\./)?.[1];
    assert.ok(code, "Recovery email contains exactly six digits");

    const challengeCookies = startResponse.headers["set-cookie"];
    const challengeCookie = challengeCookies.find(cookie => cookie.startsWith("skillmate_login_challenge="));
    assert.ok(challengeCookie);
    const challengeToken = decodeURIComponent(challengeCookie.split(";")[0].split("=")[1]);

    const verifyResponse = responseStub();
    await verify(
      { method: "POST", cookies: { skillmate_login_challenge: challengeToken }, body: { code } },
      verifyResponse,
    );
    assert.equal(verifyResponse.statusCode, 200);
    assert.deepEqual(verifyResponse.body, { recovery: true });
    const recoveryCookie = verifyResponse.headers["set-cookie"]
      .find(cookie => cookie.startsWith("skillmate_password_recovery="));
    assert.ok(recoveryCookie, "Successful code verification issues the reset-only cookie");
    const recoveryToken = decodeURIComponent(recoveryCookie.split(";")[0].split("=")[1]);

    const updateResponse = responseStub();
    await updateRecoveredPassword(
      {
        method: "PUT",
        cookies: { skillmate_password_recovery: recoveryToken },
        body: { password: "new-password-123" },
      },
      updateResponse,
    );
    assert.equal(updateResponse.statusCode, 200);
    assert.match(updateResponse.body.message, /password has been updated/i);
    const passwordUpdate = requests.find(request => request.path.endsWith("/auth/v1/admin/users/student-user-id"));
    assert.deepEqual(passwordUpdate.body, { password: "new-password-123" });
    assert.equal(updateResponse.body.session, undefined, "Recovery does not issue a sign-in session");
    assert.ok(updateResponse.headers["set-cookie"].some(cookie => cookie.startsWith("skillmate_password_recovery=; Max-Age=0")));
    const replayResponse = responseStub();
    await updateRecoveredPassword(
      {
        method: "PUT",
        cookies: { skillmate_password_recovery: recoveryToken },
        body: { password: "replayed-password-123" },
      },
      replayResponse,
    );
    assert.equal(replayResponse.statusCode, 410, "A redeemed recovery grant cannot be reused");
    assert.equal(requests.filter(request => request.path.endsWith("/auth/v1/admin/users/student-user-id")).length, 1);
  } finally {
    global.fetch = originalFetch;
    nodemailer.createTransport = originalTransport;
  }
});

test("password recovery returns the same response for invalid and unknown-looking addresses", async () => {
  const response = responseStub();
  await requestPasswordRecovery(
    { method: "POST", body: { email: "not-an-email" } },
    response,
  );
  assert.equal(response.statusCode, 200);
  assert.match(response.body.message, /If an account uses this email/);
  assert.equal(response.headers["set-cookie"], undefined);
});

test("password recovery rejects short passwords before consuming the reset grant", async () => {
  const response = responseStub();
  await updateRecoveredPassword(
    {
      method: "PUT",
      cookies: { skillmate_password_recovery: "valid-token" },
      body: { password: "short" },
    },
    response,
  );
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /at least 8 characters/);
});
