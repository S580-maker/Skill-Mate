const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "user.js"), "utf8");
const start = source.indexOf("function openProviderConversation(");
const end = source.indexOf("async function startConversation(", start);
const openProviderConversationSource = source.slice(start, end);

function createContext({
  messages = [],
  appSupabase = null,
  loadConversationMessages = async () => [],
  refreshSupabaseState = async () => {},
} = {}) {
  const actions = [];
  let activeConversationId = null;
  let activePage = null;
  let focused = false;
  const provider = { id: "provider-1", name: "Provider" };
  const context = {
    appSupabase,
    state: { messages, blocked: [] },
    getProvider: id => id === provider.id ? provider : null,
    runAction: action => actions.push(action()),
    loadConversationMessages,
    refreshSupabaseState,
    setActiveConversation: id => { activeConversationId = id; },
    showPage: (page, options) => { activePage = { page, options }; },
    pendingReplyId: "reply-1",
    document: {
      querySelector: selector => selector === '#chat-panel [name="message"]'
        ? { focus: () => { focused = true; } }
        : null,
    },
  };
  vm.createContext(context);
  vm.runInContext(openProviderConversationSource, context);
  return {
    context,
    actions,
    activeConversation: () => activeConversationId,
    activePage: () => activePage,
    focused: () => focused,
  };
}

test("provider message action opens a new empty chat and focuses its composer", async () => {
  const fixture = createContext();

  fixture.context.openProviderConversation("provider-1");
  await Promise.all(fixture.actions);

  assert.equal(fixture.context.state.messages.length, 1);
  assert.equal(fixture.context.state.messages[0].providerId, "provider-1");
  assert.equal(fixture.context.state.messages[0].messages.length, 0);
  assert.equal(fixture.activeConversation(), fixture.context.state.messages[0].id);
  assert.equal(fixture.activePage().page, "messages");
  assert.equal(fixture.activePage().options.openConversation, true);
  assert.equal(fixture.context.pendingReplyId, null);
  assert.equal(fixture.focused(), true);
});

test("provider message action reuses an existing chat", async () => {
  const existingChat = { id: "conversation-1", providerId: "provider-1", messages: [] };
  const fixture = createContext({ messages: [existingChat] });

  fixture.context.openProviderConversation("provider-1");
  await Promise.all(fixture.actions);

  assert.equal(fixture.context.state.messages.length, 1);
  assert.equal(fixture.activeConversation(), "conversation-1");
});

test("provider message action creates a conversation in Supabase without sending a message", async () => {
  const rpcCalls = [];
  let messageLoads = 0;
  let dashboardRefreshes = 0;
  const appSupabase = {
    rpc: async (...args) => {
      rpcCalls.push(args);
      return { data: "conversation-1", error: null };
    },
  };
  const fixture = createContext({
    appSupabase,
    loadConversationMessages: async (id, name) => {
      messageLoads++;
      assert.equal(id, "conversation-1");
      assert.equal(name, "Provider");
      return [{ id: "message-1", text: "Hello" }];
    },
    refreshSupabaseState: async () => { dashboardRefreshes++; },
  });

  fixture.context.openProviderConversation("provider-1");
  await Promise.all(fixture.actions);

  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0][0], "start_conversation");
  assert.equal(rpcCalls[0][1].p_other_user_id, "provider-1");
  assert.equal(rpcCalls[0][1].p_booking_id, null);
  assert.equal(fixture.context.state.messages.length, 1);
  assert.equal(fixture.context.state.messages[0].id, "conversation-1");
  assert.equal(fixture.context.state.messages[0].messages[0].text, "Hello");
  assert.equal(messageLoads, 1);
  assert.equal(dashboardRefreshes, 0);
  assert.equal(fixture.activeConversation(), "conversation-1");
});

test("provider chat opening is not blocked by an unrelated dashboard refresh failure", async () => {
  const appSupabase = {
    rpc: async () => ({ data: "conversation-1", error: null }),
  };
  const fixture = createContext({
    appSupabase,
    loadConversationMessages: async () => [],
    refreshSupabaseState: async () => { throw new Error("unrelated dashboard data failed"); },
  });

  fixture.context.openProviderConversation("provider-1");
  await Promise.all(fixture.actions);

  assert.equal(fixture.context.state.messages[0].id, "conversation-1");
  assert.equal(fixture.activeConversation(), "conversation-1");
  assert.equal(fixture.activePage().page, "messages");
});

test("booking message action opens the booking-linked chat directly", async () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "user.js"), "utf8");
  const start = source.indexOf("function openBookingConversation(");
  const end = source.indexOf("async function startConversation(", start);
  const context = {
    appSupabase: {
      rpc: async (name, args) => {
        assert.equal(name, "start_conversation");
        assert.equal(args.p_other_user_id, "student-1");
        assert.equal(args.p_booking_id, "booking-1");
        return { data: "booking-chat-1", error: null };
      },
    },
    state: {
      bookings: [{
        id: "booking-1", providerId: "provider-1", customerId: "student-1", customer: "Student",
      }],
      messages: [],
      blocked: [],
    },
    ownProviderId: () => "provider-1",
    isOwnBooking: booking => booking.providerId === "provider-1",
    getProvider: () => null,
    loadConversationMessages: async (id, name) => {
      assert.equal(id, "booking-chat-1");
      assert.equal(name, "Student");
      return [{ id: "message-1", text: "Hello" }];
    },
    setActiveConversation: id => { context.activeConversationId = id; },
    showPage: (page, options) => { context.activePage = { page, options }; },
    pendingReplyId: "reply-1",
    document: {
      querySelector: () => ({ focus() { context.focused = true; } }),
    },
    runAction: action => { context.action = action(); },
    showToast() {},
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);

  context.openBookingConversation("booking-1");
  await context.action;

  assert.equal(context.state.messages[0].id, "booking-chat-1");
  assert.equal(context.state.messages[0].messages[0].text, "Hello");
  assert.equal(context.activeConversationId, "booking-chat-1");
  assert.equal(context.activePage.page, "messages");
  assert.equal(context.activePage.options.openConversation, true);
  assert.equal(context.focused, true);
  assert.equal(context.pendingReplyId, null);
});

test("incoming pending bookings have an explicit confirmation button", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "user.js"), "utf8");
  assert.match(source, /data-decision="Confirmed"[^>]*>Accept<\/button>/);
});
