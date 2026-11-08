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
  assert.match(userScript, /data-decision="Completed"[^>]*>Confirm completion/);
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
  assert.equal(context.convert({ status: "completed", provider_completed_at: "finished" }), "Completed");
});
