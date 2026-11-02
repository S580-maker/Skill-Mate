const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const utils = require("../service-form-utils");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const valid = () => ({ title: "Campus posters", category: "Design", description: "A poster with two revisions included.",
  price: "35.50", deliveryMethod: "online", estimatedDelivery: "2 days", groups: false,
  negotiationMode: "negotiation", minimumPrice: "20.00" });

test("service validation accepts decimal prices and rejects invalid prices, categories and incomplete details", () => {
  assert.deepEqual(utils.validate(valid(), ["Design"], true), {});
  for (const price of ["", "0", "-2", "NaN", "1.001", "100000000", "1e2"]) {
    assert.ok(utils.validate({ ...valid(), price }, ["Design"], true).price);
  }
  const errors = utils.validate({ ...valid(), title: "ab", category: "Unknown", description: "short", deliveryMethod: "", estimatedDelivery: "x".repeat(81) }, ["Design"], true);
  for (const name of ["title", "category", "description", "delivery", "estimate"]) assert.ok(errors[name]);
});

test("service negotiation mode is required and private minimums must be valid", () => {
  assert.ok(utils.validate({ ...valid(), negotiationMode: "" }, ["Design"], true)["negotiation-mode"]);
  assert.deepEqual(utils.validate({ ...valid(), negotiationMode: "fixed" }, ["Design"], true), {});
  assert.deepEqual(utils.validate({ ...valid(), negotiationMode: "negotiation", minimumPrice: "12.50" }, ["Design"], true), {});
  for (const minimumPrice of ["", "0", "35.51", "1.001", "-1"]) {
    assert.ok(utils.validate({ ...valid(), negotiationMode: "hybrid", minimumPrice }, ["Design"], true)["minimum-price"]);
  }
  assert.deepEqual(utils.validate({ ...valid(), negotiationMode: "hybrid", minimumPrice: "12.50" }, ["Design"], true), {});
  assert.equal(utils.normalizeNegotiationMode("controlled"), "negotiation");
  assert.equal(utils.normalizeNegotiationMode("chat"), "negotiation");
  assert.equal(utils.normalizeNegotiationMode("fixed"), "fixed");
  assert.equal(utils.metadata({ price_type: "starting" }).priceType, "fixed");
});

test("legacy service payloads contain only existing columns; migrated payloads preserve every new field", () => {
  const base = utils.payload(valid(), "owner", "owner/image.webp", false);
  assert.deepEqual(Object.keys(base).sort(), ["provider_id", "title", "category", "price", "description", "accepts_groups"].sort());
  const full = utils.payload(valid(), "owner", "owner/image.webp", true);
  assert.equal(full.cover_image_path, "owner/image.webp");
  assert.equal(full.delivery_method, "online");
  assert.equal(full.estimated_delivery, "2 days");
  assert.equal(full.price_type, "fixed");
  assert.equal(full.price, 35.5);
});

test("image validation rejects oversized, spoofed and unsupported files", () => {
  const jpg = new Uint8Array([255, 216, 255]);
  const png = new Uint8Array([137,80,78,71,13,10,26,10]);
  const webp = new TextEncoder().encode("RIFF1234WEBP");
  for (const [type, bytes] of [["image/jpeg", jpg], ["image/png", png], ["image/webp", webp]]) {
    assert.doesNotThrow(() => utils.validateImageHeader({ type, size: 500 }, bytes));
  }
  assert.throws(() => utils.validateImageHeader({ type: "image/png", size: 500 }, jpg));
  assert.throws(() => utils.validateImageHeader({ type: "image/svg+xml", size: 500 }, png));
  assert.throws(() => utils.validateImageHeader({ type: "image/jpeg", size: 5_000_001 }, jpg));
  assert.throws(() => utils.validateImageHeader({ type: "image/jpeg", size: 0 }, jpg));
});

function element(id = "") {
  return {
    id, value: "", checked: false, hidden: false, disabled: false, isConnected: true,
    handlers: {}, attributes: {}, dataset: {}, children: [],
    addEventListener(name, callback) { (this.handlers[name] ||= []).push(callback); },
    async fire(name, event = {}) { for (const handler of this.handlers[name] || []) await handler({ target: this, preventDefault() {}, ...event }); },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    replaceChildren(...children) { this.children = children; },
    focus() { this.focused = true; }, closest() { return null; },
  };
}

function fixture({ schema = true, failSave = false, failRefresh = false, demo = false } = {}) {
  const nodes = new Map();
  const get = name => {
    const id = name.startsWith("service-") ? name : `service-${name}`;
    if (!nodes.has(id)) nodes.set(id, element(id));
    return nodes.get(id);
  };
  const writes = [];
  const rpcCalls = [];
  const messages = [];
  const close = element("close");
  const opener = element("opener");
  let saveFails = failSave;
  const form = get("form");
  const negotiationModeValues = ["fixed", "negotiation", "hybrid"];
  const negotiationModes = negotiationModeValues.map(value => {
    const radio = element(`service-negotiation-mode-${value}`);
    radio.value = value;
    nodes.set(radio.id, radio);
    return radio;
  });
  form.reset = () => {
    for (const node of nodes.values()) { node.value = ""; node.checked = false; }
    negotiationModes.forEach((radio, index) => { radio.value = negotiationModeValues[index]; });
  };
  form.querySelectorAll = selector => selector === '[name="service-negotiation-mode"]'
    ? negotiationModes
    : ["cover", "cover-remove", "delivery", "estimate"].map(get);
  form.querySelector = selector => {
    if (selector === '[name="service-negotiation-mode"]:checked') return negotiationModes.find(input => input.checked) || null;
    const value = /\[value="([^"]+)"\]/.exec(selector)?.[1];
    if (value) return negotiationModes.find(input => input.value === value) || null;
    if (selector === '[name="service-negotiation-mode"]') return negotiationModes[0];
    return get("scroll-body");
  };
  get("modal").querySelector = () => close;
  get("modal").close = () => { get("modal").open = false; get("modal").fire("close"); };
  const supabase = {
    from(table) {
      const query = {
        select() { return this; }, eq(column, value) { (this.filters ||= []).push([column, value]); return this; },
        async limit() { return { error: schema ? null : { code: "42703" }, data: [] }; },
        upsert(payload) { this.payload = payload; this.action = "upsert"; return this; },
        update(payload) { this.payload = payload; this.action = "update"; return this; },
        async single() {
          writes.push({ action: this.action, payload: this.payload, filters: this.filters });
          return saveFails ? { error: { message: "offline" } } : { data: { id: this.payload.id || "existing-id", ...this.payload, is_active: true } };
        },
      };
      if (table !== "services") {
        return {
          select() { return this; }, eq() { return this; },
          async limit() { return { error: null, data: [] }; },
          async maybeSingle() { return { data: { minimum_price: 21 }, error: null }; },
        };
      }
      return query;
    },
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      if (name !== "save_service_listing") return { error: null };
      const payload = {
        id: args.p_service_id, provider_id: "owner", title: args.p_title, category: args.p_category,
        description: args.p_description, price: args.p_price, accepts_groups: args.p_accepts_groups,
        cover_image_path: args.p_cover_image_path, delivery_method: args.p_delivery_method,
        estimated_delivery: args.p_estimated_delivery, price_type: args.p_price_type,
        negotiation_mode: args.p_mode, is_active: true,
      };
      const isExisting = args.p_service_id === "existing-id";
      writes.push({ action: isExisting ? "update" : "upsert", payload,
        filters: isExisting ? [["id", args.p_service_id], ["provider_id", "owner"]] : undefined });
      return saveFails ? { error: { message: "offline" } } : { data: payload, error: null };
    },
  };
  const context = {
    window: { skillmateServiceUtils: utils },
    document: { getElementById: get, activeElement: opener, querySelector: () => opener, createElement: () => element() },
    appSupabase: demo ? null : supabase, appUser: { id: "owner" },
    crypto: { randomUUID: () => "new-draft-id" }, URL: { revokeObjectURL() {} },
    serviceCategories: ["Design", "Tech help"], state: { services: [] }, storageKey: "demo", localStorage: { setItem() {} },
    serviceCoverUrl: () => "", currency: value => `GH₵ ${value}`, getCategoryIcon: () => "*",
    renderListings() {}, renderAll() {}, populateServiceSelects() {},
    refreshSupabaseState: async () => { if (failRefresh) throw new Error("offline"); },
    showToast: text => messages.push(text),
  };
  vm.runInNewContext(read("service-form.js"), context);
  return { get, context, writes, rpcCalls, messages, opener,
    fail(value) { saveFails = value; },
    async prepare(service) {
      context.window.skillmateServiceEditor.prepare(service);
      await new Promise(resolve => setImmediate(resolve));
    },
    fill() {
      negotiationModes.forEach((radio, index) => { radio.value = negotiationModeValues[index]; });
      negotiationModes[1].checked = true;
      for (const [name, value] of Object.entries({ title: "Campus posters", category: "Design", description: "A poster with two revisions included.", price: "35.50", delivery: "online", estimate: "2 days", "minimum-price": "20.00" })) get(name).value = value;
    },
  };
}

test("publishing requires preview first and writes all new details only on confirmation", async () => {
  const f = fixture(); await f.prepare(); f.fill();
  await f.get("form").fire("submit");
  assert.equal(f.writes.length, 0);
  assert.equal(f.get("review").hidden, false);
  assert.equal(f.get("review-price").textContent, "GH₵ 35.50");
  await f.get("form").fire("submit");
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].payload.price_type, "fixed");
  assert.equal(f.writes[0].payload.delivery_method, "online");
  assert.equal(f.rpcCalls[0].name, "save_service_listing");
  assert.equal(f.rpcCalls[0].args.p_mode, "negotiation");
  assert.equal(f.rpcCalls[0].args.p_minimum_price, 20);
  assert.equal(f.get("modal").open, false);
  assert.equal(f.opener.focused, true);
});

test("Fixed Price listings save without a private minimum", async () => {
  const f = fixture(); await f.prepare(); f.fill();
  f.get("negotiation-mode-fixed").checked = true;
  f.get("negotiation-mode-negotiation").checked = false;
  await f.get("form").fire("submit");
  await f.get("form").fire("submit");
  assert.equal(f.rpcCalls[0].args.p_mode, "fixed");
  assert.equal(f.rpcCalls[0].args.p_minimum_price, null);
});

test("cancelled edits reset when Add a service opens, including ID and optional fields", async () => {
  const f = fixture();
  await f.prepare({ id: "existing-id", title: "Old listing", category: "Design", price: 50, description: "Existing description", groups: true, estimatedDelivery: "3 days" });
  assert.equal(f.get("id").value, "existing-id");
  f.get("modal").close();
  await f.prepare();
  assert.equal(f.get("id").value, "");
  assert.equal(f.get("title").value, "");
  assert.equal(f.get("estimate").value, "");
  assert.equal(f.get("group").checked, false);
});

test("editing a listing restores its negotiation mode and private minimum", async () => {
  const f = fixture();
  await f.prepare({ id: "existing-id", title: "Existing service", category: "Design", price: 50,
    description: "Existing description", negotiationMode: "hybrid" });
  assert.equal(f.get("negotiation-mode-hybrid").checked, true);
  assert.equal(f.get("minimum-price").value, 21);
  assert.equal(f.get("minimum-price-field").hidden, false);
});

test("editing scopes the update by owner and ID, retaining paused status from the saved record", async () => {
  const f = fixture(); await f.prepare({ id: "existing-id", category: "Design" }); f.fill();
  await f.get("form").fire("submit"); await f.get("form").fire("submit");
  assert.equal(f.writes[0].action, "update");
  assert.deepEqual(f.writes[0].filters, [["id", "existing-id"], ["provider_id", "owner"]]);
  assert.equal("p_is_active" in f.rpcCalls[0].args, false);
});

test("failed saves retain details and reuse the same draft ID on retry", async () => {
  const f = fixture({ failSave: true }); await f.prepare(); f.fill();
  await f.get("form").fire("submit"); await f.get("form").fire("submit");
  assert.equal(f.get("form-feedback").dataset.state, "error");
  assert.equal(f.get("title").value, "Campus posters");
  assert.equal(f.get("submit").disabled, false);
  f.fail(false); await f.get("form").fire("submit");
  assert.equal(f.writes[0].payload.id, f.writes[1].payload.id);
});

test("rapid duplicate submissions produce only one database write", async () => {
  const f = fixture(); await f.prepare(); f.fill(); await f.get("form").fire("submit");
  await Promise.all([f.get("form").fire("submit"), f.get("form").fire("submit")]);
  assert.equal(f.writes.length, 1);
});

test("post-save refresh failure is reported as saved rather than as a failed publication", async () => {
  const f = fixture({ failRefresh: true }); await f.prepare(); f.fill();
  await f.get("form").fire("submit"); await f.get("form").fire("submit");
  assert.equal(f.writes.length, 1);
  assert.equal(f.context.state.services.length, 1);
  assert.match(f.messages.at(-1), /service was saved/);
});

test("missing negotiation migration prevents saving an incomplete listing", async () => {
  const f = fixture({ schema: false }); await f.prepare(); f.fill();
  assert.equal(f.get("delivery").disabled, true);
  await f.get("form").fire("submit"); await f.get("form").fire("submit");
  assert.equal(f.writes.length, 0);
  assert.equal(f.get("submit").disabled, true);
});

test("category examples change without overwriting authored text; counter tracks description", async () => {
  const f = fixture(); await f.prepare(); f.fill();
  await f.get("category").fire("change");
  const previous = f.get("title").placeholder;
  f.get("category").value = "Tech help";
  await f.get("category").fire("change");
  assert.notEqual(f.get("title").placeholder, previous);
  assert.equal(f.get("title").value, "Campus posters");
  assert.match(f.get("description-count").textContent, /^\d+ \/ 2,000$/);
});

test("service editor markup has unique IDs and resolves field error and label references", () => {
  const html = read("index.html");
  const allIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(allIds).size, allIds.length);
  const modal = html.slice(html.indexOf('<dialog class="app-modal service-editor"'), html.indexOf('</dialog>', html.indexOf('<dialog class="app-modal service-editor"')));
  for (const match of modal.matchAll(/(?:aria-describedby|aria-labelledby|for)="([^"]+)"/g)) {
    for (const id of match[1].split(" ")) assert.ok(allIds.includes(id), `Missing reference ${id}`);
  }
  assert.match(modal, /Pricing &amp; negotiation/);
  assert.doesNotMatch(modal, /service-price-type|Starting price|Controlled Negotiation/);
  assert.deepEqual([...modal.matchAll(/name="service-negotiation-mode" type="radio" value="([^"]+)"/g)].map(match => match[1]), ["fixed", "negotiation", "hybrid"]);
});
