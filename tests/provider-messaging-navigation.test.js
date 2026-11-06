const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "user.js"), "utf8");
const start = source.indexOf("function openProviderConversation(");
const end = source.indexOf("async function startConversation(", start);
const openProviderConversationSource = source.slice(start, end);

function createContext({ messages = [], appSupabase = null, refreshSupabaseState = async () => {} } = {}) {
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
  const appSupabase = {
    rpc: async (...args) => {
      rpcCalls.push(args);
      return { data: "conversation-1", error: null };
    },
  };
  const fixture = createContext({ appSupabase });

  fixture.context.openProviderConversation("provider-1");
  await Promise.all(fixture.actions);

  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0][0], "start_conversation");
  assert.equal(rpcCalls[0][1].p_other_user_id, "provider-1");
  assert.equal(rpcCalls[0][1].p_booking_id, null);
  assert.equal(fixture.context.state.messages.length, 1);
  assert.equal(fixture.context.state.messages[0].id, "conversation-1");
  assert.equal(fixture.context.state.messages[0].messages.length, 0);
  assert.equal(fixture.activeConversation(), "conversation-1");
});
