const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const auth = require("../api/_lib/email-2fa");

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

function responseStub() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {},
  };
}

const validSignup = { email: "student@example.test", password: "a valid password", fullName: "Test Student", university: "Test University" };
const invalidValues = [null, 123456, true, [], {}, { toString: null }];

test("auth endpoints reject non-string fields without coercion or upstream calls", async () => {
  let upstreamCalls = 0;
  global.fetch = async () => { upstreamCalls++; throw new Error("Unexpected upstream call"); };
  const cases = [
    { handler: "signIn", fields: ["email", "password"], body: validSignup, status: 400 },
    { handler: "signUp", fields: Object.keys(validSignup), body: validSignup, status: 400 },
    { handler: "requestPasswordRecovery", fields: ["email"], body: validSignup, status: 200 },
    { handler: "updateRecoveredPassword", fields: ["password"], body: validSignup, method: "PUT", status: 400 },
    { handler: "verify", fields: ["code"], body: { code: "123456" }, status: 400 },
    { handler: "googleSignIn", fields: ["refresh_token"], body: { refresh_token: "fixture-refresh" }, status: 401 },
    { handler: "sessionSignIn", fields: ["refresh_token"], body: { refresh_token: "fixture-refresh" }, status: 401 },
  ];
  for (const scenario of cases) {
    for (const field of scenario.fields) {
      for (const value of invalidValues) {
        const response = responseStub();
        await auth[scenario.handler]({
          method: scenario.method || "POST",
          body: { ...scenario.body, [field]: value },
          cookies: { skillflex_login_challenge: "fixture", skillflex_password_recovery: "fixture" },
          headers: { authorization: "Bearer fixture-token" },
        }, response);
        assert.equal(response.statusCode, scenario.status, `${scenario.handler}: ${field}=${JSON.stringify(value)}`);
      }
    }
  }
  assert.equal(upstreamCalls, 0);
});

test("email input has a bounded length before any authentication request", async () => {
  let upstreamCalls = 0;
  global.fetch = async () => { upstreamCalls++; throw new Error("Unexpected upstream call"); };
  for (const handler of ["signIn", "signUp", "requestPasswordRecovery"]) {
    const response = responseStub();
    await auth[handler]({ method: "POST", body: { ...validSignup, email: `${"a".repeat(255)}@example.test` } }, response);
    assert.equal(response.statusCode, handler === "requestPasswordRecovery" ? 200 : 400);
  }
  assert.equal(upstreamCalls, 0);
});
