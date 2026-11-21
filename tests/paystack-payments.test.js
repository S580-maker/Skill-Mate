const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const payments = require("../api/_lib/paystack-payments");

const originalFetch = global.fetch;
const envKeys = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PAYSTACK_PUBLIC_KEY",
  "PAYSTACK_SECRET_KEY",
  "SKILLMATE_BOOKING_FEE_BPS",
];
const originalEnvironment = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const customerId = "22222222-2222-4222-8222-222222222222";
const sessionId = "11111111-1111-4111-8111-111111111111";
const bookingId = "33333333-3333-4333-8333-333333333333";
const reference = "SKM_44444444-4444-4444-8444-444444444444";
const secretKey = "sk_test_paymentssecret123";

function responseStub() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(status) { this.statusCode = status; return this; },
    json(body) { this.body = body; return this; },
  };
}

function configureEnvironment(overrides = {}) {
  Object.assign(process.env, {
    SUPABASE_URL: "https://payments-test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    PAYSTACK_PUBLIC_KEY: "pk_test_paymentspublic123",
    PAYSTACK_SECRET_KEY: secretKey,
    SKILLMATE_BOOKING_FEE_BPS: "500",
    ...overrides,
  });
}

function sessionToken() {
  const payload = Buffer.from(JSON.stringify({
    session_id: sessionId,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString("base64url");
  return `header.${payload}.signature`;
}

function paymentRequest(body = {}) {
  return {
    method: "POST",
    headers: { cookie: `skillmate_session=${sessionToken()}` },
    body: { bookingId, ...body },
  };
}

function webhookRequest(payload, signingKey = secretKey) {
  const rawBody = Buffer.from(JSON.stringify(payload));
  return {
    method: "POST",
    rawBody,
    headers: {
      "x-paystack-signature": crypto.createHmac("sha512", signingKey).update(rawBody).digest("hex"),
    },
  };
}

function jsonResponse(body, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => body };
}

afterEach(() => {
  global.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

test("payment amounts use minor units and enforce test-only Paystack keys", () => {
  assert.deepEqual(payments.paymentAmounts(42.5, 500), {
    serviceAmountMinor: 4250,
    bookingFeeMinor: 213,
    totalAmountMinor: 4463,
  });
  configureEnvironment({ PAYSTACK_SECRET_KEY: "sk_live_not-allowed" });
  assert.throws(() => payments.getPaystackConfig(), /test keys are not configured/);
});

test("payment quote authenticates a verified customer and calculates the fee from the accepted booking", async () => {
  configureEnvironment();
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith("/auth/v1/user")) {
      return jsonResponse({ id: customerId, email: "customer@example.test" });
    }
    if (String(url).includes("/verified_auth_sessions?")) {
      return jsonResponse([{ session_id: sessionId }]);
    }
    if (String(url).includes("/rest/v1/bookings?")) {
      return jsonResponse([{
        id: bookingId,
        customer_id: customerId,
        status: "pending",
        agreed_price: 42.5,
        currency: "GHS",
        provider_accepted_at: "2026-01-01T10:00:00Z",
        payment_status: "awaiting_payment",
      }]);
    }
    assert.fail(`Unexpected payment quote request: ${url}`);
  };
  const response = responseStub();
  await payments.handlePaymentQuote(paymentRequest(), response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    serviceAmountMinor: 4250,
    bookingFeeMinor: 213,
    totalAmountMinor: 4463,
    currency: "GHS",
    feeBasisPoints: 500,
    paymentAvailable: true,
    testMode: true,
  });
  assert.equal(calls.length, 3);
});

test("payment quote still shows authorized booking prices when Paystack test keys are missing", async () => {
  configureEnvironment();
  delete process.env.PAYSTACK_PUBLIC_KEY;
  delete process.env.PAYSTACK_SECRET_KEY;
  global.fetch = async (url) => {
    if (String(url).endsWith("/auth/v1/user")) {
      return jsonResponse({ id: customerId, email: "customer@example.test" });
    }
    if (String(url).includes("/verified_auth_sessions?")) {
      return jsonResponse([{ session_id: sessionId }]);
    }
    if (String(url).includes("/rest/v1/bookings?")) {
      return jsonResponse([{
        id: bookingId,
        customer_id: customerId,
        status: "pending",
        agreed_price: 42.5,
        currency: "GHS",
        provider_accepted_at: "2026-01-01T10:00:00Z",
        payment_status: "awaiting_payment",
      }]);
    }
    assert.fail(`Unexpected payment quote request: ${url}`);
  };
  const response = responseStub();
  await payments.handlePaymentQuote(paymentRequest(), response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.serviceAmountMinor, 4250);
  assert.equal(response.body.bookingFeeMinor, 213);
  assert.equal(response.body.totalAmountMinor, 4463);
  assert.equal(response.body.paymentAvailable, false);
});

test("payment quote does not expose database errors to the client", async () => {
  configureEnvironment();
  global.fetch = async (url) => {
    if (String(url).endsWith("/auth/v1/user")) {
      return jsonResponse({ id: customerId, email: "customer@example.test" });
    }
    if (String(url).includes("/verified_auth_sessions?")) return jsonResponse([{ session_id: sessionId }]);
    if (String(url).includes("/rest/v1/bookings?")) {
      return jsonResponse({ message: "relation private.payment_schema does not exist" }, false);
    }
    assert.fail(`Unexpected payment quote request: ${url}`);
  };
  const response = responseStub();
  await payments.handlePaymentQuote(paymentRequest(), response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error, "Payment details are temporarily unavailable. Please try again shortly.");
  assert.doesNotMatch(response.body.error, /private|schema|relation/i);
});

test("verified successful payments are finalized even when the webhook is delayed", async () => {
  configureEnvironment();
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push(target);
    if (target.endsWith("/auth/v1/user")) {
      return jsonResponse({ id: customerId, email: "customer@example.test" });
    }
    if (target.includes("/verified_auth_sessions?")) {
      return jsonResponse([{ session_id: sessionId }]);
    }
    if (target.includes("/paystack_payment_attempts?")) {
      return jsonResponse([{ reference, status: "pending", total_amount_minor: 4463 }]);
    }
    if (target.startsWith("https://api.paystack.co/transaction/verify/")) {
      return jsonResponse({
        status: true,
        data: { id: 98765, reference, status: "success", amount: 4463, currency: "GHS" },
      });
    }
    if (target.endsWith("/rpc/apply_paystack_payment_event")) {
      return jsonResponse("processing");
    }
    if (target.endsWith("/rpc/finalize_verified_paystack_payment")) {
      assert.deepEqual(JSON.parse(options.body), { p_reference: reference });
      return jsonResponse("paid");
    }
    assert.fail(`Unexpected payment verification request: ${target}`);
  };
  const response = responseStub();
  await payments.handlePaymentVerify(paymentRequest({ reference }), response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { status: "paid", testMode: true });
  assert.equal(calls.at(-1), "https://payments-test.supabase.co/rest/v1/rpc/finalize_verified_paystack_payment");
});

test("webhook rejects invalid signatures before contacting payment or database services", async () => {
  configureEnvironment();
  let called = false;
  global.fetch = async () => { called = true; };
  const request = webhookRequest({ event: "charge.success", data: {} }, "sk_test_wrongkey123");
  const response = responseStub();
  await payments.handlePaystackWebhook(request, response);
  assert.equal(response.statusCode, 401);
  assert.equal(called, false);
});

test("signed successful charge is verified with Paystack before its webhook event is recorded", async () => {
  configureEnvironment();
  const payload = {
    event: "charge.success",
    data: { id: 98765, reference, amount: 4463, currency: "GHS" },
  };
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).startsWith("https://api.paystack.co/transaction/verify/")) {
      return jsonResponse({
        status: true,
        data: { id: 98765, reference, status: "success", amount: 4463, currency: "GHS" },
      });
    }
    if (String(url).endsWith("/rpc/apply_paystack_payment_event")) {
      const event = JSON.parse(options.body);
      assert.deepEqual(event, {
        p_reference: reference,
        p_event_status: "success",
        p_transaction_id: 98765,
        p_amount_minor: 4463,
        p_currency: "GHS",
        p_event_key: "charge.success:98765",
        p_source: "webhook",
      });
      return jsonResponse("paid");
    }
    assert.fail(`Unexpected webhook request: ${url}`);
  };
  const response = responseStub();
  await payments.handlePaystackWebhook(webhookRequest(payload), response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { received: true });
  assert.equal(calls.length, 2);
});
