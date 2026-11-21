const crypto = require("node:crypto");
const {
  getSessionCookie,
  getSupabaseConfig,
  getSupabaseUser,
  isOtpVerifiedSession,
} = require("./supabase");
const { responseError, validPaystackSignature } = require("./paystack-utils");

const bookingIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const paymentReferencePattern = /^SKM_[0-9a-f-]{36}$/i;

class PaymentRequestError extends Error {}

function getPaymentSettings() {
  const configuredFee = process.env.SKILLMATE_BOOKING_FEE_BPS?.trim();
  const feeBasisPoints = configuredFee === undefined || configuredFee === ""
    ? 500
    : Number(configuredFee);
  if (!Number.isInteger(feeBasisPoints) || feeBasisPoints < 0 || feeBasisPoints > 2000) {
    throw new Error("SKILLMATE_BOOKING_FEE_BPS must be a whole number between 0 and 2000.");
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for payments.");
  return { feeBasisPoints, serviceKey };
}

function getPaystackConfig() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim() || "";
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY?.trim() || "";
  if (!/^sk_test_[A-Za-z0-9_-]+$/.test(secretKey) || !/^pk_test_[A-Za-z0-9_-]+$/.test(publicKey)) {
    throw new Error("Paystack test keys are not configured. Live keys are not supported.");
  }
  return { ...getPaymentSettings(), secretKey, publicKey };
}

async function authenticateCustomer(request, response) {
  const accessToken = getSessionCookie(request);
  if (!accessToken) {
    responseError(response, 401, "Sign in to continue with payment.");
    return null;
  }
  try {
    const user = await getSupabaseUser(accessToken);
    if (!user?.id) {
      responseError(response, 401, "Your sign-in session has expired. Please sign in again.");
      return null;
    }
    if (!await isOtpVerifiedSession(accessToken, user.id)) {
      responseError(response, 403, "Verify your sign-in session before making a payment.");
      return null;
    }
    if (!user.email) {
      responseError(response, 400, "Add an email address to your account before paying.");
      return null;
    }
    return { user, accessToken };
  } catch (error) {
    console.error("Could not authenticate a Skillmate payment request.", error);
    responseError(response, 503, "We couldn’t verify your account right now. Please try again.");
    return null;
  }
}

async function supabaseRequest(config, serviceKey, path, options = {}) {
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
  const body = await result.json().catch(() => null);
  if (!result.ok) {
    const detail = body?.message || body?.error || `HTTP ${result.status}`;
    throw new Error(`Supabase payment request failed: ${detail}`);
  }
  return body;
}

function paymentAmounts(agreedPrice, feeBasisPoints) {
  const price = Number(agreedPrice);
  if (!Number.isFinite(price) || price <= 0 || price > 99999999.99) {
    throw new PaymentRequestError("This booking has an invalid service price. Contact support for help.");
  }
  const serviceAmountMinor = Math.round(price * 100);
  const bookingFeeMinor = Math.round(serviceAmountMinor * feeBasisPoints / 10000);
  return {
    serviceAmountMinor,
    bookingFeeMinor,
    totalAmountMinor: serviceAmountMinor + bookingFeeMinor,
  };
}

async function loadAcceptedBooking(config, serviceKey, bookingId, customerId, feeBasisPoints) {
  if (!bookingIdPattern.test(bookingId || "")) return null;
  const query = new URLSearchParams({
    select: "id,customer_id,status,agreed_price,currency,provider_accepted_at,payment_status",
    id: `eq.${bookingId}`,
    customer_id: `eq.${customerId}`,
    limit: "1",
  });
  const rows = await supabaseRequest(config, serviceKey, `/rest/v1/bookings?${query}`);
  const booking = rows?.[0];
  if (!booking) return null;
  if (booking.status !== "pending" || !booking.provider_accepted_at
      || !["awaiting_payment", "processing", "failed"].includes(booking.payment_status)) {
    throw new PaymentRequestError("This booking is not ready for payment yet. Refresh your bookings and try again.");
  }
  if (booking.currency !== "GHS") {
    throw new PaymentRequestError("Online payment is currently available for GHS bookings only.");
  }
  return { ...booking, ...paymentAmounts(booking.agreed_price, feeBasisPoints) };
}

async function handlePaymentQuote(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return responseError(response, 405, "Method not allowed.");
  }
  const authenticated = await authenticateCustomer(request, response);
  if (!authenticated) return;
  try {
    const { serviceKey, feeBasisPoints } = getPaymentSettings();
    const config = getSupabaseConfig();
    const booking = await loadAcceptedBooking(
      config, serviceKey, request.body?.bookingId, authenticated.user.id, feeBasisPoints,
    );
    if (!booking) return responseError(response, 404, "Accepted booking not found.");
    const paymentAvailable = /^sk_test_[A-Za-z0-9_-]+$/.test(process.env.PAYSTACK_SECRET_KEY?.trim() || "")
      && /^pk_test_[A-Za-z0-9_-]+$/.test(process.env.PAYSTACK_PUBLIC_KEY?.trim() || "");
    return response.status(200).json({
      serviceAmountMinor: booking.serviceAmountMinor,
      bookingFeeMinor: booking.bookingFeeMinor,
      totalAmountMinor: booking.totalAmountMinor,
      currency: booking.currency,
      feeBasisPoints,
      paymentAvailable,
      testMode: true,
    });
  } catch (error) {
    console.error("Could not prepare the Skillmate payment quote.", error);
    return responseError(response, error instanceof PaymentRequestError ? 400 : 503,
      error instanceof PaymentRequestError
        ? error.message
        : "Payment details are temporarily unavailable. Please try again shortly.");
  }
}

async function handlePaymentInitialize(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return responseError(response, 405, "Method not allowed.");
  }
  const authenticated = await authenticateCustomer(request, response);
  if (!authenticated) return;
  try {
    const paystack = getPaystackConfig();
    const config = getSupabaseConfig();
    const booking = await loadAcceptedBooking(
      config, paystack.serviceKey, request.body?.bookingId, authenticated.user.id, paystack.feeBasisPoints,
    );
    if (!booking) return responseError(response, 404, "Accepted booking not found.");
    const reference = `SKM_${crypto.randomUUID()}`;
    const attempts = await supabaseRequest(config, paystack.serviceKey, "/rest/v1/rpc/create_paystack_payment_attempt", {
      method: "POST",
      body: JSON.stringify({
        p_booking_id: booking.id,
        p_customer_id: authenticated.user.id,
        p_reference: reference,
        p_fee_basis_points: paystack.feeBasisPoints,
      }),
    });
    const attempt = Array.isArray(attempts) ? attempts[0] : attempts;
    if (!attempt?.reference || attempt.status !== "pending") {
      throw new Error("The payment attempt could not be prepared.");
    }
    return response.status(200).json({
      publicKey: paystack.publicKey,
      email: authenticated.user.email,
      reference: attempt.reference,
      serviceAmountMinor: Number(attempt.service_amount_minor),
      bookingFeeMinor: Number(attempt.booking_fee_minor),
      totalAmountMinor: Number(attempt.total_amount_minor),
      currency: attempt.currency,
      feeBasisPoints: paystack.feeBasisPoints,
      testMode: true,
    });
  } catch (error) {
    console.error("Could not initialize the Skillmate Paystack payment.", error);
    return responseError(response, error instanceof PaymentRequestError ? 400 : 503,
      error instanceof PaymentRequestError
        ? error.message
        : "We couldn’t start your payment right now. Please try again shortly.");
  }
}

async function applyPaymentEvent(config, serviceKey, event) {
  return supabaseRequest(config, serviceKey, "/rest/v1/rpc/apply_paystack_payment_event", {
    method: "POST",
    body: JSON.stringify({
      p_reference: event.reference,
      p_event_status: event.status,
      p_transaction_id: event.transactionId,
      p_amount_minor: event.amountMinor,
      p_currency: event.currency,
      p_event_key: event.eventKey,
      p_source: event.source,
    }),
  });
}

async function verifyPaystackTransaction(paystack, reference) {
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { authorization: `Bearer ${paystack.secretKey}` }, signal: AbortSignal.timeout(10000) },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.status !== true || result.data?.reference !== reference) {
    throw new Error("Paystack could not verify this transaction.");
  }
  return result.data;
}

async function handlePaymentVerify(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return responseError(response, 405, "Method not allowed.");
  }
  const authenticated = await authenticateCustomer(request, response);
  if (!authenticated) return;
  const reference = String(request.body?.reference || "");
  if (!paymentReferencePattern.test(reference)) {
    return responseError(response, 400, "Payment reference is invalid.");
  }
  try {
    const paystack = getPaystackConfig();
    const config = getSupabaseConfig();
    const query = new URLSearchParams({
      select: "reference,status,total_amount_minor",
      reference: `eq.${reference}`,
      customer_id: `eq.${authenticated.user.id}`,
      limit: "1",
    });
    const attempts = await supabaseRequest(config, paystack.serviceKey, `/rest/v1/paystack_payment_attempts?${query}`);
    const attempt = attempts?.[0];
    if (!attempt) return responseError(response, 404, "Payment attempt not found.");
    if (attempt.status !== "pending") {
      return response.status(200).json({ status: attempt.status, testMode: true });
    }
    const transaction = await verifyPaystackTransaction(paystack, reference);
    const transactionStatus = transaction.status === "success" ? "success"
      : transaction.status === "failed" || transaction.status === "abandoned" ? "failed" : "pending";
    const result = await applyPaymentEvent(config, paystack.serviceKey, {
      reference,
      status: transactionStatus,
      transactionId: Number.isSafeInteger(Number(transaction.id)) && Number(transaction.id) > 0
        ? Number(transaction.id) : null,
      amountMinor: Number.isSafeInteger(Number(transaction.amount)) ? Number(transaction.amount) : null,
      currency: transaction.currency || "",
      eventKey: null,
      source: "verification",
    });
    let status = Array.isArray(result) ? result[0] : result;
    if (status === "processing" && transactionStatus === "success") {
      const finalized = await supabaseRequest(config, paystack.serviceKey,
        "/rest/v1/rpc/finalize_verified_paystack_payment", {
          method: "POST",
          body: JSON.stringify({ p_reference: reference }),
        });
      status = Array.isArray(finalized) ? finalized[0] : finalized;
    }
    return response.status(200).json({ status: typeof status === "string" ? status : status?.status, testMode: true });
  } catch (error) {
    console.error("Could not verify the Skillmate Paystack payment.", error);
    return responseError(response, 503, "We couldn’t confirm your payment yet. Check your bookings shortly.");
  }
}

function rawRequestBody(request) {
  if (Buffer.isBuffer(request.rawBody)) return request.rawBody;
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === "string") return Buffer.from(request.body);
  if (request.body && typeof request.body === "object") return Buffer.from(JSON.stringify(request.body));
  return null;
}

async function handlePaystackWebhook(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return responseError(response, 405, "Method not allowed.");
  }
  let paystack;
  try {
    paystack = getPaystackConfig();
  } catch (error) {
    console.error("Paystack webhook is not configured.", error);
    return responseError(response, 503, "Payment webhook is not configured.");
  }
  const rawBody = rawRequestBody(request);
  const signature = request.headers?.["x-paystack-signature"] || request.get?.("x-paystack-signature");
  if (!validPaystackSignature(rawBody, signature, paystack.secretKey)) {
    return responseError(response, 401, "Invalid payment webhook signature.");
  }
  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return responseError(response, 400, "Invalid payment webhook payload.");
  }
  const data = payload?.data || {};
  const transactionId = Number.isSafeInteger(Number(data.id)) && Number(data.id) > 0 ? Number(data.id) : null;
  let event;
  if (payload.event === "charge.success" || payload.event === "charge.failed") {
    if (!paymentReferencePattern.test(String(data.reference || "")) || transactionId === null) {
      return responseError(response, 400, "Payment webhook is missing a valid transaction reference.");
    }
    const transaction = await verifyPaystackTransaction(paystack, data.reference).catch((error) => {
      console.error("Could not verify an authenticated Paystack charge webhook.", error);
      return null;
    });
    if (!transaction
        || Number(transaction.id) !== transactionId
        || (payload.event === "charge.success" && transaction.status !== "success")
        || (payload.event === "charge.failed" && !["failed", "abandoned"].includes(transaction.status))
        || Number(transaction.amount) !== Number(data.amount)
        || String(transaction.currency).toUpperCase() !== String(data.currency).toUpperCase()) {
      return responseError(response, 400, "Paystack webhook did not match the verified transaction.");
    }
    event = {
      reference: data.reference,
      status: payload.event === "charge.success" ? "success" : "failed",
      transactionId,
      amountMinor: Number.isSafeInteger(Number(transaction.amount)) ? Number(transaction.amount) : null,
      currency: transaction.currency || "",
      eventKey: `${payload.event}:${transactionId}`,
      source: "webhook",
    };
  } else if (payload.event === "refund.processed") {
    const reference = data.transaction_reference || data.transaction?.reference || data.reference;
    const refundId = transactionId;
    const chargeId = Number.isSafeInteger(Number(data.transaction?.id)) && Number(data.transaction.id) > 0
      ? Number(data.transaction.id) : null;
    if (!paymentReferencePattern.test(String(reference || "")) || refundId === null || chargeId === null
        || !Number.isSafeInteger(Number(data.amount)) || Number(data.amount) <= 0) {
      return responseError(response, 400, "Refund webhook is missing valid payment details.");
    }
    const transaction = await verifyPaystackTransaction(paystack, reference).catch((error) => {
      console.error("Could not verify an authenticated Paystack refund webhook.", error);
      return null;
    });
    if (!transaction || transaction.status !== "success" || Number(transaction.id) !== chargeId
        || String(transaction.currency).toUpperCase() !== String(data.currency).toUpperCase()) {
      return responseError(response, 400, "Paystack refund webhook did not match the verified transaction.");
    }
    event = {
      reference,
      status: "refunded",
      transactionId: chargeId,
      amountMinor: Number(data.amount),
      currency: transaction.currency || "",
      eventKey: `${payload.event}:${refundId}`,
      source: "webhook",
    };
  } else {
    return response.status(200).json({ received: true, ignored: true });
  }

  try {
    const config = getSupabaseConfig();
    await applyPaymentEvent(config, paystack.serviceKey, event);
    return response.status(200).json({ received: true });
  } catch (error) {
    console.error("Could not process the authenticated Paystack webhook.", error);
    return responseError(response, 503, "Payment event could not be recorded.");
  }
}

module.exports = {
  getPaystackConfig,
  handlePaymentInitialize,
  handlePaymentQuote,
  handlePaymentVerify,
  handlePaystackWebhook,
  paymentAmounts,
  validPaystackSignature,
};
