const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const marketplace = require("../marketplace-utils");
const growth = require("../marketplace-growth-utils");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20261107120000_client_completion_verification.sql");
const paymentCompletionMigration = read("supabase/migrations/20261111150000_require_client_completion_verification.sql");
const userScript = read("user.js");

test("providers request completion and only the customer can verify it", () => {
  const statusFunction = migration.slice(
    migration.indexOf("create or replace function public.update_booking_status"),
    migration.indexOf("create or replace function public.notify_booking_participants"),
  );
  assert.match(migration, /add column if not exists provider_completed_at timestamptz/);
  assert.match(statusFunction, /v_booking\.provider_id = v_user_id[\s\S]*?v_booking\.provider_completed_at is null[\s\S]*?p_status = 'completed'[\s\S]*?set provider_completed_at = now\(\)/);
  assert.match(statusFunction, /v_booking\.customer_id = v_user_id[\s\S]*?v_booking\.provider_completed_at is not null[\s\S]*?p_status = 'completed'/);
  assert.match(statusFunction, /v_booking\.provider_completed_at is null[\s\S]*?p_status = 'cancelled'/);
});

test("admin status updates cannot skip client verification and invalid completions can be recovered", () => {
  assert.match(paymentCompletionMigration, /if p_status = 'completed'[\s\S]*v_booking\.customer_id is distinct from v_user_id[\s\S]*raise exception 'Only the customer can verify completion/);
  assert.match(paymentCompletionMigration, /v_booking\.status = 'completed'[\s\S]*v_booking\.customer_completed_at is null[\s\S]*set customer_completed_at = now\(\)/);
});

test("completion requests notify the customer and are included in the booking view", () => {
  assert.match(migration, /old\.provider_completed_at is distinct from new\.provider_completed_at/);
  assert.match(migration, /after update of status, provider_completed_at on public\.bookings/);
  assert.match(migration, /Completion needs your verification/);
  assert.match(migration, /b\.service_id, b\.duration_minutes, b\.work_started_at, b\.provider_completed_at/);
  const startFunction = migration.slice(
    migration.indexOf("create or replace function public.start_booking_work"),
    migration.indexOf("create or replace function public.propose_booking_appointment"),
  );
  const proposalFunction = migration.slice(
    migration.indexOf("create or replace function public.propose_booking_appointment"),
    migration.indexOf("create or replace function public.update_booking_status"),
  );
  assert.match(startFunction, /v_booking\.provider_completed_at is not null/);
  assert.match(proposalFunction, /v_booking\.provider_completed_at is not null/);
});

test("booking UI keeps verification pending until the client confirms", () => {
  assert.match(userScript, /if \(booking\.status === "confirmed" && booking\.provider_completed_at\) return "Awaiting verification"/);
  assert.match(userScript, /data-decision="Completed"[^>]*>Verify completion/);
  assert.match(userScript, /window\.confirm\("Confirm that the provider has completed this service\?"\)/);
  assert.match(userScript, /Marked complete\. The client must verify the service\./);
});

test("awaiting client verification stays actionable and progresses separately from completion", () => {
  const awaiting = { id: "waiting", providerId: "provider", status: "Awaiting verification", scheduledAt: "2026-10-01T10:00:00Z" };
  assert.deepEqual(marketplace.filterBookings([awaiting], {
    ownId: "customer", filter: "upcoming", now: Date.parse("2026-11-01T00:00:00Z"),
  }).map(booking => booking.id), ["waiting"]);
  assert.deepEqual(growth.bookingProgress(awaiting, false), {
    step: 3,
    next: "Your provider marked the work complete. Confirm when you are satisfied with the service.",
  });
  assert.equal(growth.bookingProgress({ status: "Completed" }, false).step, 4);
});

test("cancelled and declined requests remain visible in the requests filter", () => {
  const requests = [
    { id: "cancelled", providerId: "provider", status: "Cancelled" },
    { id: "declined", providerId: "provider", status: "Declined" },
    { id: "completed", providerId: "provider", status: "Completed" },
  ];
  assert.deepEqual(marketplace.filterBookings(requests, {
    ownId: "customer", filter: "requests",
  }).map(booking => booking.id), ["cancelled", "declined"]);
});

test("confirmed booking status maps to awaiting verification only after provider completion request", () => {
  const source = userScript.slice(
    userScript.indexOf("function toLocalStatus"),
    userScript.indexOf("function toDatabaseStatus"),
  );
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.convert = toLocalBookingStatus;`, context);
  assert.equal(context.convert({ status: "confirmed", work_started_at: "started", provider_completed_at: null }), "In progress");
  assert.equal(context.convert({ status: "confirmed", work_started_at: "started", provider_completed_at: "finished" }), "Awaiting verification");
  assert.equal(context.convert({
    status: "completed", provider_completed_at: "finished", customer_completed_at: "verified",
  }), "Completed");
  assert.equal(context.convert({
    status: "completed", provider_completed_at: "finished", customer_completed_at: null,
  }), "Awaiting verification");
});

test("secure checkout closes its native dialog before opening Paystack's popup", () => {
  const start = userScript.indexOf('document.querySelector("#payment-submit").addEventListener("click"');
  const end = userScript.indexOf('document.querySelector("#earnings-export")', start);
  const handler = userScript.slice(start, end);
  assert.match(handler, /document\.querySelector\("#payment-modal"\)\.close\(\);\s*openPaystackInline\(/);
  assert.match(userScript, /openModal\("payment-modal"\);\s*setPaymentFeedback\("We couldn’t confirm payment yet/);
});

test("booking confirmation explains missing migrations and unavailable appointment slots", () => {
  const start = userScript.indexOf("function bookingStatusFailureMessage(error)");
  const end = userScript.indexOf("\nfunction toLocalStatus", start);
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${userScript.slice(start, end)}\nthis.formatFailure = bookingStatusFailureMessage;`, context);
  assert.match(context.formatFailure({
    code: "PGRST202",
    message: "Could not find the function public.update_booking_status",
  }), /Apply the Paystack booking migration/);
  assert.match(context.formatFailure({
    message: "That appointment is already reserved by another booking.",
  }), /conflicts with another booking/);
  assert.match(context.formatFailure({
    message: "That appointment is no longer available.",
  }), /no longer available/);
  assert.equal(context.formatFailure({
    code: "42703",
    message: 'column "provider_accepted_at" does not exist',
  }), 'Booking update failed (42703): column "provider_accepted_at" does not exist');
});
