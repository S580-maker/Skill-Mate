const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const utils = require("../service-form-utils");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const valid = () => ({ title: "Campus posters", category: "Design", description: "A poster with two revisions included.",
  price: "35.50", deliveryMethod: "online", priceType: "fixed", estimatedDelivery: "2 days", groups: false });

test("service validation accepts decimal prices and rejects invalid prices, categories and incomplete details", () => {
  assert.deepEqual(utils.validate(valid(), ["Design"], true), {});
  for (const price of ["", "0", "-2", "NaN", "1.001", "100000000", "1e2"]) {
    assert.ok(utils.validate({ ...valid(), price }, ["Design"], true).price);
  }
  const errors = utils.validate({ ...valid(), title: "ab", category: "Unknown", description: "short", deliveryMethod: "", estimatedDelivery: "x".repeat(81) }, ["Design"], true);
  for (const name of ["title", "category", "description", "delivery", "estimate"]) assert.ok(errors[name]);
});

test("legacy service payloads contain only existing columns; migrated payloads preserve every new field", () => {
  const base = utils.payload(valid(), "owner", "owner/image.webp", false);
  assert.deepEqual(Object.keys(base).sort(), ["provider_id", "title", "category", "price", "description", "accepts_groups"].sort());
  const full = utils.payload({ ...valid(), priceType: "starting" }, "owner", "owner/image.webp", true);
  assert.equal(full.cover_image_path, "owner/image.webp");
  assert.equal(full.delivery_method, "online");
  assert.equal(full.estimated_delivery, "2 days");
  assert.equal(full.price_type, "starting");
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
  const messages = [];
  const close = element("close");
  const opener = element("opener");
  let saveFails = failSave;
  const form = get("form");
  form.reset = () => { for (const node of nodes.values()) { node.value = ""; node.checked = false; } };
  form.querySelectorAll = () => ["cover", "cover-remove", "delivery", "price-type", "estimate"].map(get);
  form.querySelector = () => get("scroll-body");
  get("modal").querySelector = () => close;
  get("modal").close = () => { get("modal").open = false; get("modal").fire("close"); };
  const supabase = {
    from(table) {
      assert.equal(table, "services");
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
      return query;
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
  return { get, context, writes, messages, opener,
    fail(value) { saveFails = value; },
    async prepare(service) {
      context.window.skillmateServiceEditor.prepare(service);
      await new Promise(resolve => setImmediate(resolve));
    },
    fill() {
      for (const [name, value] of Object.entries({ title: "Campus posters", category: "Design", description: "A poster with two revisions included.", price: "35.50", delivery: "online", "price-type": "starting", estimate: "2 days" })) get(name).value = value;
    },
  };
}

test("publishing requires preview first and writes all new details only on confirmation", async () => {
  const f = fixture(); await f.prepare(); f.fill();
  await f.get("form").fire("submit");
  assert.equal(f.writes.length, 0);
  assert.equal(f.get("review").hidden, false);
  assert.equal(f.get("review-price").textContent, "From GH₵ 35.50");
  await f.get("form").fire("submit");
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].payload.price_type, "starting");
  assert.equal(f.writes[0].payload.delivery_method, "online");
  assert.equal(f.get("modal").open, false);
  assert.equal(f.opener.focused, true);
});

test("cancelled edits reset when Add a service opens, including ID and optional fields", async () => {
  const f = fixture();
  await f.prepare({ id: "existing-id", title: "Old listing", category: "Design", price: 50, description: "Existing description", groups: true, priceType: "starting", estimatedDelivery: "3 days" });
  assert.equal(f.get("id").value, "existing-id");
  f.get("modal").close();
  await f.prepare();
  assert.equal(f.get("id").value, "");
  assert.equal(f.get("title").value, "");
  assert.equal(f.get("estimate").value, "");
  assert.equal(f.get("group").checked, false);
  assert.equal(f.get("price-type").value, "fixed");
});

test("editing scopes the update by owner and ID, retaining paused status from the saved record", async () => {
  const f = fixture(); await f.prepare({ id: "existing-id", category: "Design" }); f.fill();
  await f.get("form").fire("submit"); await f.get("form").fire("submit");
  assert.equal(f.writes[0].action, "update");
  assert.deepEqual(f.writes[0].filters, [["id", "existing-id"], ["provider_id", "owner"]]);
  assert.equal("is_active" in f.writes[0].payload, false);
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

test("missing migration disables extra controls and preserves the legacy save path", async () => {
  const f = fixture({ schema: false }); await f.prepare(); f.fill();
  assert.equal(f.get("delivery").disabled, true);
  await f.get("form").fire("submit"); await f.get("form").fire("submit");
  assert.equal(f.writes.length, 1);
  assert.equal("delivery_method" in f.writes[0].payload, false);
  assert.equal("cover_image_path" in f.writes[0].payload, false);
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
});
