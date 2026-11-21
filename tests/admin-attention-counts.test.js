const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const authSource = fs.readFileSync(path.join(root, "admin-auth.js"), "utf8");

test("admin navigation badges show positive counts and stay hidden when empty or unavailable", () => {
  const start = authSource.indexOf("function updateAdminNavCount(");
  const end = authSource.indexOf("\nasync function refreshAdminSystemStatus", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const badges = new Map();
  const document = {
    querySelector(selector) {
      const viewId = selector.match(/href="#([^"]+)"/)?.[1];
      return badges.get(viewId) || null;
    },
  };
  const context = { document };
  vm.runInNewContext(authSource.slice(start, end), context);

  const createBadge = () => ({
    hidden: true,
    textContent: "",
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
  });
  const bookings = createBadge();
  badges.set("bookings", bookings);
  context.updateAdminNavCount("bookings", 4);
  assert.equal(bookings.hidden, false);
  assert.equal(bookings.textContent, "4");
  assert.equal(bookings.attributes["aria-label"], "4 items need attention");

  context.updateAdminNavCount("bookings", 0);
  assert.equal(bookings.hidden, true);
  assert.equal(bookings.textContent, "");
  assert.equal(bookings.attributes["aria-label"], undefined);

  context.updateAdminNavCount("bookings", 124);
  assert.equal(bookings.hidden, false);
  assert.equal(bookings.textContent, "99+");
  assert.equal(bookings.attributes["aria-label"], "124 items need attention");

  context.updateAdminNavCount("bookings", null);
  assert.equal(bookings.hidden, true);
});

test("admin navigation has a hidden badge for every actionable queue and hides zero counts in CSS", () => {
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  const vercelHtml = fs.readFileSync(path.join(root, "api/_lib/admin.html"), "utf8");
  assert.equal(vercelHtml, html);

  for (const section of ["bookings", "students", "verification", "support-tickets", "safety"]) {
    assert.match(html, new RegExp(`href="#${section}"[\\s\\S]*?<span class="nav-count" hidden><\\/span>`));
  }
  assert.match(fs.readFileSync(path.join(root, "styles.css"), "utf8"), /\.nav-count\[hidden\]\s*\{\s*display:\s*none;/);
});

test("booking badge includes pending requests and client verification tasks, not monthly totals", () => {
  assert.match(authSource, /\.eq\("status", "pending"\)/);
  assert.match(authSource, /\.eq\("status", "confirmed"\)\.not\("provider_completed_at", "is", null\)\.limit\(1\)/);
  assert.match(authSource, /completionVerificationAvailable \? pendingBookingCount \+ awaitingVerificationCount : null/);
  assert.doesNotMatch(authSource, /updateAdminNavCount\("bookings", bookingsCount\.count/);
});
