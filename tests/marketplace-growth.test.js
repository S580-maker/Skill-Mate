const { test } = require("node:test");
const assert = require("node:assert/strict");
const utils = require("../marketplace-growth-utils");
const schedule = { timezone: "Africa/Accra", slot_minutes: 60, weekly_hours: [{ day: 1, start: "09:00", end: "12:00" }], blocked_dates: [] };

test("filters combine budget, delivery, verification and published hours", () => {
  const provider = { price: 50, deliveryMethod: "both", verified: true };
  const filters = { min: "30", max: "80", delivery: "online", verified: true, scheduled: true };
  assert.equal(utils.matchesFilters(provider, filters, true), true);
  assert.equal(utils.matchesFilters(provider, filters, false), false);
  assert.equal(utils.matchesFilters({ ...provider, price: 90 }, filters, true), false);
  assert.equal(utils.matchesFilters({ ...provider, verified: false }, filters, true), false);
  assert.equal(utils.matchesFilters({ ...provider, deliveryMethod: "in_person" }, filters, true), false);
  assert.equal(utils.matchesFilters(provider, { ...filters, min: "80", max: "30" }, true), false);
});
test("featured requests include only open online-capable posts from the current campus", () => {
  const now = Date.parse("2026-11-13T00:00:00Z");
  const candidates = [
    { id: "online", campus: "Campus A", requester_id: "student-a", delivery_method: "online", status: "open", expires_at: "2026-11-14T00:00:00Z" },
    { id: "either", campus: "Campus A", requester_id: "student-b", delivery_method: "both", status: "open", expires_at: "2026-11-14T00:00:00Z" },
    { id: "in-person", campus: "Campus A", requester_id: "student-c", delivery_method: "in_person", status: "open", expires_at: "2026-11-14T00:00:00Z" },
    { id: "other-campus", campus: "Campus B", requester_id: "student-d", delivery_method: "online", status: "open", expires_at: "2026-11-14T00:00:00Z" },
    { id: "own", campus: "Campus A", requester_id: "me", delivery_method: "online", status: "open", expires_at: "2026-11-14T00:00:00Z" },
    { id: "blocked", campus: "Campus A", requester_id: "blocked", delivery_method: "online", status: "open", expires_at: "2026-11-14T00:00:00Z" },
    { id: "closed", campus: "Campus A", requester_id: "student-e", delivery_method: "online", status: "closed", expires_at: "2026-11-14T00:00:00Z" },
    { id: "expired", campus: "Campus A", requester_id: "student-f", delivery_method: "online", status: "open", expires_at: "2026-11-12T00:00:00Z" },
  ];

  assert.deepEqual(utils.featuredOnlineRequests(candidates, {
    campus: "Campus A", ownId: "me", blocked: ["blocked"], now,
  }).map(request => request.id), ["online", "either"]);
  assert.deepEqual(utils.featuredOnlineRequests(candidates.concat({
    id: "third", campus: "Campus A", requester_id: "student-g", delivery_method: "online", status: "open", expires_at: "2026-11-14T00:00:00Z",
  }), { campus: "Campus A", ownId: "me", blocked: ["blocked"], now }).map(request => request.id), ["online", "either"]);
});
test("availability excludes dates off, past starts and overlapping confirmed appointments", () => {
  const now = Date.parse("2026-11-09T08:00:00Z");
  const date = "2026-11-09";
  assert.deepEqual(utils.slotsForDate(schedule, date, [], now).map(item => item.starts_at), ["2026-11-09T09:00:00.000Z", "2026-11-09T10:00:00.000Z", "2026-11-09T11:00:00.000Z"]);
  const busy = [{ scheduledAt: "2026-11-09T09:30:00Z", durationMinutes: 60, status: "Confirmed" }];
  assert.deepEqual(utils.slotsForDate(schedule, date, busy, now).map(item => item.starts_at), ["2026-11-09T11:00:00.000Z"]);
  assert.equal(utils.slotsForDate({ ...schedule, blocked_dates: [date] }, date, [], now).length, 0);
  assert.equal(utils.slotsForDate(schedule, date, [], Date.parse("2026-11-09T11:00:00Z")).length, 0);
  assert.equal(utils.slotsForDate(schedule, date, [{ ...busy[0], status: "Pending" }], now).length, 3, "Pending requests are not reservations");
});
test("time-zone conversion uses provider hours and rejects a missing daylight-saving time", () => {
  assert.equal(utils.zonedInstant("2026-11-09", "09:00", "America/New_York").toISOString(), "2026-11-09T14:00:00.000Z");
  assert.equal(utils.zonedInstant("2026-03-08", "02:30", "America/New_York"), null);
});
test("invalid hours and duplicate days cannot be published", () => {
  assert.equal(utils.validSchedule(schedule), true);
  assert.equal(utils.validSchedule({ ...schedule, timezone: "Not/AZone" }), false);
  assert.equal(utils.validSchedule({ ...schedule, slot_minutes: 17 }), false);
  assert.equal(utils.validSchedule({ ...schedule, weekly_hours: [{ day: 1, start: "13:00", end: "12:00" }] }), false);
  assert.equal(utils.validSchedule({ ...schedule, weekly_hours: [schedule.weekly_hours[0], schedule.weekly_hours[0]] }), false);
});
test("booking progress distinguishes provider and customer next steps", () => {
  assert.equal(utils.bookingProgress({ status: "Pending" }, true).step, 0);
  assert.match(utils.bookingProgress({ status: "Pending" }, false).next, /Waiting/);
  assert.match(utils.bookingProgress({
    status: "Pending", providerAcceptedAt: "2026-11-11T13:03:00Z", paymentStatus: "awaiting_payment",
  }, true).next, /awaiting payment.*work cannot start/i);
  assert.match(utils.bookingProgress({
    status: "Pending", providerAcceptedAt: "2026-11-11T13:03:00Z", paymentStatus: "awaiting_payment",
  }, false).next, /awaiting payment.*pay before work can start.*cancel the booking/i);
  assert.match(utils.bookingProgress({
    status: "Pending", providerAcceptedAt: "2026-11-11T13:03:00Z", paymentStatus: "processing",
  }, false).next, /do not pay again/i);
  assert.equal(utils.bookingProgress({
    status: "Confirmed", providerAcceptedAt: "2026-11-11T13:03:00Z", paymentStatus: "legacy",
  }, false).step, 1, "legacy paid bookings do not return to awaiting payment");
  assert.equal(utils.bookingProgress({ status: "Confirmed", workStartedAt: "2026-11-09" }, false).step, 2);
  assert.equal(utils.bookingProgress({ status: "Completed" }, false).step, 4);
  assert.equal(utils.bookingProgress({ status: "Cancelled" }, false).step, -1);
});
test("provider results count repeat completed customers without counting requests as completed", () => {
  assert.deepEqual(utils.metrics([{ status: "Pending", customerId: "a" }, { status: "Completed", customerId: "a" }, { status: "Completed", customerId: "a" }, { status: "In progress", customerId: "b" }]), { requests: 4, confirmed: 3, completed: 2, repeatCustomers: 1 });
});
