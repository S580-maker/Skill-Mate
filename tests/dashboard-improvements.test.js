const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

function element() {
  return {
    children: [], handlers: {}, style: {}, attributes: {},
    append(...items) { this.children.push(...items); },
    replaceChildren() { this.children = []; },
    replaceWith(item) { this.replacement = item; },
    addEventListener(name, handler) { this.handlers[name] = handler; },
    setAttribute(name, value) { this.attributes[name] = value; },
    showModal() { this.open = true; },
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test("notifications display every fetched item without marking any read; marking is individual and retryable", async () => {
  const elements = new Map();
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  const writes = [];
  const ranges = [];
  let failWrite = true;
  const context = {
    document: { querySelector: get, createElement: element, createTextNode: text => ({ text }) },
    appSupabase: { from() {
      return {
        select() { return this; }, order() { return this; },
        range(start, end) {
          ranges.push([start, end]);
          return Promise.resolve({ data: start ? [] : Array.from({ length: 10 }, (_, id) => ({
            id, title: `<b>Update ${id}</b>`, body: "Full update", created_at: "2026-10-27T10:00:00Z", read_at: null,
          })) });
        },
        update() { return { eq: async (column, id) => {
          writes.push({ column, id });
          return { error: failWrite ? { message: "offline" } : null };
        } }; },
      };
    } },
  };
  vm.runInNewContext(read("notifications.js"), context);
  get("#notifications-button").handlers.click();
  await flush();
  assert.equal(get("#notifications-list").children.length, 10);
  assert.equal(writes.length, 0);
  const first = get("#notifications-list").children[0];
  assert.equal(first.children[0].textContent, "<b>Update 0</b>");
  const button = first.children[3];
  await button.handlers.click();
  assert.equal(button.disabled, false);
  assert.equal(button.replacement, undefined);
  failWrite = false;
  await button.handlers.click();
  assert.equal(button.replacement.text, "Read");
  assert.deepEqual(writes, [{ column: "id", id: 0 }, { column: "id", id: 0 }]);
  get("#notifications-more").handlers.click();
  await flush();
  assert.deepEqual(ranges, [[0, 9], [10, 19]]);
  assert.equal(get("#notifications-more").hidden, true);
});

test("40 conversation histories use two batch requests and keep each chat's page", async () => {
  const source = read("user.js");
  const calls = [];
  const context = {
    performance, console, MESSAGE_PAGE_SIZE: 30, messageMetadataAvailable: null,
    messageColumns: "id", legacyMessageColumns: "id", olderMessagesAvailable: new Map(),
    normalizeMessageRow: row => row, mergePendingMessages: (_, rows) => rows,
    isMissingMessageMetadata: () => false,
    appSupabase: { rpc(name, args) {
      calls.push({ name, args });
      return { select: async () => ({ data: args.conversation_ids.flatMap(id =>
        Array.from({ length: 30 }, (_, index) => ({ conversation_id: id, id: 30 - index }))) }) };
    } },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("let batchMessagesAvailable"), source.indexOf("function chatDraftStorageKey")), context);
  const conversations = Array.from({ length: 40 }, (_, i) => ({ conversation_id: `chat-${i}` }));
  const result = await context.loadConversationMessageGroups(conversations);
  assert.equal(calls.length, 2);
  assert.equal(result.size, 40);
  for (const [id, messages] of result) {
    assert.equal(messages.length, 30);
    assert.equal(messages[0].id, 1);
    assert.ok(messages.every(message => message.conversation_id === id));
    assert.equal(context.olderMessagesAvailable.get(id), true);
  }
});

test("concurrent dashboard refreshes share one load and release after errors", async () => {
  const source = read("user.js");
  let loads = 0;
  let reject;
  const context = { performance, loadSupabaseState() {
    loads++;
    return new Promise((_, fail) => { reject = fail; });
  } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("let dashboardRefreshPromise"), source.indexOf("async function loadSupabaseState")), context);
  const first = context.refreshSupabaseState();
  const second = context.refreshSupabaseState();
  assert.equal(loads, 1);
  reject(new Error("offline"));
  const results = await Promise.allSettled([first, second]);
  assert.ok(results.every(result => result.status === "rejected"));
  const third = context.refreshSupabaseState();
  assert.equal(loads, 2);
  reject(new Error("offline"));
  await assert.rejects(third);
});

test("a shared conversation directory query executes once for both consumers", async () => {
  const source = read("user.js");
  let requests = 0;
  const context = {
    appSupabase: { from: () => ({ select: () => ({ then(resolve) {
      requests++;
      resolve({ data: [] });
    } }) }) },
    loadConversationMessageGroups: async () => new Map(),
  };
  vm.createContext(context);
  const start = source.indexOf("  const conversationDirectoryRequest =");
  const end = source.indexOf("  const [", start);
  vm.runInContext(source.slice(start, end) + "globalThis.done = Promise.all([conversationDirectoryRequest, groupedMessagesRequest]);", context);
  await context.done;
  assert.equal(requests, 1);
});

test("missing batch migration falls back once and keeps individual histories available", async () => {
  const source = read("user.js");
  let batchRequests = 0;
  let individualRequests = 0;
  const context = {
    performance, console: { info() {} }, MESSAGE_PAGE_SIZE: 30, messageMetadataAvailable: null,
    messageColumns: "id", legacyMessageColumns: "id", olderMessagesAvailable: new Map(),
    normalizeMessageRow: row => row, mergePendingMessages: (_, rows) => rows,
    isMissingMessageMetadata: () => false,
    appSupabase: {
      rpc() { batchRequests++; return { select: async () => ({ error: { code: "PGRST202" } }) }; },
      from() { return {
        select() { return this; }, eq(_, id) { this.id = id; return this; }, order() { return this; },
        async limit() { individualRequests++; return { data: [{ id: this.id, conversation_id: this.id }] }; },
      }; },
    },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("let batchMessagesAvailable"), source.indexOf("function chatDraftStorageKey")), context);
  const conversations = [{ conversation_id: "a" }, { conversation_id: "b" }];
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await context.loadConversationMessageGroups(conversations);
    assert.equal(result.get("a")[0].id, "a");
    assert.equal(result.get("b")[0].id, "b");
  }
  assert.equal(batchRequests, 1);
  assert.equal(individualRequests, 4);
});

test("vanilla profile card updates progress, dispatches edit, and clears completed profiles", () => {
  const container = element();
  const parts = new Map();
  const events = [];
  const context = {
    Event, window: { dispatchEvent: event => events.push(event.type) },
    document: {
      querySelector: () => container,
      createElement() {
        const section = element();
        section.querySelector = selector => {
          if (!parts.has(selector)) parts.set(selector, element());
          return parts.get(selector);
        };
        return section;
      },
    },
  };
  vm.runInNewContext(read("profile-completeness.js"), context);
  context.window.renderProfileCompleteness({ name: "Student", university: "Campus" });
  assert.equal(parts.get(".profile-completeness-value strong").textContent, "67%");
  assert.equal(parts.get("[role=progressbar]").attributes["aria-valuenow"], 67);
  parts.get("button").handlers.click();
  assert.deepEqual(events, ["skillmate:edit-profile"]);
  context.window.renderProfileCompleteness({ identityComplete: true });
  assert.equal(container.children.length, 0);
});

for (const scenario of ["healthy", "database failure", "timeout", "missing config"]) {
  test(`health endpoint handles ${scenario}`, async () => {
    const context = {
      module: { exports: {} }, AbortSignal,
      require: () => ({ getSupabaseConfig() {
        if (scenario === "missing config") throw new Error("missing");
        return { url: "https://test.invalid", anonKey: "public-key" };
      } }),
      fetch: async url => {
        if (scenario === "timeout") throw new Error("timeout");
        return { ok: !(scenario === "database failure" && url.includes("/rest/")) };
      },
    };
    vm.runInNewContext(read("api/health.js"), context);
    const response = {
      headers: {}, setHeader(key, value) { this.headers[key] = value; },
      status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; },
    };
    await context.module.exports({ method: "GET" }, response);
    assert.equal(response.code, scenario === "healthy" ? 200 : 503);
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.equal(response.body.supabaseConfigured, scenario !== "missing config");
  });
}
