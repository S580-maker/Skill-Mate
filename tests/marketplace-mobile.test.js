const { test } = require("node:test");
const assert = require("node:assert/strict");
const { matchesCategory, expandListings, filterBookings, safeImageUrl } = require("../marketplace-utils");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "user.js"), "utf8");

test("consolidated categories keep existing repair, laundry and tailoring listings discoverable", () => {
  for (const category of ["Repairs", "Appliance repair", "Bike repair", "Home maintenance"]) assert.ok(matchesCategory(category, "Repairs"));
  assert.ok(matchesCategory("Laundry", "Cleaning"));
  assert.ok(matchesCategory("Clothing alterations", "Fashion & tailoring"));
  assert.ok(matchesCategory("Moving help", "Errands & delivery"));
  assert.ok(matchesCategory("Anything", "All"));
  assert.equal(matchesCategory("Food", "Repairs"), false);
});

test("every active service is discoverable while retaining the provider identity and its own booking ID", () => {
  const providers = [{ id: "p", name: "Student", service: "First listing", portfolio: ["Work"], coverImagePath: "first-cover" }];
  const services = [
    { id: "tech", providerId: "p", title: "Laptop repair", category: "Tech help", price: 50, active: true, coverImagePath: "tech-cover" },
    { id: "math", providerId: "p", title: "Calculus tutoring", category: "Tutoring", price: 40, active: true },
    { id: "paused", providerId: "p", title: "Paused listing", active: false },
  ];
  const listings = expandListings(providers, services);
  assert.equal(listings.length, 2);
  assert.deepEqual(listings.map(item => item.id), ["p", "p"]);
  assert.deepEqual(listings.map(item => item.serviceId), ["tech", "math"]);
  assert.equal(listings.find(item => matchesCategory(item.category, "Tutoring")).service, "Calculus tutoring");
  assert.equal(listings[1].coverImagePath, "", "a second service must not inherit the first service's cover");
  assert.equal(listings[1].price, 40);
  assert.equal(providers[0].service, "First listing", "provider records remain unchanged");
});

const bookings = [
  { id: "past", providerId: "other", status: "Confirmed", scheduledAt: "2026-10-20T12:00:00Z" },
  { id: "later", providerId: "other", status: "Confirmed", scheduledAt: "2026-10-30T12:00:00Z" },
  { id: "next", providerId: "other", status: "Pending", scheduledAt: "2026-10-29T12:00:00Z" },
  { id: "done", providerId: "other", status: "Completed", scheduledAt: "2026-10-22T12:00:00Z" },
  { id: "incoming", providerId: "me", status: "Pending", scheduledAt: "2026-10-31T12:00:00Z" },
  { id: "accepted", providerId: "me", status: "Confirmed", scheduledAt: "2026-10-29T12:00:00Z" },
];
const options = { ownId: "me", now: Date.parse("2026-10-28T12:00:00Z") };
test("booking direction separates purchases from incoming work and puts next appointments first", () => {
  assert.deepEqual(filterBookings(bookings, options).map(item => item.id), ["next", "later", "past", "done"]);
  assert.deepEqual(filterBookings(bookings, { ...options, direction: "received" }).map(item => item.id), ["incoming", "accepted"]);
  assert.equal(bookings[0].id, "past", "sorting must not mutate the shared booking array");
});
test("upcoming excludes overdue appointments; status filters retain the selected booking direction", () => {
  assert.deepEqual(filterBookings(bookings, { ...options, filter: "upcoming" }).map(item => item.id), ["next", "later"]);
  assert.deepEqual(filterBookings(bookings, { ...options, filter: "requests", direction: "received" }).map(item => item.id), ["incoming"]);
  assert.deepEqual(filterBookings(bookings, { ...options, filter: "completed" }).map(item => item.id), ["done"]);
});
test("uploaded image URLs reject executable schemes and accept supported photo sources", () => {
  for (const url of ["javascript:alert(1)", "data:image/svg+xml,<svg/>", "file:///private", "http://unknown.test/a.jpg", "bad"]) assert.equal(safeImageUrl(url), "");
  assert.equal(safeImageUrl("https://images.example/photo.jpg"), "https://images.example/photo.jpg");
  assert.equal(safeImageUrl("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
});

test("connected accounts never initialize from demo bookings or saved local demo data", () => {
  const context = {
    window: { skillmateSupabase: {} }, structuredClone,
    defaultState: { profile: { name: "Demo" }, bookings: [{ id: "demo" }], services: [{ id: "demo" }] },
    localStorage: { getItem() { throw new Error("Demo storage must not be consulted"); } },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("function loadState()"), source.indexOf("function saveState()")), context);
  const state = context.loadState();
  for (const field of ["bookings", "services", "groups", "saved", "blocked", "reviews", "portfolio", "messages"]) assert.equal(state[field].length, 0);
});

test("live provider ratings count fetched reviews once while demo ratings retain their seeded totals", () => {
  const context = { appSupabase: {}, state: { reviews: [{ providerId: "p", rating: 4 }, { providerId: "p", rating: 5 }] } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("function providerReviewSummary"), source.indexOf("function providerAvatarMarkup")), context);
  const provider = { id: "p", rating: 4.5, reviews: 2 };
  assert.equal(context.providerReviewSummary(provider).count, 2);
  assert.equal(context.providerReviewSummary(provider).rating, "4.5");
  context.appSupabase = null;
  assert.equal(context.providerReviewSummary(provider).count, 4);
});
