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
    window: { skillflexLoading: { show: () => () => {}, withTimeout: request => Promise.resolve(request) } },
    document: {
      querySelector: get,
      createElement: element,
      createTextNode: text => ({ text, replaceWith(item) { this.replacement = item; } }),
    },
    appSupabase: { from() {
      return {
        select() { return this; }, order() { return this; },
        range(start, end) {
          ranges.push([start, end]);
          return Promise.resolve({ data: start ? [] : Array.from({ length: 10 }, (_, id) => ({
            id, title: `<b>Update ${id}</b>`, body: "Full update", created_at: "2026-10-27T10:00:00Z", read_at: null,
          })) });
        },
        update() { return { eq: (column, id) => new Promise(resolve => {
          writes.push({ column, id });
          finishWrite = () => resolve({ error: failWrite ? { message: "offline" } : null });
        }) }; },
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
  let finishWrite;
  button.handlers.click();
  assert.equal(button.replacement.text, "Read", "the UI updates before the database request finishes");
  finishWrite();
  await flush();
  assert.equal(button.replacement.replacement, button, "failed saves restore the retry control");
  failWrite = false;
  button.handlers.click();
  assert.equal(button.replacement.text, "Read");
  finishWrite();
  await flush();
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

test("dashboard skeleton appears immediately and stays visible with progress during slow loads", () => {
  const source = read("user.js");
  const elements = new Map();
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, { hidden: true, textContent: "", value: 0, removeAttribute() {} });
    return elements.get(selector);
  };
  let now = 100;
  const timers = new Map();
  const intervals = new Map();
  const estimates = new Map([["skillflex-dashboard-load-estimate-ms-v1", "15000"]]);
  const context = {
    performance: { now: () => now },
    localStorage: {
      getItem: key => estimates.get(key) || null,
      setItem: (key, value) => estimates.set(key, value),
    },
    document: {
      body: { classList: { contains: value => value === "app-auth-pending" } },
      querySelector: get,
    },
    window: {
      setTimeout(callback, delay) { timers.set(delay, callback); return delay; },
      setInterval(callback, delay) { intervals.set(delay, callback); return delay; },
      clearInterval(id) { intervals.delete(id); },
    },
    dashboardLoadEstimateMs: 15000,
    DASHBOARD_LOAD_ESTIMATE_KEY: "skillflex-dashboard-load-estimate-ms-v1",
    dashboardLoadingStartedAt: 0,
    dashboardLoadingProgress: 10,
    dashboardLoadingPhase: "Checking your session…",
    dashboardLoadingInterval: null,
    console,
  };
  vm.createContext(context);
  vm.runInContext(source.slice(
    source.indexOf("function updateDashboardLoadingProgress()"),
    source.indexOf("async function runAction("),
  ), context);

  context.startDashboardLoading();
  assert.equal(get("#app-auth-status").hidden, false, "Startup has no blank screen");
  now += 1000;
  assert.equal(get("#app-auth-status").hidden, false);
  assert.equal(get("#dashboard-loading-skeleton").hidden, false);
  now += 9000;
  timers.get(10000)();
  assert.equal(get("#dashboard-loading-skeleton").hidden, false);
  assert.equal(get("#dashboard-loading-progress").hidden, false);
  assert.equal(get("#dashboard-loading-bar").value, 67);
  assert.equal(get("#dashboard-loading-elapsed").textContent, "10 seconds elapsed");
  assert.equal(get("#dashboard-loading-remaining").textContent, "Estimated time remaining: about 5 seconds");

  context.setDashboardLoadingPhase(72, "Syncing bookings, services and messages…");
  assert.equal(get("#dashboard-loading-label").textContent, "Syncing bookings, services and messages…");
  context.finishDashboardLoading();
  assert.equal(get("#app-auth-status").hidden, true);
  assert.ok(Number(estimates.get("skillflex-dashboard-load-estimate-ms-v1")) >= 1000);
});

test("a shared conversation directory query executes once for both consumers", async () => {
  const source = read("user.js");
  let requests = 0;
  const context = {
    loadAllRows: async createQuery => createQuery(),
    appSupabase: { from: () => ({
      select() { return this; },
      order() { return this; },
      then(resolve) { requests++; resolve({ data: [] }); },
    }) },
    loadConversationMessageGroups: async () => new Map(),
  };
  vm.createContext(context);
  const start = source.indexOf("  const conversationDirectoryRequest =");
  const end = source.indexOf("  const [", start);
  vm.runInContext(source.slice(start, end) + "globalThis.done = Promise.all([conversationDirectoryRequest, groupedMessagesRequest]);", context);
  await context.done;
  assert.equal(requests, 1);
});

test("large dashboard collections are read in ordered pages and stop at the final partial page", async () => {
  const source = read("user.js");
  const context = { DATA_PAGE_SIZE: 2 };
  vm.createContext(context);
  vm.runInContext(source.slice(
    source.indexOf("async function loadAllRows"),
    source.indexOf("async function loadSupabaseState"),
  ), context);
  const ranges = [];
  const result = await context.loadAllRows(() => ({
    range(start, end) {
      ranges.push([start, end]);
      return Promise.resolve({
        data: start === 0 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }],
        error: null,
      });
    },
  }));
  assert.deepEqual(Array.from(result.data, row => row.id), [1, 2, 3]);
  assert.deepEqual(ranges, [[0, 1], [2, 3]]);
});

test("large dashboard collection paging surfaces Supabase errors", async () => {
  const source = read("user.js");
  const context = { DATA_PAGE_SIZE: 2 };
  vm.createContext(context);
  vm.runInContext(source.slice(
    source.indexOf("async function loadAllRows"),
    source.indexOf("async function loadSupabaseState"),
  ), context);
  await assert.rejects(context.loadAllRows(() => ({
    range: async () => ({ error: new Error("offline"), data: null }),
  })), /offline/);
});

test("shared action helper applies optimistic changes immediately and rolls them back on failure", async () => {
  const source = read("user.js");
  const nodes = new Map();
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      hidden: true, disabled: false, isConnected: true,
      classList: { add() {}, remove() {} },
      setAttribute() {}, removeAttribute() {},
    });
    return nodes.get(selector);
  };
  const context = {
    document: { activeElement: null, querySelector: get },
    window: { setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {} },
    performance: { now: () => 1 },
    HTMLButtonElement: class {},
    HTMLElement: class {},
    ACTION_LOAD_ESTIMATE_MS: 15000,
    pendingActionCount: 0,
    console: { error() {} },
    showToast() {},
  };
  vm.createContext(context);
  vm.runInContext(source.slice(
    source.indexOf("async function runAction("),
    source.indexOf("function showConnectedApp()"),
  ), context);

  let rejectAction;
  const value = { status: "Pending" };
  const action = context.runAction(
    () => new Promise((_, reject) => { rejectAction = reject; }),
    "Could not save this change.",
    "Saving…",
    {
      optimistic: () => { value.status = "Confirmed"; },
      rollback: () => { value.status = "Pending"; },
    },
  );
  assert.equal(value.status, "Confirmed");
  rejectAction(new Error("offline"));
  await action;
  assert.equal(value.status, "Pending");
  assert.equal(context.pendingActionCount, 0);
});

test("booking status appears immediately and reverts when Supabase rejects the update", async () => {
  const source = read("user.js");
  const booking = { id: "booking-1", status: "Pending" };
  let rejectWrite;
  let renders = 0;
  const context = {
    window: { skillflexBookingPolicy: require("../booking-policy") },
    appSupabase: { rpc: () => new Promise((_, reject) => { rejectWrite = reject; }) },
    pendingBookingStatuses: new Map(),
    state: { bookings: [booking] },
    toDatabaseStatus: value => value,
    renderAll: () => { renders++; },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(
    source.indexOf("async function persistBookingStatus"),
    source.indexOf("function handleAppointmentActions"),
  ), context);
  const update = context.persistBookingStatus("booking-1", "Confirmed");
  assert.equal(booking.status, "Confirmed");
  assert.equal(renders, 1);
  await context.persistBookingStatus("booking-1", "Completed");
  assert.equal(booking.status, "Confirmed", "a second status action waits for the current write");
  rejectWrite(new Error("offline"));
  await assert.rejects(update, /offline/);
  assert.equal(booking.status, "Pending");
  assert.equal(renders, 2);
});

test("failed reconciliation preserves a confirmed change and reports that it was saved", async () => {
  const source = read("user.js");
  const notices = [];
  const context = {
    refreshSupabaseState: async () => { throw new Error("offline"); },
    console: { error() {} }, showToast: message => notices.push(message),
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("async function reconcileSavedChange"), source.indexOf("async function refreshPriceNegotiations")), context);
  await context.reconcileSavedChange();
  assert.match(notices[0], /change was saved/);
});

test("chat realtime subscribes only to the open conversation and refreshes the thread only while disconnected", async () => {
  const source = read("user.js");
  const start = source.indexOf("function clearChatConnectionStatusTimer(");
  const end = source.indexOf("\nasync function broadcastTyping", start);
  const channels = new Map();
  const timers = new Map();
  const presence = new Map();
  const toasts = [];
  const intervalCalls = [];
  let nextTimer = 1;
  let messageRefreshes = 0;
  const context = {
    appSupabase: {
      channel(name) {
        const channel = {
          name,
          on() { return this; },
          subscribe(callback) { this.statusCallback = callback; return this; },
          async track() { return { error: null }; },
          presenceState() { return {}; },
        };
        channels.set(name, channel);
        return channel;
      },
      async removeChannel() { return "ok"; },
    },
    appUser: { id: "viewer" },
    state: { activePage: "messages", messages: [
      { id: "open-chat", providerId: "provider" },
      { id: "background-chat", providerId: "other-provider" },
    ], blocked: [] },
    activeConversationId: "open-chat",
    messageChannels: new Map(),
    messageChannelRetryTimers: new Map(),
    messageChannelRetryAttempts: new Map(),
    messageConnectionStatusTimers: new Map(),
    messagePresence: presence,
    realtimeFallbackChatIds: new Set(),
    presenceTypingTimers: new Map(),
    document: { hidden: false },
    dashboardDataLoaded: true,
    pendingActionCount: 0,
    activityRefreshInProgress: false,
    console: { warn() {}, error() {} },
    showToast(message) { toasts.push(message); },
    setChatPresenceStatus(chatId, status) {
      presence.set(chatId, { ...(presence.get(chatId) || {}), ...status });
    },
    markConversationMessagesDelivered: async () => {},
    markConversationMessagesRead: async () => {},
    refreshLiveMessages: async () => { messageRefreshes++; },
    window: {
      setTimeout(callback, delay) { timers.set(nextTimer, { callback, delay }); return nextTimer++; },
      clearTimeout(id) { timers.delete(id); },
    },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  context.syncMessageChannels();
  assert.deepEqual([...channels.keys()], ["skillflex-chat:open-chat"]);
  const firstChannel = channels.get("skillflex-chat:open-chat");
  await firstChannel.statusCallback("CHANNEL_ERROR", new Error("offline"));
  assert.ok(context.realtimeFallbackChatIds.has("open-chat"));
  assert.equal(presence.get("open-chat").connection, "connecting");
  assert.equal(toasts.length, 0, "connection recovery should not interrupt the user with a toast");
  assert.equal([...timers.values()][0].delay, 1000);
  const refreshStart = source.indexOf("async function refreshLiveActivity()");
  const refreshEnd = source.indexOf("function initialsFor", refreshStart);
  vm.runInContext(source.slice(refreshStart, refreshEnd), context);
  await context.refreshLiveActivity();
  assert.equal(messageRefreshes, 1);

  [...timers.values()][0].callback();
  const recoveredChannel = channels.get("skillflex-chat:open-chat");
  await recoveredChannel.statusCallback("SUBSCRIBED");
  assert.equal(context.realtimeFallbackChatIds.has("open-chat"), false);
  assert.equal(presence.get("open-chat").connection, "restored");
  assert.equal([...timers.values()].at(-1).delay, 3000);
  await context.refreshLiveActivity();
  assert.equal(messageRefreshes, 1);
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
  assert.deepEqual(events, ["skillflex:edit-profile"]);
  context.window.renderProfileCompleteness({ identityComplete: true });
  assert.equal(container.children.length, 0);
});

for (const scenario of ["healthy", "database failure", "restricted anonymous database probe", "timeout", "missing config"]) {
  test(`health endpoint handles ${scenario}`, async () => {
    const context = {
      module: { exports: {} }, AbortSignal,
      require: (modulePath) => {
        if (modulePath === "../supabase") return { getSupabaseConfig() {
          if (scenario === "missing config") throw new Error("missing");
          return { url: "https://test.invalid", anonKey: "public-key" };
        } };
        return { probeSupabase: async (config) => {
          const check = async (path) => {
            try {
              const result = await context.fetch(`${config.url}${path}`);
              if (result.ok) return { status: "ok", latencyMs: 1 };
              if (path.startsWith("/rest/v1/") && result.status === 401) {
                const body = await result.json();
                if (body.code === "42501" && body.message === "permission denied for schema public") {
                  return { status: "ok", latencyMs: 1 };
                }
              }
              return { status: "unavailable", latencyMs: 1 };
            } catch {
              return { status: "unavailable", latencyMs: 1 };
            }
          };
          const [auth, database] = await Promise.all([
            check("/auth/v1/health"),
            check("/rest/v1/profiles?select=id&limit=0"),
          ]);
          return { auth, database };
        } };
      },
      fetch: async url => {
        if (scenario === "timeout") throw new Error("timeout");
        if (scenario === "database failure" && url.includes("/rest/")) return { ok: false, status: 503 };
        if (scenario === "restricted anonymous database probe" && url.includes("/rest/")) {
          return {
            ok: false, status: 401,
            json: async () => ({ code: "42501", message: "permission denied for schema public" }),
          };
        }
        return { ok: true, status: 200 };
      },
    };
    vm.runInNewContext(read("api/_lib/routes/health.js"), context);
    const response = {
      headers: {}, setHeader(key, value) { this.headers[key] = value; },
      status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; },
    };
    await context.module.exports({ method: "GET" }, response);
    assert.equal(response.code, ["healthy", "restricted anonymous database probe"].includes(scenario) ? 200 : 503);
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.equal(response.body.supabaseConfigured, scenario !== "missing config");
  });
}
