const crypto = require("node:crypto");
const {
  getSessionCookie,
  getSupabaseConfig,
  getSupabaseUser,
  isOtpVerifiedSession,
} = require("./supabase");
const { responseError, validPaystackSignature } = require("./paystack-utils");
const { isSameOrigin, readJson } = require("./request-utils");

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const payoutReferencePattern = /^SKM_WD_[0-9a-f-]{36}$/i;

function getPayoutConfig() {
  const enabled = process.env.PAYSTACK_TRANSFERS_ENABLED?.trim() === "true";
  const secretKey = process.env.PAYSTACK_TRANSFER_SECRET_KEY?.trim() || "";
  const keyMode = /^sk_test_[A-Za-z0-9_-]+$/.test(secretKey)
    ? "test"
    : /^sk_live_[A-Za-z0-9_-]+$/.test(secretKey) ? "live" : "";
  const configuredMode = process.env.PAYSTACK_TRANSFER_MODE?.trim();
  if (!enabled || !keyMode || (configuredMode && configuredMode !== keyMode)) {
    throw new Error("Paystack transfers are not enabled. Enable transfers and configure a matching Paystack test or live transfer key.");
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for withdrawals.");
  return { secretKey, serviceKey, mode: keyMode, testMode: keyMode === "test" };
}

async function authenticateProvider(request, response) {
  const accessToken = getSessionCookie(request);
  if (!accessToken) {
    responseError(response, 401, "Sign in to manage withdrawals.");
    return null;
  }
  try {
    const user = await getSupabaseUser(accessToken);
    if (!user?.id) {
      responseError(response, 401, "Your sign-in session has expired. Please sign in again.");
      return null;
    }
    if (!await isOtpVerifiedSession(accessToken, user.id)) {
      responseError(response, 403, "Verify your sign-in session before managing withdrawals.");
      return null;
    }
    return user;
  } catch (error) {
    console.error("Could not authenticate a Skillmate payout request.", {
      name: error?.name || "Error",
      message: error?.message || "Unknown error",
    });
    responseError(response, 503, "We couldn’t verify your account right now. Please try again.");
    return null;
  }
}

async function databaseRequest(config, serviceKey, path, options = {}) {
  const result = await fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(10000),
  });
  const body = await readJson(result);
  if (!result.ok) {
    const detail = body?.message || body?.error || `HTTP ${result.status}`;
    throw Object.assign(new Error(detail), { statusCode: result.status });
  }
  return body;
}

async function paystackRequest(secretKey, path, options = {}) {
  const result = await fetch(`https://api.paystack.co${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  const body = await readJson(result);
  return { response: result, body };
}

function accountDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeMobileNumber(value) {
  const digits = accountDigits(value);
  if (/^0\d{9}$/.test(digits)) return `233${digits.slice(1)}`;
  if (/^233\d{9}$/.test(digits)) return digits;
  return "";
}

function getRecipientInput(body) {
  const type = body?.type;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const bankCode = typeof body?.bankCode === "string" ? body.bankCode.trim() : "";
  const bankName = typeof body?.bankName === "string" ? body.bankName.trim() : "";
  const rawAccount = typeof body?.accountNumber === "string" ? body.accountNumber.trim() : "";
  if (!["nuban", "mobile_money"].includes(type)
      || name.length < 2 || name.length > 100
      || !/^[A-Za-z0-9_-]{1,30}$/.test(bankCode)
      || bankName.length < 2 || bankName.length > 100) {
    return null;
  }
  if (type === "mobile_money") {
    const accountNumber = normalizeMobileNumber(rawAccount);
    if (!accountNumber) return null;
    return { type, name, bankCode, bankName, accountNumber };
  }
  const accountNumber = accountDigits(rawAccount);
  if (accountNumber.length < 8 || accountNumber.length > 20) return null;
  return { type, name, bankCode, bankName, accountNumber };
}

async function loadPayoutState(config, serviceKey, providerId, payoutMode = "") {
  const testMode = payoutMode === "test";
  const [balanceRows, recipients, withdrawals, ledger] = await Promise.all([
    databaseRequest(config, serviceKey, "/rest/v1/rpc/get_provider_payout_balance", {
      method: "POST",
      body: JSON.stringify({ p_provider_id: providerId }),
    }),
    databaseRequest(config, serviceKey, `/rest/v1/provider_payout_recipients?${new URLSearchParams({
      select: "id,recipient_type,name,bank_name,account_last_four,created_at",
      provider_id: `eq.${providerId}`,
      active: "eq.true",
      ...(payoutMode ? { payout_mode: `eq.${payoutMode}` } : {}),
      order: "created_at.desc",
    })}`),
    databaseRequest(config, serviceKey, `/rest/v1/provider_withdrawals?${new URLSearchParams({
      select: "id,reference,recipient_id,amount_minor,currency,status,test_mode,gateway_message,created_at,updated_at",
      provider_id: `eq.${providerId}`,
      ...(payoutMode ? { test_mode: `eq.${testMode}` } : {}),
      order: "created_at.desc",
      limit: "20",
    })}`),
    databaseRequest(config, serviceKey, `/rest/v1/provider_wallet_ledger?${new URLSearchParams({
      select: "id,entry_type,reference,amount_minor,currency,test_mode,created_at",
      provider_id: `eq.${providerId}`,
      test_mode: `eq.${testMode}`,
      order: "created_at.desc",
      limit: "30",
    })}`),
  ]);
  const balance = Array.isArray(balanceRows) ? balanceRows[0] : balanceRows;
  return {
    availableMinor: Number(balance?.available_minor || 0),
    earnedMinor: Number(balance?.earned_minor || 0),
    reservedMinor: Number(balance?.reserved_minor || 0),
    pendingMinor: Number(balance?.pending_minor || 0),
    withdrawnMinor: Number(balance?.withdrawn_minor || 0),
    recipients,
    withdrawals,
    ledger,
    transfersEnabled: process.env.PAYSTACK_TRANSFERS_ENABLED?.trim() === "true"
      && /^(sk_test_|sk_live_)[A-Za-z0-9_-]+$/.test(process.env.PAYSTACK_TRANSFER_SECRET_KEY?.trim() || ""),
    transferMode: payoutMode,
    testMode: payoutMode === "test",
  };
}

function normalizeTransferStatus(status) {
  if (status === "success") return "successful";
  if (["failed", "reversed"].includes(status)) return status;
  return "processing";
}

async function recordPayoutMismatch(config, serviceKey, withdrawal, transfer, source, details) {
  await databaseRequest(config, serviceKey, "/rest/v1/rpc/record_provider_payout_mismatch", {
    method: "POST",
    body: JSON.stringify({
      p_reference: withdrawal.reference,
      p_actual_amount_minor: Number.isSafeInteger(Number(transfer?.amount)) ? Number(transfer.amount) : null,
      p_actual_currency: typeof transfer?.currency === "string" ? transfer.currency : null,
      p_provider_status: typeof transfer?.status === "string" ? transfer.status : null,
      p_source: source,
      p_details: details,
    }),
  });
}

async function verifyPayoutTransfer(config, payout, withdrawal, source) {
  const result = await paystackRequest(
    payout.secretKey,
    `/transfer/verify/${encodeURIComponent(withdrawal.reference)}`,
  );
  if (result.response.status === 404 && result.body?.status !== true) return null;
  if (!result.response.ok || result.body?.status !== true) {
    throw new Error("Paystack transfer status is temporarily unavailable.");
  }

  const transfer = result.body.data || {};
  if (transfer.reference !== withdrawal.reference
      || Number(transfer.amount) !== Number(withdrawal.amount_minor)
      || String(transfer.currency).toUpperCase() !== "GHS") {
    await recordPayoutMismatch(config, payout.serviceKey, withdrawal, transfer, source,
      "Verified Paystack transfer reference, amount, or currency did not match the reserved withdrawal.");
    throw new Error("Paystack returned a mismatched transfer. The amount remains reserved for review.");
  }
  return transfer;
}

async function recordWithdrawalResult(config, serviceKey, {
  reference, status, amountMinor, currency = "GHS", transferCode, message, source = "paystack",
}) {
  await databaseRequest(config, serviceKey, "/rest/v1/rpc/record_provider_withdrawal_result", {
    method: "POST",
    body: JSON.stringify({
      p_reference: reference,
      p_status: status,
      p_amount_minor: amountMinor,
      p_currency: currency,
      p_transfer_code: typeof transferCode === "string" ? transferCode : null,
      p_gateway_message: typeof message === "string" ? message : null,
      p_source: source,
    }),
  });
}

function transferMessage(transfer, status) {
  if (status !== "processing") return null;
  return transfer.status === "otp"
    ? "Paystack requires additional transfer authorization. Contact Skillmate support with this reference."
    : "Paystack is processing this transfer. Check back for the final status.";
}

async function submitPayoutTransfer(config, payout, withdrawal, destination, allowCreate, source = "paystack") {
  let transfer = await verifyPayoutTransfer(config, payout, withdrawal, source);
  if (!transfer && !allowCreate) return "processing";

  if (!transfer) {
    if (!destination?.recipient_code) throw new Error("The saved payout destination could not be found.");
    let gateway;
    try {
      gateway = await paystackRequest(payout.secretKey, "/transfer", {
        method: "POST",
        body: JSON.stringify({
          source: "balance",
          amount: Number(withdrawal.amount_minor),
          recipient: destination.recipient_code,
          reference: withdrawal.reference,
          reason: "Skillmate provider earnings withdrawal",
        }),
      });
    } catch (error) {
      console.error("Paystack transfer status is uncertain; the withdrawal remains reserved.", {
        name: error?.name || "Error",
        reference: withdrawal.reference,
      });
      throw new Error("Paystack could not confirm the transfer yet. The amount remains reserved until you check its status.");
    }

    if (!gateway.response.ok || gateway.body?.status !== true) {
      if (gateway.response.status === 409) {
        transfer = await verifyPayoutTransfer(config, payout, withdrawal, "reconciliation");
        if (!transfer) return "processing";
      } else if (gateway.response.status < 500) {
        const message = String(gateway.body?.message || "Paystack rejected this transfer.").slice(0, 500);
        await recordWithdrawalResult(config, payout.serviceKey, {
          reference: withdrawal.reference,
          status: "failed",
          amountMinor: Number(withdrawal.amount_minor),
          message,
          source: "application",
        });
        throw Object.assign(new Error(message), { statusCode: 400 });
      } else {
        throw new Error("Paystack could not confirm the transfer yet. The amount remains reserved until you check its status.");
      }
    } else {
      const accepted = gateway.body.data || {};
      if (accepted.reference !== withdrawal.reference
          || Number(accepted.amount) !== Number(withdrawal.amount_minor)
          || String(accepted.currency).toUpperCase() !== "GHS") {
        await recordPayoutMismatch(config, payout.serviceKey, withdrawal, accepted, "paystack",
          "Paystack's transfer response did not match the reserved withdrawal.");
        throw new Error("Paystack returned a mismatched transfer. The amount remains reserved for review.");
      }
      transfer = await verifyPayoutTransfer(config, payout, withdrawal, "paystack");
      if (!transfer) return "processing";
    }
  }

  const status = normalizeTransferStatus(transfer.status);
  await recordWithdrawalResult(config, payout.serviceKey, {
    reference: withdrawal.reference,
    status,
    amountMinor: Number(transfer.amount),
    currency: transfer.currency,
    transferCode: transfer.transfer_code,
    message: transferMessage(transfer, status),
    source,
  });
  return status;
}

async function handlePayouts(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return responseError(response, 405, "Method not allowed.");
  }
  if (request.method === "POST" && !isSameOrigin(request)) {
    return responseError(response, 403, "This action must be submitted from Skillmate.");
  }

  const user = await authenticateProvider(request, response);
  if (!user) return;

  let config;
  let payout;
  try {
    config = getSupabaseConfig();
    payout = getPayoutConfig();
  } catch (error) {
    if (request.method === "GET" && error.message.startsWith("Paystack transfers are not enabled")) {
      try {
        config = getSupabaseConfig();
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
        if (!serviceKey) throw error;
        const state = await loadPayoutState(config, serviceKey, user.id);
        state.transfersEnabled = false;
        state.transferMode = "";
        state.testMode = false;
        return response.status(200).json(state);
      } catch (loadError) {
        console.error("Could not load Skillmate payout details.", {
          name: loadError?.name || "Error",
          message: loadError?.message || "Unknown error",
        });
        return responseError(response, 503, "Withdrawal details are temporarily unavailable.");
      }
    }
    console.error("Paystack withdrawals are not configured.", {
      name: error?.name || "Error",
      message: error?.message || "Unknown error",
    });
    return responseError(response, 503, "Paystack withdrawals are not configured on the server.");
  }

  try {
    if (request.method === "GET") {
      const state = await loadPayoutState(config, payout.serviceKey, user.id, payout.mode);
      return response.status(200).json(state);
    }

    const action = request.body?.action;
    if (action === "banks") {
      const result = await paystackRequest(payout.secretKey, "/bank?country=ghana&currency=GHS");
      if (!result.response.ok || result.body?.status !== true || !Array.isArray(result.body.data)) {
        console.error("Paystack did not return Ghana payout destinations.", {
          status: result.response.status,
          message: result.body?.message || "",
        });
        return responseError(response, 502, "Could not load Paystack payout destinations.");
      }
      const banks = result.body.data
        .filter((bank) => typeof bank.code === "string" && typeof bank.name === "string")
        .map((bank) => ({ code: bank.code, name: bank.name, type: bank.type || "" }));
      return response.status(200).json({ banks });
    }

    if (action === "recipient") {
      const recipient = getRecipientInput(request.body);
      if (!recipient) {
        return responseError(response, 400, "Enter a valid Ghana bank or mobile-money payout account.");
      }
      const bankList = await paystackRequest(payout.secretKey, "/bank?country=ghana&currency=GHS");
      const bank = bankList.body?.data?.find(item => item.code === recipient.bankCode);
      if (!bankList.response.ok || bankList.body?.status !== true || !bank) {
        return responseError(response, 400, "Choose a bank or mobile-money network listed by Paystack.");
      }
      const gateway = await paystackRequest(payout.secretKey, "/transferrecipient", {
        method: "POST",
        body: JSON.stringify({
          type: recipient.type,
          name: recipient.name,
          account_number: recipient.accountNumber,
          bank_code: recipient.bankCode,
          currency: "GHS",
        }),
      });
      if (!gateway.response.ok || gateway.body?.status !== true
          || typeof gateway.body?.data?.recipient_code !== "string") {
        console.error("Paystack did not accept a provider payout recipient.", {
          status: gateway.response.status,
          message: gateway.body?.message || "",
        });
        return responseError(response, 400, "We couldn’t verify those payout details. Check the account information and try again.");
      }

      const safeAccountNumber = recipient.type === "mobile_money"
        ? normalizeMobileNumber(recipient.accountNumber) : accountDigits(recipient.accountNumber);
      const inserted = await databaseRequest(config, payout.serviceKey, "/rest/v1/provider_payout_recipients", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          provider_id: user.id,
          recipient_code: gateway.body.data.recipient_code,
          recipient_type: recipient.type,
          name: recipient.name,
          bank_code: recipient.bankCode,
          bank_name: bank.name,
          account_last_four: safeAccountNumber.slice(-4),
          payout_mode: payout.mode,
        }),
      });
      const saved = inserted?.[0];
      if (!saved?.id) throw new Error("Supabase did not confirm the payout destination.");
      return response.status(201).json({
        recipient: {
          id: saved.id,
          recipientType: saved.recipient_type,
          name: saved.name,
          bankName: saved.bank_name,
          accountLastFour: saved.account_last_four,
        },
      });
    }

    if (action === "check") {
      const { reference } = request.body || {};
      if (!payoutReferencePattern.test(String(reference || ""))) {
        return responseError(response, 400, "Provide a valid withdrawal reference.");
      }
      const withdrawals = await databaseRequest(config, payout.serviceKey, `/rest/v1/provider_withdrawals?${new URLSearchParams({
        select: "id,reference,recipient_id,amount_minor,status",
        provider_id: `eq.${user.id}`,
        reference: `eq.${reference}`,
        test_mode: `eq.${payout.testMode}`,
        limit: "1",
      })}`);
      const withdrawal = withdrawals?.[0];
      if (!withdrawal) return responseError(response, 404, "Withdrawal not found.");
      if (!["pending", "processing"].includes(withdrawal.status)) {
        return response.status(200).json({ reference, status: withdrawal.status });
      }
      let allowCreate = false;
      if (withdrawal.status === "pending") {
        const claimed = await databaseRequest(config, payout.serviceKey, "/rest/v1/rpc/claim_provider_withdrawal_submission", {
          method: "POST",
          body: JSON.stringify({ p_provider_id: user.id, p_reference: reference }),
        });
        allowCreate = claimed === true;
      }
      let destination = null;
      if (allowCreate) {
        const recipients = await databaseRequest(config, payout.serviceKey, `/rest/v1/provider_payout_recipients?${new URLSearchParams({
          select: "recipient_code",
          id: `eq.${withdrawal.recipient_id}`,
          provider_id: `eq.${user.id}`,
          payout_mode: `eq.${payout.mode}`,
          limit: "1",
        })}`);
        destination = recipients?.[0];
      }
      const status = await submitPayoutTransfer(
        config, payout, withdrawal, destination, allowCreate, "reconciliation",
      );
      return response.status(202).json({ reference, status, amountMinor: Number(withdrawal.amount_minor) });
    }

    if (action === "withdraw") {
      const { recipientId, amountMinor, idempotencyKey } = request.body || {};
      if (!uuidPattern.test(String(recipientId || ""))
          || !Number.isSafeInteger(amountMinor) || amountMinor <= 0
          || !uuidPattern.test(String(idempotencyKey || ""))) {
        return responseError(response, 400, "Provide a valid payout destination and withdrawal amount.");
      }
      const destinations = await databaseRequest(config, payout.serviceKey, `/rest/v1/provider_payout_recipients?${new URLSearchParams({
        select: "id,recipient_code,payout_mode",
        id: `eq.${recipientId}`,
        provider_id: `eq.${user.id}`,
        active: "eq.true",
        payout_mode: `eq.${payout.mode}`,
        limit: "1",
      })}`);
      const destination = destinations?.[0];
      if (!destination) return responseError(response, 400, "Choose an active payout destination on your account.");

      const reference = `SKM_WD_${crypto.randomUUID()}`;
      const reservedRows = await databaseRequest(config, payout.serviceKey, "/rest/v1/rpc/request_provider_withdrawal", {
        method: "POST",
        body: JSON.stringify({
          p_provider_id: user.id,
          p_recipient_id: recipientId,
          p_amount_minor: amountMinor,
          p_idempotency_key: idempotencyKey,
          p_reference: reference,
          p_test_mode: payout.testMode,
        }),
      });
      const withdrawal = Array.isArray(reservedRows) ? reservedRows[0] : reservedRows;
      if (!withdrawal?.reference) throw new Error("Supabase did not confirm the withdrawal reservation.");
      if (!["pending", "processing"].includes(withdrawal.status)) {
        return response.status(200).json({
          reference: withdrawal.reference,
          status: withdrawal.status,
          amountMinor: Number(withdrawal.amount_minor),
        });
      }
      try {
        const claimed = await databaseRequest(config, payout.serviceKey, "/rest/v1/rpc/claim_provider_withdrawal_submission", {
          method: "POST",
          body: JSON.stringify({ p_provider_id: user.id, p_reference: withdrawal.reference }),
        });
        const status = await submitPayoutTransfer(
          config, payout, withdrawal, destination, claimed === true,
        );
        return response.status(202).json({
          reference: withdrawal.reference,
          status,
          amountMinor: Number(withdrawal.amount_minor),
        });
      } catch (error) {
        if (error.statusCode === 400) {
          return response.status(400).json({
            error: "The payout provider couldn’t complete this transfer. Check your withdrawal history before trying again.",
            reference: withdrawal.reference,
            status: "failed",
          });
        }
        console.error("Could not confirm the Paystack withdrawal transfer.", {
          name: error?.name || "Error",
          reference: withdrawal.reference,
          message: error?.message || "Unknown error",
        });
        return response.status(503).json({
          error: "We couldn’t confirm this transfer yet. Your amount remains reserved; check your withdrawal history before trying again.",
          reference: withdrawal.reference,
          status: "processing",
        });
      }
    }

    return responseError(response, 400, "Choose a valid payout action.");
  } catch (error) {
    console.error("Could not process a Skillmate payout request.", {
      name: error?.name || "Error",
      message: error?.message || "Unknown error",
    });
    if ([400, 409].includes(error.statusCode)) {
      return responseError(response, 400,
        "We couldn’t accept this withdrawal. Check your available balance and payout details, then try again.");
    }
    return responseError(response, 503, "Skillmate could not complete this payout request. Check withdrawal history before retrying.");
  }
}

function rawRequestBody(request) {
  if (Buffer.isBuffer(request.rawBody)) return request.rawBody;
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === "string") return Buffer.from(request.body);
  if (request.body && typeof request.body === "object") return Buffer.from(JSON.stringify(request.body));
  return Buffer.alloc(0);
}

async function handlePaystackTransferWebhook(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return responseError(response, 405, "Method not allowed.");
  }
  let payout;
  try {
    payout = getPayoutConfig();
  } catch (error) {
    console.error("Paystack transfer webhook is not configured.", error);
    return responseError(response, 503, "Paystack transfer webhook is not configured.");
  }
  const rawBody = rawRequestBody(request);
  const signature = request.headers?.["x-paystack-signature"] || request.get?.("x-paystack-signature");
  if (!validPaystackSignature(rawBody, signature, payout.secretKey)) {
    return responseError(response, 401, "Invalid transfer webhook signature.");
  }
  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return responseError(response, 400, "Invalid transfer webhook payload.");
  }
  if (!["transfer.success", "transfer.failed", "transfer.reversed"].includes(payload?.event)) {
    return response.status(200).json({ received: true, ignored: true });
  }

  const eventData = payload.data || {};
  const reference = String(eventData.reference || "");
  if (!payoutReferencePattern.test(reference)) {
    return responseError(response, 400, "Transfer webhook is missing a valid withdrawal reference.");
  }
  try {
    const verified = await paystackRequest(payout.secretKey, `/transfer/verify/${encodeURIComponent(reference)}`);
    const transfer = verified.body?.data;
    const expectedStatus = {
      "transfer.success": "success",
      "transfer.failed": "failed",
      "transfer.reversed": "reversed",
    }[payload.event];
    if (!verified.response.ok || verified.body?.status !== true) {
      return responseError(response, 400, "Paystack transfer event did not match the verified withdrawal.");
    }
    const config = getSupabaseConfig();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
    if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to reconcile withdrawals.");
    const withdrawals = await databaseRequest(config, serviceKey, `/rest/v1/provider_withdrawals?${new URLSearchParams({
      select: "amount_minor,currency",
      reference: `eq.${reference}`,
      limit: "1",
    })}`);
    const withdrawal = withdrawals?.[0];
    if (!withdrawal) return responseError(response, 404, "Withdrawal not found.");
    if (transfer?.reference !== reference
        || Number(transfer.amount) !== Number(withdrawal.amount_minor)
        || String(transfer.currency).toUpperCase() !== withdrawal.currency
        || Number(transfer.amount) !== Number(eventData.amount)
        || Number(transfer.amount) <= 0
        || String(transfer.currency).toUpperCase() !== "GHS"
        || transfer?.status !== expectedStatus) {
      await recordPayoutMismatch(config, serviceKey, {
        reference,
        amount_minor: withdrawal.amount_minor,
      }, transfer, "webhook",
      "Signed transfer webhook did not match the independently verified Paystack transfer.");
      return responseError(response, 400, "Paystack transfer event did not match the verified withdrawal.");
    }
    await recordWithdrawalResult(config, serviceKey, {
      reference,
      status: normalizeTransferStatus(transfer.status),
      amountMinor: Number(transfer.amount),
      currency: transfer.currency,
      transferCode: typeof transfer.transfer_code === "string" ? transfer.transfer_code : null,
      message: typeof transfer.reason === "string" ? transfer.reason.slice(0, 500) : null,
      source: "webhook",
    });
    return response.status(200).json({ received: true });
  } catch (error) {
    console.error("Could not reconcile a verified Paystack transfer webhook.", {
      name: error?.name || "Error",
      message: error?.message || "Unknown error",
    });
    return responseError(response, 503, "Transfer status could not be recorded.");
  }
}

module.exports = {
  getPayoutConfig,
  handlePayouts,
  handlePaystackTransferWebhook,
  normalizeMobileNumber,
};
