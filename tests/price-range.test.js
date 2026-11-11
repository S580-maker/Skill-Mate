const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const userScript = read("user.js");
const rangeMigration = read("supabase/migrations/20261108100000_service_price_ranges_and_custom_quotes.sql");

test("service listings show the provider-declared public price range", () => {
  const start = userScript.indexOf("function servicePriceLabel(");
  const end = userScript.indexOf("\nfunction serviceUsesPriceRange(", start);
  const context = { currency: amount => `GH₵ ${Number(amount).toFixed(2)}` };
  vm.createContext(context);
  vm.runInContext(userScript.slice(start, end), context);
  assert.equal(context.servicePriceLabel({ priceType: "range", minimumPrice: 25, price: 80 }), "GH₵ 25.00–GH₵ 80.00");
  assert.equal(context.servicePriceLabel({ priceType: "range", minimumPrice: null, price: 80 }), "GH₵ 80.00");
  assert.equal(context.servicePriceLabel({ priceType: "fixed", minimumPrice: 25, price: 80 }), "GH₵ 80.00");
});

test("a range listing requests scope details before a customer can book", () => {
  const start = userScript.indexOf("function updateBookingRequestMode(");
  const end = userScript.indexOf("\nfunction bookingLocationValue(", start);
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) {
      const summaryLabel = { textContent: "" };
      nodes.set(id, {
        hidden: false, required: false, parentElement: { hidden: false },
        childNodes: [{ textContent: "" }], querySelector: () => summaryLabel, summaryLabel,
      });
    }
    return nodes.get(id);
  };
  const context = {
    serviceUsesPriceRange: service => service.priceType === "range",
    document: { querySelector: selector => node(selector) },
  };
  vm.createContext(context);
  vm.runInContext(userScript.slice(start, end), context);
  context.updateBookingRequestMode({ priceType: "range", negotiationMode: "hybrid" }, false);
  assert.equal(node("#booking-appointment-details").hidden, true);
  assert.equal(node("#booking-note").required, true);
  assert.equal(node("#booking-instructions").open, true);
  assert.equal(node("#booking-instructions summary").summaryLabel.textContent, "(required)");
  assert.equal(node("#booking-title").textContent, "Request a custom quote");
  assert.equal(node("#booking-submit").textContent, "Request a Quote");
  assert.match(node("#booking-availability-note").textContent, /not a booking/i);
  context.updateBookingRequestMode({ priceType: "range", negotiationMode: "hybrid" }, true);
  assert.equal(node("#booking-appointment-details").hidden, false);
  assert.equal(node("#booking-note").required, false);
  assert.equal(node("#booking-submit").textContent, "Send Booking Request");
});

test("range requests start a quote conversation instead of creating a booking", () => {
  const bookingSubmit = userScript.slice(
    userScript.indexOf('document.querySelector("#booking-form").addEventListener("submit"'),
    userScript.indexOf('document.querySelector("#group-form").addEventListener("submit"'),
  );
  assert.match(bookingSubmit, /if \(serviceUsesPriceRange\(service\) && !negotiationId\)/);
  assert.match(bookingSubmit, /openServiceDiscussion\(providerId, service\.id,[^,]+, request\)/);
  assert.match(userScript, /createOutgoingMessage\(`Custom quote request for \$\{service\?\.title \|\| "this service"\}: \$\{initialMessage\}`\)/);
  assert.match(userScript, /Accept the provider’s exact price and scope before booking/);
});

test("only explicit range listings expose their low bound; provider saves validate both bounds", () => {
  assert.match(rangeMigration, /check \(price_type in \('fixed', 'starting', 'range'\)\)/);
  assert.match(rangeMigration, /v_price_type text := case when p_price_type = 'range' then 'range' else 'fixed' end/);
  assert.match(rangeMigration, /p_minimum_price > p_price/);
  assert.match(rangeMigration, /create trigger price_offers_require_range_quote_scope/);
  assert.match(rangeMigration, /n\.provider_id = new\.proposer_id\s+and s\.price_type = 'range'/);
  assert.match(rangeMigration, /Describe the exact service scope included in this quote/);
  assert.match(rangeMigration, /case when s\.price_type = 'range' then ns\.minimum_price end as price_range_min/);
  assert.match(rangeMigration, /left join public\.service_negotiation_settings ns on ns\.service_id = s\.id/);
});
