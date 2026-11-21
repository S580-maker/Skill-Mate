const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../script.js"), "utf8");

test("admin booking search filters live rows, reports empty results, and restores rows when cleared", () => {
  const rows = [
    { dataset: { search: "ama mensah laptop clean confirmed" }, hidden: false },
    { dataset: { search: "kojo asare math tutoring pending" }, hidden: false },
  ];
  const globalSearch = { value: "  MATH " };
  const emptyState = { hidden: true, textContent: "" };
  const bookingsSummary = { textContent: "" };
  const start = source.indexOf("function applyAdminBookingSearch()");
  const end = source.indexOf("\nconst toast =", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const context = {
    globalSearch,
    emptyState,
    document: { querySelector: () => bookingsSummary },
    getBookingRows: () => rows,
  };
  vm.runInNewContext(`${source.slice(start, end)}; applyAdminBookingSearch();`, context);

  assert.deepEqual(rows.map((row) => row.hidden), [true, false]);
  assert.equal(emptyState.hidden, true);
  assert.equal(bookingsSummary.textContent, "Showing 1 of 2 bookings");

  globalSearch.value = "no matching booking";
  vm.runInNewContext("applyAdminBookingSearch()", context);
  assert.deepEqual(rows.map((row) => row.hidden), [true, true]);
  assert.equal(emptyState.hidden, false);
  assert.equal(emptyState.textContent, "No bookings match “no matching booking”.");
  assert.equal(bookingsSummary.textContent, "Showing 0 of 2 bookings");

  globalSearch.value = "";
  vm.runInNewContext("applyAdminBookingSearch()", context);
  assert.deepEqual(rows.map((row) => row.hidden), [false, false]);
  assert.equal(emptyState.hidden, true);
  assert.equal(bookingsSummary.textContent, "2 most recent bookings");
});
