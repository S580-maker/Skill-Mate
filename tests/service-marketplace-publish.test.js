const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const marketplace = require("../marketplace-utils");
const serviceUtils = require("../service-form-utils");
const source = fs.readFileSync(path.join(__dirname, "..", "user.js"), "utf8");
const start = source.indexOf("function marketplaceEntries(");
const end = source.indexOf("function renderMarketplace(", start);

function createMarketplaceFixture({ providers = [], services = [] } = {}) {
  let renderCount = 0;
  const context = {
    appSupabase: {},
    appUser: { id: "owner" },
    connectedProviders: providers,
    connectedServices: services,
    state: { services: [], portfolio: [], profile: {
      name: "Alex Student", university: "Campus University", course: "Student",
      bio: "", verified: false, avatarUrl: "",
    } },
    window: { skillmateMarketplace: marketplace, skillmateServiceUtils: serviceUtils },
    ownProviderId: () => "owner",
    initialsFor: name => name.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase(),
    renderMarketplace() { renderCount++; },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  return { context, get renderCount() { return renderCount; } };
}

test("publishing an active service adds it to Discover immediately, even when the owner had no listings", () => {
  const fixture = createMarketplaceFixture();
  const { context } = fixture;

  context.publishServiceToMarketplace({
    id: "new-service",
    title: "Campus tutoring",
    category: "Tutoring",
    description: "Friendly calculus help for campus students.",
    price: 40,
    active: true,
    deliveryMethod: "in_person",
  });

  const listings = marketplace.expandListings(context.connectedProviders, context.connectedServices);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].id, "owner");
  assert.equal(listings[0].serviceId, "new-service");
  assert.equal(listings[0].service, "Campus tutoring");
  assert.equal(listings[0].campus, "Campus University");
  assert.equal(fixture.renderCount, 1);
});

test("publishing another service retains the owner's existing services and provider listing", () => {
  const provider = { id: "owner", name: "Alex Student", campus: "Campus University" };
  const { context } = createMarketplaceFixture({
    providers: [provider],
    services: [{ id: "old-service", providerId: "owner", title: "Design help", active: true }],
  });

  context.publishServiceToMarketplace({
    id: "new-service", title: "Campus tutoring", category: "Tutoring",
    description: "Friendly calculus help for campus students.", price: 40, active: true,
  });

  const listings = marketplace.expandListings(context.connectedProviders, context.connectedServices);
  assert.equal(context.connectedProviders[0], provider);
  assert.deepEqual(listings.map(listing => listing.serviceId).sort(), ["new-service", "old-service"]);
});

test("demo services are included in Discover alongside existing listings", () => {
  const { context } = createMarketplaceFixture();
  context.appSupabase = null;
  context.state.services.push({
    id: "demo-service", title: "Campus tutoring", category: "Tutoring",
    description: "Friendly calculus help for campus students.", price: 40, active: true,
  });
  const entries = context.marketplaceEntries([
    { id: "other", name: "Other Student", campus: "Campus University", service: "Existing service" },
  ]);

  assert.equal(entries.length, 2);
  assert.ok(entries.some(entry => entry.id === "other"));
  assert.ok(entries.some(entry => entry.id === "owner" && entry.serviceId === "demo-service"));
});
