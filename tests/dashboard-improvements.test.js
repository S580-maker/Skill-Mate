const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

function element() {
  const node = {
    children: [], handlers: {}, style: {
      setProperty(name, value) { this[name] = value; },
      removeProperty(name) { delete this[name]; },
    }, attributes: {}, dataset: {},
    append(...items) { items.forEach(item => { item.parentElement = this; }); this.children.push(...items); },
    replaceChildren(...items) { this.children.forEach(item => { item.parentElement = null; }); this.children = []; this.append(...items); },
    replaceWith(item) {
      this.replacement = item;
      if (this.parentElement) {
        const index = this.parentElement.children.indexOf(this);
        if (index >= 0) this.parentElement.children.splice(index, 1, item);
        item.parentElement = this.parentElement;
      }
    },
    remove() {
      if (!this.parentElement) return;
      const index = this.parentElement.children.indexOf(this);
      if (index >= 0) this.parentElement.children.splice(index, 1);
      this.parentElement = null;
    },
    insertBefore(item, sibling) {
      const index = sibling ? this.children.indexOf(sibling) : -1;
      item.parentElement = this;
      this.children.splice(index < 0 ? this.children.length : index, 0, item);
    },
    addEventListener(name, handler) { this.handlers[name] = handler; },
    setAttribute(name, value) { this.attributes[name] = value; },
    showModal() { this.open = true; },
    querySelector(selector) {
      const find = nodes => {
        for (const child of nodes) {
          if (`.${child.className}` === selector) return child;
          const nested = find(child.children || []);
          if (nested) return nested;
        }
        return null;
      };
      return find(this.children);
    },
    closest(selector) { return selector === "button" && this.tagName === "BUTTON" ? this : null; },
    classList: {
      values: new Set(),
      add(name) { this.values.add(name); },
      remove(name) { this.values.delete(name); },
      contains(name) { return this.values.has(name); },
    },
  };
  return node;
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test("notifications expose manual and swipe actions and failed read saves can be retried", async () => {
  const elements = new Map();
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  const writes = [];
  const ranges = [];
  const readFilters = [];
  let unreadCount = 10;
  let unreadMessages = 3;
  let failWrite = true;
  let noOpRead = false;
  let noOpDelete = false;
  let finishWrite;
  const deletes = [];
  const context = {
    window: { skillflexLoading: { show: () => () => {}, withTimeout: request => Promise.resolve(request) } },
    document: {
      querySelector: get,
      createElement: element,
      createTextNode: text => ({ text, replaceWith(item) { this.replacement = item; } }),
      addEventListener() {},
      hidden: false,
    },
    window: { setInterval() { return 1; }, setTimeout() { return 2; }, clearTimeout() {} },
    appUser: { id: "student-1" },
    appSupabase: { from(table) {
      let countQuery = false;
      let write = null;
      return {
        select(_columns, options) { countQuery = Boolean(options?.head); return this; },
        order() { return this; },
        range(start, end) {
          ranges.push([start, end]);
          return Promise.resolve({ data: start ? [] : Array.from({ length: 10 }, (_, id) => ({
            id, kind: "booking_update", title: `<b>Update ${id}</b>`, body: "Full update", created_at: "2026-10-27T10:00:00Z", read_at: null,
          })) });
        },
        update(data) { write = { table, data, filters: [] }; return this; },
        delete() { write = { table, delete: true, filters: [] }; return this; },
        eq(column, value) {
          if (write) write.filters.push([column, value]);
          else readFilters.push([column, value]);
          return this;
        },
        neq() { return this; },
        in(column, values) { if (write && column === "id") write.ids = values; return this; },
        is(column, value) {
          if (countQuery) return Promise.resolve({ count: table === "messages" ? unreadMessages : unreadCount, error: null });
          writes.push(write);
          return new Promise(resolve => {
            finishWrite = () => {
              const error = failWrite ? { message: "offline" } : null;
              const data = !error && !noOpRead ? [{ id: write.filters.find(([column]) => column === "id")?.[1] }] : [];
              if (!error && data.length && write.table === "notifications") unreadCount -= 1;
              resolve({ data, error });
            };
          });
        },
        then(resolve, reject) {
          if (write?.delete) {
            deletes.push(write);
            return Promise.resolve({
              data: noOpDelete ? [] : [{ id: write.filters.find(([column]) => column === "id")?.[1] }],
              error: null,
            }).then(resolve, reject);
          }
          return Promise.resolve({ error: null }).then(resolve, reject);
        },
      };
    } },
  };
  vm.runInNewContext(read("notifications.js"), context);
  get("#notifications-button").handlers.click();
  await flush();
  assert.equal(get("#notifications-list").children.length, 10);
  assert.ok(readFilters.some(([column, value]) => column === "user_id" && value === "student-1"),
    "notification pages are scoped to the signed-in user");
  const first = get("#notifications-list").children[0];
  assert.equal(first.children[0].children[0].textContent, "<b>Update 0</b>");
  const actions = first.children[0].children.at(-1);
  assert.equal(actions.children[0].textContent, "Mark as read");
  assert.equal(writes.length, 0, "opening notifications does not silently mark every item as read");
  assert.equal(typeof first.handlers.pointerdown, "function", "notifications support swipe gestures");
  const button = actions.children[0];
  button.tagName = "BUTTON";
  button.handlers.click();
  assert.equal(writes.length, 1);
  assert.equal(first.classList.contains("is-read"), true, "marking a notification updates the UI immediately");
  finishWrite();
  await flush();
  assert.equal(first.classList.contains("is-read"), false, "failed saves restore the unread state");
  failWrite = false;
  actions.children[0].handlers.click();
  finishWrite();
  await flush();
  assert.equal(writes.length, 2);
  assert.equal(actions.children.length, 1, "read notifications no longer show a Read label or mark-as-read action");
  assert.equal(actions.children[0].textContent, "Delete");
  assert.equal(first.classList.contains("is-read"), true, "successfully read notifications retain their dimmed state");
  const swipeRow = get("#notifications-list").children[1];
  const swipeContent = swipeRow.children[0];
  swipeRow.handlers.pointerdown({
    isPrimary: true, button: 0, pointerId: 7, clientX: 10, clientY: 10,
    target: { closest: () => null },
  });
  swipeRow.handlers.pointermove({
    pointerId: 7, clientX: 110, clientY: 10, cancelable: true, preventDefault() {},
  });
  noOpRead = true;
  swipeRow.handlers.pointerup({ pointerId: 7, clientX: 110, clientY: 10 });
  assert.equal(writes.length, 3, "swiping right starts the mark-as-read action");
  finishWrite();
  await flush();
  assert.equal(swipeRow.classList.contains("is-read"), false, "a no-op read update is not reported as successful");
  assert.equal(get("#notifications-status").textContent, "Could not mark this notification as read. Try again.");
  noOpRead = false;
  const retryActions = swipeRow.children[0].children.at(-1);
  retryActions.children[0].handlers.click();
  finishWrite();
  await flush();
  assert.equal(swipeRow.classList.contains("is-read"), true);
  const pullDownRow = get("#notifications-list").children[2];
  pullDownRow.handlers.pointerdown({
    isPrimary: true, button: 0, pointerId: 8, clientX: 20, clientY: 10,
    target: { closest: () => null },
  });
  pullDownRow.handlers.pointermove({
    pointerId: 8, clientX: 20, clientY: 110, cancelable: true, preventDefault() {},
  });
  pullDownRow.handlers.pointerup({ pointerId: 8, clientX: 20, clientY: 110 });
  await flush();
  assert.equal(get("#notifications-list").children.includes(pullDownRow), false,
    "pulling a notification tile downward dismisses it");
  noOpDelete = true;
  actions.children[0].handlers.click();
  await flush();
  assert.equal(deletes.length, 2, "pull-down dismissal and manual delete each remove only their chosen notification");
  assert.equal(get("#notifications-list").children.includes(first), true, "a no-op delete restores the notification");
  assert.equal(get("#notifications-status").textContent, "Could not delete this notification. Try again.");
  noOpDelete = false;
  actions.children[0].handlers.click();
  await flush();
  assert.equal(deletes.length, 3);
  get("#notifications-more").handlers.click();
  await flush();
  assert.deepEqual(ranges, [[0, 9], [8, 17]]);
  assert.equal(get("#notifications-more").hidden, true);
});

test("notification badge shows unread totals and rings when the count increases", async () => {
  const elements = new Map();
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  const documentHandlers = {};
  const calls = [];
  let unreadCount = 2;
  let unreadMessages = 3;
  let poll;
  const context = {
    document: {
      querySelector: get,
      createElement: element,
      addEventListener(name, handler) { documentHandlers[name] = handler; },
      hidden: false,
    },
    window: {
      setInterval(handler, delay) { poll = handler; calls.push({ interval: delay }); return 1; },
      setTimeout(handler, delay) { calls.push({ timeout: delay }); return 2; },
      clearTimeout() {},
    },
    appUser: { id: "student-1" },
    appSupabase: {
      from(table) {
        return {
          select(columns, options) {
            calls.push({ table, columns, options });
            return this;
          },
          eq(column, value) { calls.push({ column, value }); return this; },
          neq(column, value) { calls.push({ column, value }); return this; },
          is(column, value) {
            calls.push({ column, value });
            return Promise.resolve({ count: table === "messages" ? unreadMessages : unreadCount, error: null });
          },
        };
      },
    },
    console,
  };
  vm.runInNewContext(read("notifications.js"), context);
  documentHandlers["skillmate:session-ready"]();
  await flush();
  const button = get("#notifications-button");
  const badge = button.children.find(child => child.className === "notification-count");
  assert.equal(badge.textContent, "5");
  assert.equal(badge.hidden, false);
  assert.equal(button.attributes["aria-label"], "Notifications, 5 unread");
  assert.equal(button.classList.contains("is-ringing"), false, "the initial unread count does not ring");
  assert.equal(calls.find(call => call.options)?.options.head, true);
  assert.deepEqual(calls.filter(call => call.column).slice(0, 5), [
    { column: "user_id", value: "student-1" },
    { column: "kind", value: "message" },
    { column: "read_at", value: null },
    { column: "sender_id", value: "student-1" },
    { column: "read_at", value: null },
  ]);

  unreadCount = 120;
  unreadMessages = 6;
  poll();
  await flush();
  assert.equal(badge.textContent, "99+");
  assert.equal(button.attributes["aria-label"], "Notifications, 126 unread");
  assert.equal(button.classList.contains("is-ringing"), true, `ring classes: ${Array.from(button.classList.values).join(",")}`);

  unreadCount = 0;
  unreadMessages = 0;
  poll();
  await flush();
  assert.equal(badge.hidden, true);
  assert.equal(button.attributes["aria-label"], "Notifications");
  assert.equal(calls.some(call => call.timeout === 1000), true);
});

test("message notification summarizes unread messages and right swipe reads the conversation", async () => {
  const elements = new Map();
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  const writes = [];
  const context = {
    document: {
      querySelector: get,
      createElement: element,
      createTextNode: text => ({ text, replaceWith(item) { this.replacement = item; } }),
      addEventListener() {},
      hidden: false,
    },
    window: { setInterval() { return 1; }, setTimeout() { return 2; }, clearTimeout() {} },
    appUser: { id: "student-1" },
    appSupabase: { from(table) {
      let head = false;
      let write = null;
      return {
        select(_columns, options) { head = Boolean(options?.head); return this; },
        order() { return this; },
        range() {
          return Promise.resolve({ data: [{
            id: "message-alert", kind: "message", title: "New messages",
            body: "Open Skillmate to read your unread messages.", read_at: null,
            created_at: "2026-10-27T10:00:00Z", conversation_id: "chat-1",
          }] });
        },
        update(data) { write = { table, data, filters: [] }; return this; },
        eq(column, value) { if (write) write.filters.push([column, value]); return this; },
        neq(column, value) { if (write) write.filters.push([column, value]); return this; },
        in(column, values) { if (write) write.filters.push([column, values]); return this; },
        is(column, value) {
          if (write) {
            writes.push(write);
            return Promise.resolve({
              data: write.table === "notifications" ? [{ id: "message-alert" }] : null,
              error: null,
            });
          }
          if (head) return Promise.resolve({ count: table === "messages" ? 2 : 0, error: null });
          return Promise.resolve({ data: [
            { conversation_id: "chat-1" },
            { conversation_id: "chat-1" },
          ], error: null });
        },
      };
    } },
    console,
  };
  vm.runInNewContext(read("notifications.js"), context);
  get("#notifications-button").handlers.click();
  await flush();
  const row = get("#notifications-list").children[0];
  assert.equal(row.children[0].children[1].textContent, "2 unread messages in this conversation.");
  row.handlers.pointerdown({
    isPrimary: true, button: 0, pointerId: 8, clientX: 0, clientY: 0,
    target: { closest: () => null },
  });
  row.handlers.pointermove({ pointerId: 8, clientX: 100, clientY: 0, cancelable: true, preventDefault() {} });
  row.handlers.pointerup({ pointerId: 8, clientX: 100, clientY: 0 });
  await flush();
  assert.deepEqual(writes.map(write => write.table), ["messages", "notifications"]);
  assert.equal(row.classList.contains("is-read"), true);
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
      clearTimeout(id) { timers.delete(id); },
      setInterval(callback, delay) { intervals.set(delay, callback); return delay; },
      clearInterval(id) { intervals.delete(id); },
    },
    dashboardLoadEstimateMs: 15000,
    DASHBOARD_LOAD_ESTIMATE_KEY: "skillflex-dashboard-load-estimate-ms-v1",
    dashboardLoadingStartedAt: 0,
    dashboardLoadingProgress: 10,
    dashboardLoadingPhase: "Checking your session…",
    dashboardLoadingTimeout: null,
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
  assert.ok(Number(estimates.get("skillmate-dashboard-load-estimate-ms-v1")) >= 1000);

  context.startDashboardLoading();
  const pendingTimeout = context.dashboardLoadingTimeout;
  assert.ok(timers.has(pendingTimeout), "Startup schedules the delayed loading progress");
  context.finishDashboardLoading();
  assert.equal(timers.has(pendingTimeout), false, "Finishing loading cancels the delayed progress callback");
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

test("provider acceptance remains pending until payment and reverts when Supabase rejects the update", async () => {
  const source = read("user.js");
  const booking = { id: "booking-1", status: "Pending" };
  let rejectWrite;
  let renders = 0;
  const context = {
    appSupabase: { rpc: name => {
      assert.equal(name, "accept_booking_request", "provider acceptance has a dedicated awaiting-payment RPC");
      return new Promise((_, reject) => { rejectWrite = reject; });
    } },
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
  assert.equal(typeof context.openBookingPayment, "function", "payment controls can access the checkout helpers");
  assert.equal(typeof context.requestSkillmatePayment, "function", "payment requests are available outside booking updates");
  const update = context.persistBookingStatus("booking-1", "Confirmed");
  assert.equal(booking.status, "Pending");
  assert.ok(booking.providerAcceptedAt);
  assert.equal(booking.paymentStatus, "awaiting_payment");
  assert.equal(renders, 1);
  await context.persistBookingStatus("booking-1", "Completed");
  assert.equal(booking.status, "Pending", "a second status action waits for the current write");
  rejectWrite(new Error("offline"));
  await assert.rejects(update, /offline/);
  assert.equal(booking.status, "Pending");
  assert.equal(booking.providerAcceptedAt, undefined);
  assert.equal(booking.paymentStatus, undefined);
  assert.equal(renders, 2);
});

test("a cancelled booking closes the payment prompt instead of offering payment checks", async () => {
  const source = read("user.js");
  const closedModal = { closed: false, close() { this.closed = true; } };
  const elements = new Map([
    ["#payment-modal", closedModal],
    ["#payment-feedback", { dataset: {}, hidden: true }],
  ]);
  const toasts = [];
  let paymentVerificationCalls = 0;
  let reopenedPaymentModal = false;
  const context = {
    checkoutVerificationPromise: null,
    checkoutBookingId: "booking-1",
    checkoutInitialization: { reference: "payment-1" },
    state: {
      bookings: [{
        id: "booking-1",
        status: "Pending",
        providerAcceptedAt: "2026-11-12T10:00:00Z",
        paymentStatus: "processing",
      }],
    },
    document: {
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, { textContent: "", disabled: false });
        return elements.get(selector);
      },
    },
    requestSkillmatePayment: async () => {
      paymentVerificationCalls++;
      return { status: "processing" };
    },
    refreshSupabaseState: async () => { context.state.bookings[0].status = "Cancelled"; },
    openModal: () => { reopenedPaymentModal = true; },
    showToast: (message, type) => toasts.push({ message, type }),
    console,
  };
  vm.createContext(context);
  vm.runInContext(source.slice(
    source.indexOf("function isTerminalBookingStatus"),
    source.indexOf("function toLocalBookingStatus"),
  ), context);
  vm.runInContext(source.slice(
    source.indexOf("function setPaymentFeedback"),
    source.indexOf("function handleAppointmentActions"),
  ), context);

  assert.equal(context.isBookingAwaitingPayment(context.state.bookings[0]), true);
  await context.finishPaystackPayment("payment-1", false);

  assert.equal(context.isBookingAwaitingPayment(context.state.bookings[0]), false);
  assert.equal(closedModal.closed, true);
  assert.equal(reopenedPaymentModal, false);
  assert.match(toasts[0].message, /booking was cancelled/i);
  assert.match(toasts[0].message, /do not pay again/i);
  assert.equal(context.checkoutInitialization, null);
  await context.checkBookingPayment(context.state.bookings[0]);
  assert.equal(paymentVerificationCalls, 1, "a stale check-payment control cannot verify a cancelled booking");
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
