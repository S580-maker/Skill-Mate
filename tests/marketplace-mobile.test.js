const { test } = require("node:test");
const assert = require("node:assert/strict");
const { matchesCategory, campusRank, sortByCampus, expandListings, filterBookings, safeImageUrl } = require("../marketplace-utils");
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

test("marketplace navigation groups existing categories without changing listing data", () => {
  for (const [listing, filter] of [["Tech help", "Tech Support"], ["Writing & editing", "Writing"], ["Photography", "Media & Editing"], ["Events & entertainment", "Events"], ["Hair & beauty", "Lifestyle"], ["Clothing alterations", "Lifestyle"], ["Food", "Lifestyle"]]) {
    assert.ok(matchesCategory(listing, filter), `${listing} belongs to ${filter}`);
  }
  assert.equal(matchesCategory("Tutoring", "Tech Support"), false);
  assert.equal(matchesCategory("Design", "Lifestyle"), false);
});

test("expanded services carry their own publication date without inheriting a provider's date", () => {
  const rows = expandListings([{ id: "provider", createdAt: "2020-01-01" }], [
    { id: "new", providerId: "provider", active: true, createdAt: "2026-01-01", priceType: "range", minimumPrice: 20 },
    { id: "undated", providerId: "provider", active: true },
  ]);
  assert.equal(rows[0].createdAt, "2026-01-01");
  assert.equal(rows[0].minimumPrice, 20);
  assert.equal(rows[0].priceType, "range");
  assert.equal(rows[1].createdAt, "");
});

test("Recently Added shows only the two newest listings", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "user.js"), "utf8");
  const start = source.indexOf("function latestMarketplaceListings(");
  const end = source.indexOf("\nfunction renderMarketplace(", start);
  const renderStart = source.indexOf("function renderMarketplace(");
  const renderEnd = source.indexOf("\nfunction renderSearchSuggestions(", renderStart);
  const context = {};
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  const listings = [
    { id: "newest" },
    { id: "second-newest" },
    { id: "third-newest" },
  ];

  assert.deepEqual(context.latestMarketplaceListings(listings).map(listing => listing.id), ["newest", "second-newest"]);
  assert.equal(listings.length, 3, "limiting Recently Added must not mutate the marketplace listings");
  assert.match(source.slice(renderStart, renderEnd), /let visible = window\.skillmateMarketplace\.sortByCampus/);
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

test("campus discovery keeps physical services local and includes services deliverable online", () => {
  const studentCampus = "University of Ghana";
  assert.equal(campusRank({ campus: "university of ghana", deliveryMethod: "in_person" }, studentCampus), 0);
  assert.equal(campusRank({ campus: "Ashesi University", deliveryMethod: "in_person" }, studentCampus), null);
  assert.equal(campusRank({ campus: "Ashesi University", deliveryMethod: "online" }, studentCampus), 1);
  assert.equal(campusRank({ campus: "Ashesi University", deliveryMethod: "both" }, studentCampus), 1);
  assert.equal(campusRank({ campus: "Ashesi University" }, studentCampus), null);
  assert.equal(campusRank({ campus: "Ashesi University", deliveryMethod: "in_person" }, ""), 0);
});

test("campus matches stay ahead of remote online listings, with relevance sorted within each group", () => {
  const sameCampus = { id: "local", campus: "University of Ghana", deliveryMethod: "in_person", score: 1 };
  const onlineElsewhere = { id: "remote", campus: "Ashesi University", deliveryMethod: "online", score: 100 };
  const onlineLocal = { id: "local-online", campus: "University of Ghana", deliveryMethod: "online", score: 2 };
  const sorted = sortByCampus(
    [onlineElsewhere, sameCampus, onlineLocal],
    "University of Ghana",
    (left, right) => right.score - left.score,
  );
  assert.deepEqual(sorted.map(item => item.id), ["local-online", "local", "remote"]);
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
  assert.deepEqual(filterBookings([
    { id: "cancelled", providerId: "other", status: "Cancelled" },
    { id: "declined", providerId: "other", status: "Declined" },
    { id: "unrelated", providerId: "other", status: "Completed" },
  ], { ...options, filter: "requests" }).map(item => item.id), ["cancelled", "declined"]);
  assert.deepEqual(filterBookings([
    { id: "cancelled-incoming", providerId: "me", status: "Cancelled" },
  ], { ...options, direction: "received", filter: "requests" }).map(item => item.id), ["cancelled-incoming"]);
});
test("accepted bookings show as confirmed and leave the unaccepted requests filter", () => {
  const items = [
    { id: "waiting", providerId: "me", status: "Pending", scheduledAt: "2026-10-29T12:00:00Z" },
    { id: "accepted", providerId: "me", status: "Pending", providerAcceptedAt: "2026-10-28T13:00:00Z", paymentStatus: "awaiting_payment", scheduledAt: "2026-10-30T12:00:00Z" },
  ];
  assert.deepEqual(filterBookings(items, { ...options, direction: "received", filter: "requests" }).map(item => item.id), ["waiting"]);
  assert.deepEqual(filterBookings(items, { ...options, direction: "received", filter: "upcoming" }).map(item => item.id), ["waiting", "accepted"]);
});
test("received-booking direction shows only pending incoming requests in its new-request badge", () => {
  const allCount = { textContent: "" };
  const requestCount = {
    textContent: "",
    hidden: true,
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const context = {
    state: {
      bookings: [
        { id: "new", providerId: "me", status: "Pending" },
        { id: "accepted", providerId: "me", status: "Confirmed" },
        { id: "outgoing", providerId: "other", status: "Pending" },
      ],
    },
    bookingDirection: "made",
    activeBookingFilter: "all",
    ownProviderId: () => "me",
    isOwnBooking: booking => booking.providerId === "me",
    window: { skillmateMarketplace: { filterBookings: () => [] } },
    document: {
      querySelector(selector) {
        return selector === "#all-booking-count" ? allCount : requestCount;
      },
    },
  };
  vm.createContext(context);
  const start = source.indexOf("function bookingsForActiveFilter()");
  const end = source.indexOf("\nfunction renderBookingActivity()", start);
  vm.runInContext(source.slice(start, end), context);

  context.bookingsForActiveFilter();
  assert.equal(requestCount.textContent, "1");
  assert.equal(requestCount.attributes["aria-label"], "1 new request");
  assert.equal(requestCount.hidden, false);

  context.state.bookings[0].status = "Confirmed";
  context.bookingsForActiveFilter();
  assert.equal(requestCount.textContent, "0");
  assert.equal(requestCount.attributes["aria-label"], "0 new requests");
  assert.equal(requestCount.hidden, true);
});
test("accepted bookings await payment and can only be cancelled through the safe unpaid flow", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "user.js"), "utf8");
  const bookingRenderer = source.slice(source.indexOf("function renderBookingList"), source.indexOf("function resizeChatInput"));
  assert.match(bookingRenderer, /providerCanCancelUnpaid = acceptedAwaitingPayment[\s\S]*\["awaiting_payment", "failed"\]\.includes\(booking\.paymentStatus\)[\s\S]*latestPaymentStatus !== "pending"/);
  assert.match(bookingRenderer, /customerCanCancelUnpaid = Boolean\(appSupabase\)[\s\S]*\["awaiting_payment", "failed", "processing"\]\.includes\(booking\.paymentStatus\)/);
  assert.match(bookingRenderer, /customerCanCancel = !booking\.groupId && !booking\.providerAcceptedAt/);
  assert.doesNotMatch(bookingRenderer, /Continue payment/);
  assert.match(bookingRenderer, /data-check-payment-booking-id/);
  assert.match(bookingRenderer, /data-cancel-customer-unpaid-booking/);
  assert.match(bookingRenderer, /"Confirmed · Awaiting payment"/);
  assert.match(bookingRenderer, /"Confirmed · Payment processing"/);
  assert.match(bookingRenderer, /data-decision="In progress" data-booking-id/);
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
