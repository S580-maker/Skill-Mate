const { test } = require("node:test");
const assert = require("node:assert/strict");
const policy = require("../booking-policy");
const api = require("../api-client");

test("booking next steps identify the actor throughout both sides of the lifecycle", () => {
  for (const [status, providerOwner, customerOwner] of [
    ["Pending", "You", "Provider"], ["Confirmed", "You", "Provider"],
    ["In progress", "You", "Provider"], ["Awaiting verification", "Customer", "You"],
    ["Completed", "Complete", "Complete"], ["Cancelled", "Closed", "Closed"], ["Declined", "Closed", "Closed"],
  ]) {
    assert.equal(policy.nextStep({ status }, true).owner, providerOwner);
    assert.equal(policy.nextStep({ status }, false).owner, customerOwner);
  }
  assert.equal(policy.nextStep({ status: "Pending", pendingAppointmentProposalId: "proposal" }, false).owner, "You");
  assert.equal(policy.localStatus("Completed", true), "Awaiting verification");
  assert.equal(policy.localStatus("Completed", false), "Completed");
});

test("shared API preserves status codes and OTP error codes without retrying writes", async () => {
  let calls = 0;
  await assert.rejects(api.json("/api/session", { method: "POST" }, { fetch: async (_url, options) => {
    calls++; assert.equal(options.method, "POST"); assert.ok(options.signal);
    return new Response(JSON.stringify({ error: "Verify your email", code: "OTP_VERIFICATION_REQUIRED" }), { status: 403 });
  } }), error => error.status === 403 && error.code === "OTP_VERIFICATION_REQUIRED");
  assert.equal(calls, 1);
  assert.equal(await api.json("/api/session", {}, { fetch: async () => new Response(null, { status: 204 }) }), null);
});

test("shared API aborts stalled requests and caller cancellation", async () => {
  const fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  // AbortSignal's timer is unref'd; keep this test alive while awaiting it.
  const timer = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(api.request("/api/session", {}, { timeout: 10, fetch }), { name: "TimeoutError" });
    const controller = new AbortController(); controller.abort();
    await assert.rejects(api.request("/api/session", { signal: controller.signal }, { fetch }), { name: "AbortError" });
  } finally { clearTimeout(timer); }
});

test("shared API preserves Request cancellation and rejects malformed success responses", async () => {
  const controller = new AbortController(); controller.abort();
  const request = new Request("https://example.test/api/session", { signal: controller.signal });
  await api.request(request, {}, { fetch: async (_url, options) => {
    assert.equal(options.signal.aborted, true);
    return new Response(null, { status: 204 });
  } });
  await assert.rejects(api.json("/api/session", {}, { fetch: async () => new Response("not JSON") }), /unreadable response/);
  await assert.rejects(api.json("/api/session", {}, { fetch: async () => new Response("null", { status: 503 }) }), error => error.status === 503);
});
