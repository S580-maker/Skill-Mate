const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const payouts = require("../api/_lib/paystack-payouts");

const originalFetch = global.fetch;
const envKeys = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PAYSTACK_TRANSFERS_ENABLED",
  "PAYSTACK_TRANSFER_MODE",
  "PAYSTACK_TRANSFER_SECRET_KEY",
];
const originalEnvironment = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const providerId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const recipientId = "33333333-3333-4333-8333-333333333333";
const withdrawalId = "44444444-4444-4444-8444-444444444444";
const idempotencyKey = "55555555-5555-4555-8555-555555555555";
const transferSecret = "sk_live_payoutsecret123";

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
    SUPABASE_URL: "https://payout-test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    PAYSTACK_TRANSFERS_ENABLED: "true",
    PAYSTACK_TRANSFER_MODE: "live",
    PAYSTACK_TRANSFER_SECRET_KEY: transferSecret,
    ...overrides,
  });
}

function token() {
  const payload = Buffer.from(JSON.stringify({
    session_id: sessionId,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString("base64url");
  return `header.${payload}.signature`;
}

function request(body, method = "POST", origin = "https://skillmate.example") {
  return {
    method,
    headers: {
      cookie: `skillmate_session=${token()}`,
      host: "skillmate.example",
      origin,
    },
    body,
  };
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

afterEach(() => {
  global.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

test("payout writes reject cross-origin requests before authentication", async () => {
  configureEnvironment();
  let called = false;
  global.fetch = async () => { called = true; };
  const response = responseStub();
  await payouts.handlePayouts(request({ action: "withdraw" }, "POST", "https://attacker.example"), response);
  assert.equal(response.statusCode, 403);
  assert.equal(called, false);
});

test("payout destination errors do not expose Paystack diagnostics to the client", async () => {
  configureEnvironment();
  global.fetch = async (url) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return jsonResponse({ id: providerId });
    if (target.includes("/verified_auth_sessions?")) return jsonResponse([{ session_id: sessionId }]);
    if (target === "https://api.paystack.co/bank?country=ghana&currency=GHS") {
      return jsonResponse({ status: true, data: [{ code: "TEST", name: "Test Bank", type: "nuban" }] });
    }
    if (target === "https://api.paystack.co/transferrecipient") {
      return jsonResponse({ status: false, message: "Internal gateway diagnostic 8f12c9" });
    }
    assert.fail(`Unexpected payout request: ${target}`);
  };
  const response = responseStub();
  await payouts.handlePayouts(request({
    action: "recipient",
    type: "nuban",
    name: "Student",
    accountNumber: "1234567890",
    bankCode: "TEST",
    bankName: "Test Bank",
  }), response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "We couldn’t verify those payout details. Check the account information and try again.");
  assert.doesNotMatch(response.body.error, /diagnostic|8f12c9/i);
});

test("payout balances remain readable while transfers are disabled", async () => {
  configureEnvironment({ PAYSTACK_TRANSFERS_ENABLED: "false" });
  global.fetch = async url => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return jsonResponse({ id: providerId });
    if (target.includes("/verified_auth_sessions?")) return jsonResponse([{ session_id: sessionId }]);
    if (target.endsWith("/rpc/get_provider_payout_balance")) {
      return jsonResponse([{
        available_minor: 12500, earned_minor: 15000, reserved_minor: 2500,
        pending_minor: 1000, withdrawn_minor: 2500,
      }]);
    }
    if (target.includes("/provider_payout_recipients?")) return jsonResponse([]);
    if (target.includes("/provider_withdrawals?")) return jsonResponse([]);
    if (target.includes("/provider_wallet_ledger?")) return jsonResponse([]);
    assert.fail(`Unexpected payout request: ${target}`);
  };
  const response = responseStub();
  await payouts.handlePayouts(request(undefined, "GET"), response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.availableMinor, 12500);
  assert.equal(response.body.pendingMinor, 1000);
  assert.equal(response.body.withdrawnMinor, 2500);
  assert.equal(response.body.transfersEnabled, false);
});

test("test-mode keys connect to Paystack sandbox without affecting the real payout balance", async () => {
  configureEnvironment({
    PAYSTACK_TRANSFER_MODE: "test",
    PAYSTACK_TRANSFER_SECRET_KEY: "sk_test_transfersandbox123",
  });
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ target, options });
    if (target.endsWith("/auth/v1/user")) return jsonResponse({ id: providerId });
    if (target.includes("/verified_auth_sessions?")) return jsonResponse([{ session_id: sessionId }]);
    if (target.endsWith("/rpc/get_provider_payout_balance")) {
      return jsonResponse([{
        available_minor: 12500, earned_minor: 15000, reserved_minor: 2500,
        pending_minor: 1000, withdrawn_minor: 2500,
      }]);
    }
    if (target.includes("/provider_payout_recipients?")) return jsonResponse([]);
    if (target.includes("/provider_withdrawals?")) return jsonResponse([]);
    if (target.includes("/provider_wallet_ledger?")) return jsonResponse([]);
    if (target === "https://api.paystack.co/bank?country=ghana&currency=GHS") {
      assert.equal(options.headers.authorization, "Bearer sk_test_transfersandbox123");
      return jsonResponse({ status: true, data: [{ code: "TEST", name: "Test MoMo", type: "mobile_money" }] });
    }
    assert.fail(`Unexpected payout request: ${target}`);
  };
  const response = responseStub();
  await payouts.handlePayouts(request(undefined, "GET"), response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.transfersEnabled, true);
  assert.equal(response.body.transferMode, "test");
  assert.equal(response.body.testMode, true);
  assert.equal(response.body.availableMinor, 12500);

  const banks = responseStub();
  await payouts.handlePayouts(request({ action: "banks" }), banks);
  assert.equal(banks.statusCode, 200);
  assert.deepEqual(banks.body.banks, [{ code: "TEST", name: "Test MoMo", type: "mobile_money" }]);
  assert.equal(calls.some(call => call.target.endsWith("/transfer")), false);
});

test("withdrawals reserve funds and wait for an independent Paystack verification before success", async () => {
  configureEnvironment();
  const calls = [];
  let reference = "";
  let verificationCount = 0;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ target, options });
    if (target.endsWith("/auth/v1/user")) return jsonResponse({ id: providerId });
    if (target.includes("/verified_auth_sessions?")) return jsonResponse([{ session_id: sessionId }]);
    if (target.includes("/provider_payout_recipients?")) {
      return jsonResponse([{ id: recipientId, recipient_code: "RCP_test_recipient" }]);
    }
    if (target.endsWith("/rpc/request_provider_withdrawal")) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_provider_id, providerId);
      assert.equal(body.p_recipient_id, recipientId);
      assert.equal(body.p_amount_minor, 2500);
      assert.equal(body.p_idempotency_key, idempotencyKey);
      assert.equal(body.p_test_mode, false);
      assert.match(body.p_reference, /^SKM_WD_/);
      reference = body.p_reference;
      return jsonResponse([{
        id: withdrawalId,
        reference: body.p_reference,
        amount_minor: 2500,
        status: "pending",
      }]);
    }
    if (target.endsWith("/rpc/claim_provider_withdrawal_submission")) {
      assert.deepEqual(JSON.parse(options.body), {
        p_provider_id: providerId,
        p_reference: reference,
      });
      return jsonResponse(true);
    }
    if (target.endsWith(`/transfer/verify/${reference}`)) {
      verificationCount += 1;
      if (verificationCount === 1) return jsonResponse({ status: false }, 404);
      return jsonResponse({
        status: true,
        data: {
          status: "success",
          transfer_code: "TRF_test",
          reference,
          amount: 2500,
          currency: "GHS",
        },
      });
    }
    if (target === "https://api.paystack.co/transfer") {
      assert.equal(options.method, "POST");
      const body = JSON.parse(options.body);
      assert.equal(body.source, "balance");
      assert.equal(body.amount, 2500);
      assert.equal(body.recipient, "RCP_test_recipient");
      return jsonResponse({
        status: true,
        data: {
          status: "success",
          transfer_code: "TRF_test",
          reference: body.reference,
          amount: body.amount,
          currency: "GHS",
        },
      });
    }
    if (target.endsWith("/rpc/record_provider_withdrawal_result")) {
      assert.deepEqual(JSON.parse(options.body), {
        p_reference: reference,
        p_status: "successful",
        p_amount_minor: 2500,
        p_currency: "GHS",
        p_transfer_code: "TRF_test",
        p_gateway_message: null,
        p_source: "paystack",
      });
      return jsonResponse({});
    }
    assert.fail(`Unexpected payout request: ${target}`);
  };
  const response = responseStub();
  await payouts.handlePayouts(request({
    action: "withdraw",
    recipientId,
    amountMinor: 2500,
    idempotencyKey,
  }), response);
  assert.equal(response.statusCode, 202);
  assert.equal(response.body.status, "successful");
  assert.equal(response.body.amountMinor, 2500);
  assert.equal(calls.filter(call => call.target === "https://api.paystack.co/transfer").length, 1);
  assert.equal(verificationCount, 2);
});

test("replaying an idempotency key never submits a second transfer after a verification 404", async () => {
  configureEnvironment();
  const reference = "SKM_WD_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push(target);
    if (target.endsWith("/auth/v1/user")) return jsonResponse({ id: providerId });
    if (target.includes("/verified_auth_sessions?")) return jsonResponse([{ session_id: sessionId }]);
    if (target.includes("/provider_payout_recipients?")) {
      return jsonResponse([{ id: recipientId, recipient_code: "RCP_test_recipient" }]);
    }
    if (target.endsWith("/rpc/request_provider_withdrawal")) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_idempotency_key, idempotencyKey);
      return jsonResponse([{
        id: withdrawalId,
        reference,
        amount_minor: 2500,
        status: "processing",
      }]);
    }
    if (target.endsWith("/rpc/claim_provider_withdrawal_submission")) return jsonResponse(false);
    if (target.endsWith(`/transfer/verify/${reference}`)) return jsonResponse({ status: false }, 404);
    assert.fail(`Unexpected payout request: ${target}`);
  };
  const response = responseStub();
  await payouts.handlePayouts(request({
    action: "withdraw",
    recipientId,
    amountMinor: 2500,
    idempotencyKey,
  }), response);
  assert.equal(response.statusCode, 202);
  assert.equal(response.body.reference, reference);
  assert.equal(response.body.status, "processing");
  assert.equal(calls.filter(url => url === "https://api.paystack.co/transfer").length, 0);
});

test("an accepted transfer response remains processing until verification confirms it", async () => {
  configureEnvironment();
  let reference = "";
  let transferCalls = 0;
  let resultCalls = 0;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return jsonResponse({ id: providerId });
    if (target.includes("/verified_auth_sessions?")) return jsonResponse([{ session_id: sessionId }]);
    if (target.includes("/provider_payout_recipients?")) {
      return jsonResponse([{ id: recipientId, recipient_code: "RCP_test_recipient" }]);
    }
    if (target.endsWith("/rpc/request_provider_withdrawal")) {
      reference = JSON.parse(options.body).p_reference;
      return jsonResponse([{ reference, amount_minor: 2500, status: "pending" }]);
    }
    if (target.endsWith("/rpc/claim_provider_withdrawal_submission")) return jsonResponse(true);
    if (target.endsWith(`/transfer/verify/${reference}`)) return jsonResponse({ status: false }, 404);
    if (target === "https://api.paystack.co/transfer") {
      transferCalls += 1;
      return jsonResponse({
        status: true,
        data: { reference, amount: 2500, currency: "GHS", status: "success" },
      });
    }
    if (target.endsWith("/rpc/record_provider_withdrawal_result")) {
      resultCalls += 1;
      return jsonResponse({});
    }
    assert.fail(`Unexpected payout request: ${target}`);
  };
  const response = responseStub();
  await payouts.handlePayouts(request({
    action: "withdraw", recipientId, amountMinor: 2500, idempotencyKey,
  }), response);
  assert.equal(response.statusCode, 202);
  assert.equal(response.body.status, "processing");
  assert.equal(transferCalls, 1);
  assert.equal(resultCalls, 0);
});

test("definitive Paystack rejection fails the withdrawal instead of reporting success", async () => {
  configureEnvironment();
  let reference = "";
  let recordedFailure = false;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return jsonResponse({ id: providerId });
    if (target.includes("/verified_auth_sessions?")) return jsonResponse([{ session_id: sessionId }]);
    if (target.includes("/provider_payout_recipients?")) {
      return jsonResponse([{ id: recipientId, recipient_code: "RCP_test_recipient" }]);
    }
    if (target.endsWith("/rpc/request_provider_withdrawal")) {
      reference = JSON.parse(options.body).p_reference;
      return jsonResponse([{ reference, amount_minor: 2500, status: "pending" }]);
    }
    if (target.endsWith("/rpc/claim_provider_withdrawal_submission")) return jsonResponse(true);
    if (target.endsWith(`/transfer/verify/${reference}`)) return jsonResponse({ status: false }, 404);
    if (target === "https://api.paystack.co/transfer") {
      return jsonResponse({ status: false, message: "Transfer rejected" }, 400);
    }
    if (target.endsWith("/rpc/record_provider_withdrawal_result")) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_reference, reference);
      assert.equal(body.p_status, "failed");
      assert.equal(body.p_amount_minor, 2500);
      assert.equal(body.p_currency, "GHS");
      assert.equal(body.p_source, "application");
      recordedFailure = true;
      return jsonResponse({});
    }
    assert.fail(`Unexpected payout request: ${target}`);
  };
  const response = responseStub();
  await payouts.handlePayouts(request({
    action: "withdraw", recipientId, amountMinor: 2500, idempotencyKey,
  }), response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.status, "failed");
  assert.equal(recordedFailure, true);
});

test("a transfer verification mismatch is recorded and remains reserved", async () => {
  configureEnvironment();
  const reference = "SKM_WD_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  let mismatchRecorded = false;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return jsonResponse({ id: providerId });
    if (target.includes("/verified_auth_sessions?")) return jsonResponse([{ session_id: sessionId }]);
    if (target.includes("/provider_withdrawals?")) {
      return jsonResponse([{
        reference,
        recipient_id: recipientId,
        amount_minor: 2500,
        status: "processing",
      }]);
    }
    if (target.endsWith(`/transfer/verify/${reference}`)) {
      return jsonResponse({
        status: true,
        data: { reference, amount: 2400, currency: "GHS", status: "success" },
      });
    }
    if (target.endsWith("/rpc/record_provider_payout_mismatch")) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_reference, reference);
      assert.equal(body.p_actual_amount_minor, 2400);
      assert.equal(body.p_source, "reconciliation");
      mismatchRecorded = true;
      return jsonResponse(null);
    }
    assert.fail(`Unexpected payout request: ${target}`);
  };
  const response = responseStub();
  await payouts.handlePayouts(request({ action: "check", reference }), response);
  assert.equal(response.statusCode, 503);
  assert.equal(mismatchRecorded, true);
});

test("sandbox withdrawals use the test key and are marked as simulated", async () => {
  configureEnvironment({
    PAYSTACK_TRANSFER_MODE: "test",
    PAYSTACK_TRANSFER_SECRET_KEY: "sk_test_transfersandbox123",
  });
  let reference = "";
  let verificationCount = 0;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return jsonResponse({ id: providerId });
    if (target.includes("/verified_auth_sessions?")) return jsonResponse([{ session_id: sessionId }]);
    if (target.includes("/provider_payout_recipients?")) {
      assert.match(target, /payout_mode=eq\.test/);
      return jsonResponse([{ id: recipientId, recipient_code: "RCP_test_recipient" }]);
    }
    if (target.includes("/transfer/verify/")) {
      verificationCount += 1;
      if (verificationCount === 1) return jsonResponse({ status: false }, 404);
      return jsonResponse({
        status: true,
        data: {
          reference,
          amount: 2500,
          currency: "GHS",
          status: "success",
          transfer_code: "TRF_test_simulated",
        },
      });
    }
    if (target.endsWith("/rpc/request_provider_withdrawal")) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_test_mode, true);
      reference = body.p_reference;
      return jsonResponse([{
        reference: body.p_reference,
        amount_minor: 2500,
        status: "pending",
        test_mode: true,
      }]);
    }
    if (target.endsWith("/rpc/claim_provider_withdrawal_submission")) return jsonResponse(true);
    if (target === "https://api.paystack.co/transfer") {
      assert.equal(options.headers.authorization, "Bearer sk_test_transfersandbox123");
      const body = JSON.parse(options.body);
      assert.equal(body.amount, 2500);
      return jsonResponse({
        status: true,
        data: {
          domain: "test",
          status: "success",
          transfer_code: "TRF_test_simulated",
          reference: body.reference,
          amount: body.amount,
          currency: "GHS",
        },
      });
    }
    if (target.endsWith("/rpc/record_provider_withdrawal_result")) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_reference, reference);
      assert.equal(body.p_status, "successful");
      assert.equal(body.p_amount_minor, 2500);
      assert.equal(body.p_currency, "GHS");
      return jsonResponse({});
    }
    assert.fail(`Unexpected sandbox request: ${target}`);
  };
  const response = responseStub();
  await payouts.handlePayouts(request({
    action: "withdraw",
    recipientId,
    amountMinor: 2500,
    idempotencyKey,
  }), response);
  assert.equal(response.statusCode, 202);
  assert.equal(response.body.reference, reference);
  assert.equal(response.body.status, "successful");
  assert.equal(verificationCount, 2);
});

test("mobile money numbers are normalized to Ghana country format", () => {
  assert.equal(payouts.normalizeMobileNumber("024 123 4567"), "233241234567");
  assert.equal(payouts.normalizeMobileNumber("+233 24 123 4567"), "233241234567");
  assert.equal(payouts.normalizeMobileNumber("123"), "");
});

test("transfer webhook rejects unsigned events", async () => {
  configureEnvironment();
  let called = false;
  global.fetch = async () => { called = true; };
  const response = responseStub();
  await payouts.handlePaystackTransferWebhook({
    method: "POST",
    rawBody: Buffer.from(JSON.stringify({ event: "transfer.success", data: {} })),
    headers: { "x-paystack-signature": "0".repeat(128) },
  }, response);
  assert.equal(response.statusCode, 401);
  assert.equal(called, false);
});

test("processing withdrawals can be reconciled without creating a duplicate transfer", async () => {
  configureEnvironment();
  const reference = "SKM_WD_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push(target);
    if (target.endsWith("/auth/v1/user")) return jsonResponse({ id: providerId });
    if (target.includes("/verified_auth_sessions?")) return jsonResponse([{ session_id: sessionId }]);
    if (target.includes("/provider_withdrawals?")) {
      return jsonResponse([{
        reference,
        recipient_id: recipientId,
        amount_minor: 2500,
        status: "processing",
      }]);
    }
    if (target.endsWith(`/transfer/verify/${reference}`)) {
      return jsonResponse({
        status: true,
        data: { reference, amount: 2500, currency: "GHS", status: "success", transfer_code: "TRF_test" },
      });
    }
    if (target.endsWith("/rpc/record_provider_withdrawal_result")) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_reference, reference);
      assert.equal(body.p_status, "successful");
      assert.equal(body.p_amount_minor, 2500);
      assert.equal(body.p_currency, "GHS");
      assert.equal(body.p_source, "reconciliation");
      return jsonResponse({});
    }
    assert.fail(`Unexpected payout request: ${target}`);
  };
  const response = responseStub();
  await payouts.handlePayouts(request({ action: "check", reference }), response);
  assert.equal(response.statusCode, 202);
  assert.equal(response.body.status, "successful");
  assert.equal(calls.some(url => url === "https://api.paystack.co/transfer"), false);
});

test("signed successful transfer webhooks are verified before payout state changes", async () => {
  configureEnvironment();
  const reference = "SKM_WD_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const payload = {
    event: "transfer.success",
    data: { reference, amount: 2500, currency: "GHS", transfer_code: "TRF_test" },
  };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = crypto.createHmac("sha512", transferSecret).update(rawBody).digest("hex");
  let recorded = false;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target === `https://api.paystack.co/transfer/verify/${reference}`) {
      return jsonResponse({
        status: true,
        data: { reference, amount: 2500, currency: "GHS", status: "success", transfer_code: "TRF_test" },
      });
    }
    if (target.includes("/provider_withdrawals?")) {
      return jsonResponse([{ amount_minor: 2500, currency: "GHS" }]);
    }
    if (target.endsWith("/rpc/record_provider_withdrawal_result")) {
      const result = JSON.parse(options.body);
      assert.equal(result.p_status, "successful");
      assert.equal(result.p_amount_minor, 2500);
      assert.equal(result.p_currency, "GHS");
      assert.equal(result.p_source, "webhook");
      recorded = true;
      return jsonResponse({});
    }
    assert.fail(`Unexpected webhook request: ${target}`);
  };
  const response = responseStub();
  await payouts.handlePaystackTransferWebhook({
    method: "POST",
    rawBody,
    headers: { "x-paystack-signature": signature },
  }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(recorded, true);
});

test("signed sandbox transfer webhooks are accepted when the transfer key is in test mode", async () => {
  configureEnvironment({
    PAYSTACK_TRANSFER_MODE: "test",
    PAYSTACK_TRANSFER_SECRET_KEY: "sk_test_transfersandbox123",
  });
  const reference = "SKM_WD_cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const payload = {
    event: "transfer.success",
    data: { reference, amount: 2500, currency: "GHS", transfer_code: "TRF_test_sandbox" },
  };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = crypto.createHmac("sha512", "sk_test_transfersandbox123").update(rawBody).digest("hex");
  let recorded = false;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target === `https://api.paystack.co/transfer/verify/${reference}`) {
      return jsonResponse({
        status: true,
        data: { reference, amount: 2500, currency: "GHS", status: "success", transfer_code: "TRF_test_sandbox" },
      });
    }
    if (target.includes("/provider_withdrawals?")) {
      return jsonResponse([{ amount_minor: 2500, currency: "GHS" }]);
    }
    if (target.endsWith("/rpc/record_provider_withdrawal_result")) {
      const result = JSON.parse(options.body);
      assert.equal(result.p_status, "successful");
      assert.equal(result.p_amount_minor, 2500);
      assert.equal(result.p_currency, "GHS");
      assert.equal(result.p_source, "webhook");
      recorded = true;
      return jsonResponse({});
    }
    assert.fail(`Unexpected sandbox webhook request: ${target}`);
  };
  const response = responseStub();
  await payouts.handlePaystackTransferWebhook({
    method: "POST",
    rawBody,
    headers: { "x-paystack-signature": signature },
  }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(recorded, true);
});
