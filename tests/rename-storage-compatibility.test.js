const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
const messageId = "11111111-1111-4111-8111-111111111111";
const nextId = "22222222-2222-4222-8222-222222222222";
const pending = { id: messageId, conversationId: "chat", text: "A saved question", createdAt: "2026-11-11T10:00:00Z" };
const draft = { note: "Keep these booking details", date: "2026-11-15" };
const item = value => JSON.stringify({ savedAt: Date.now(), value });

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values, blocked: false, rejectNew: false,
    getItem(key) {
      if (this.blocked) throw new Error("Storage access blocked");
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (this.blocked || (this.rejectNew && !values.has(key))) throw new Error("Storage unavailable or full");
      values.set(key, String(value));
    },
    removeItem(key) {
      if (this.blocked) throw new Error("Storage access blocked");
      values.delete(key);
    },
  };
}
function chatFixture(localStorage) {
  const notices = [];
  const context = {
    appUser: { id: "account" }, localStorage, chatDrafts: new Map(), pendingOutgoingMessages: new Map(),
    showToast: message => notices.push(message), console: { error() {} }, linkMessageReplies: messages => messages,
  };
  vm.createContext(context);
  const source = read("user.js");
  vm.runInContext(source.slice(source.indexOf("function chatDraftStorageKey"), source.indexOf("function retainLocalOutgoingMessages")), context);
  return { context, notices };
}
function journeyFixture(sessionStorage) {
  const listeners = new Map();
  const node = { addEventListener() {}, elements: [] };
  let allocated = 0;
  const context = {
    appUser: { id: "account" }, appSupabase: null, sessionStorage, bookingDrafts: new Map(),
    crypto: { randomUUID() { allocated++; return nextId; } }, navigator: {},
    document: { querySelector: () => node, addEventListener: (name, callback) => listeners.set(name, callback) },
    window: { addEventListener() {} }, setTimeout, clearTimeout,
  };
  vm.runInNewContext(read("journey-state.js"), context);
  return {
    api: context.window.skillflexJourney, allocated: () => allocated,
    saved: () => listeners.get("skillflex:booking-save")({ detail: {
      state: "saved", providerId: "provider", serviceId: "service", agreementId: "", requestId: messageId, submittedDraft: draft,
    } }),
  };
}
const oldChat = {
  "skillmate-chat-drafts:account": JSON.stringify({ chat: "Draft text" }),
  "skillmate-pending-messages:account": JSON.stringify([pending]),
};
const oldJourney = () => ({
  "skillmate-journey-v1:account:booking:provider:service:": item(draft),
  "skillmate-journey-v1:account:booking-attempts": item([["request-signature", messageId]]),
});

test("rename restores only this account's chat drafts and retains queued message identity through reconciliation", () => {
  const persisted = storage({ ...oldChat, "skillmate-chat-drafts:other": JSON.stringify({ chat: "Other account" }) });
  const { context } = chatFixture(persisted);
  context.loadChatDrafts(); context.loadPendingMessages();
  assert.equal(context.chatDrafts.get("chat"), "Draft text");
  assert.equal(context.pendingOutgoingMessages.get(messageId).text, pending.text);
  assert.equal(context.pendingOutgoingMessages.get(messageId).senderId, "account");
  assert.equal(context.pendingOutgoingMessages.get(messageId).sendStatus, "failed");
  assert.equal(persisted.getItem("skillmate-chat-drafts:account"), null);
  assert.equal(persisted.getItem("skillmate-pending-messages:account"), null);
  assert.ok(persisted.getItem("skillmate-chat-drafts:other"));
  context.saveChatDraft("chat", "");
  const reconciled = context.mergePendingMessages("chat", [{ ...pending, sender: "You" }]);
  assert.equal(reconciled.length, 1);
  assert.equal(context.pendingOutgoingMessages.size, 0);
  const reloaded = chatFixture(persisted).context;
  reloaded.loadChatDrafts(); reloaded.loadPendingMessages();
  assert.equal(reloaded.chatDrafts.size, 0);
  assert.equal(reloaded.pendingOutgoingMessages.size, 0);
});

test("current empty chat values override legacy content and later saves retire that legacy content", () => {
  const persisted = storage({ ...oldChat, "skillflex-chat-drafts:account": "{}", "skillflex-pending-messages:account": "[]" });
  const { context } = chatFixture(persisted);
  context.loadChatDrafts(); context.loadPendingMessages();
  assert.equal(context.chatDrafts.size, 0);
  assert.equal(context.pendingOutgoingMessages.size, 0);
  context.saveChatDraft("chat", ""); context.persistPendingMessages();
  assert.equal(persisted.getItem("skillmate-chat-drafts:account"), null);
  assert.equal(persisted.getItem("skillmate-pending-messages:account"), null);
});

test("quota during chat migration retains the original IDs and persists clears in the existing slots", () => {
  const persisted = storage(oldChat); persisted.rejectNew = true;
  const { context } = chatFixture(persisted);
  context.loadChatDrafts(); context.loadPendingMessages();
  assert.equal(context.pendingOutgoingMessages.get(messageId).id, messageId);
  context.saveChatDraft("chat", "");
  context.mergePendingMessages("chat", [{ ...pending }]);
  assert.equal(persisted.getItem("skillmate-chat-drafts:account"), "{}");
  assert.equal(persisted.getItem("skillmate-pending-messages:account"), "[]");
  persisted.rejectNew = false;
  const reloaded = chatFixture(persisted).context;
  reloaded.loadChatDrafts(); reloaded.loadPendingMessages();
  assert.equal(reloaded.chatDrafts.size, 0);
  assert.equal(reloaded.pendingOutgoingMessages.size, 0);
  assert.equal(persisted.getItem("skillmate-chat-drafts:account"), null);
});

test("blocked chat storage preserves in-page edits and reports unavailable durable storage", () => {
  const persisted = storage(oldChat);
  const { context, notices } = chatFixture(persisted);
  context.loadChatDrafts(); context.loadPendingMessages(); persisted.blocked = true;
  context.saveChatDraft("chat", "New draft while blocked");
  context.mergePendingMessages("chat", [{ ...pending }]);
  context.loadChatDrafts(); context.loadPendingMessages();
  assert.equal(context.chatDrafts.get("chat"), "New draft while blocked");
  assert.equal(context.pendingOutgoingMessages.size, 0);
  assert.equal(notices.length, 2);
  const fresh = chatFixture(persisted);
  assert.doesNotThrow(() => { fresh.context.loadChatDrafts(); fresh.context.loadPendingMessages(); });
  assert.equal(fresh.notices.length, 2);
});

test("rename restores a booking draft and reuses its request ID, then persists their successful removal", () => {
  const persisted = storage(oldJourney());
  const journey = journeyFixture(persisted);
  assert.equal(journey.api.bookingDraft("provider", "service").note, draft.note);
  assert.equal(journey.api.requestId("request-signature"), messageId);
  assert.equal(journey.api.requestId("request-signature"), messageId);
  assert.equal(journey.allocated(), 0);
  journey.saved();
  const reloaded = journeyFixture(persisted);
  assert.equal(reloaded.api.bookingDraft("provider", "service"), null);
  assert.equal(reloaded.api.requestId("request-signature"), nextId);
  assert.equal(persisted.getItem("skillmate-journey-v1:account:booking:provider:service:"), null);
  assert.equal(persisted.getItem("skillmate-journey-v1:account:booking-attempts"), null);
});

test("booking tombstones and empty current attempts prevent legacy drafts or retry IDs from returning", () => {
  const persisted = storage({ ...oldJourney(),
    "skillflex-journey-v1:account:booking:provider:service:": item(null),
    "skillflex-journey-v1:account:booking-attempts": item([]),
  });
  const journey = journeyFixture(persisted);
  assert.equal(journey.api.bookingDraft("provider", "service"), null);
  assert.equal(journey.api.requestId("request-signature"), nextId);
  journey.saved();
  assert.equal(persisted.getItem("skillmate-journey-v1:account:booking-attempts"), null);
  assert.equal(journeyFixture(persisted).api.bookingDraft("provider", "service"), null);
});

test("quota during booking migration can reuse old slots and keeps successful clears after reload", () => {
  const persisted = storage(oldJourney()); persisted.rejectNew = true;
  const journey = journeyFixture(persisted);
  assert.equal(journey.api.bookingDraft("provider", "service").note, draft.note);
  assert.equal(journey.api.requestId("request-signature"), messageId);
  journey.saved();
  const reloaded = journeyFixture(persisted);
  assert.equal(reloaded.api.bookingDraft("provider", "service"), null);
  assert.equal(reloaded.api.requestId("request-signature"), nextId);
  persisted.rejectNew = false;
  assert.equal(journeyFixture(persisted).api.bookingDraft("provider", "service"), null);
});

test("blocked booking storage keeps restored identity and cleared drafts in this page without throwing", () => {
  const persisted = storage(oldJourney());
  const journey = journeyFixture(persisted);
  journey.api.bookingDraft("provider", "service");
  assert.equal(journey.api.requestId("request-signature"), messageId);
  persisted.blocked = true;
  assert.equal(journey.api.requestId("request-signature"), messageId);
  assert.doesNotThrow(journey.saved);
  assert.equal(journey.api.bookingDraft("provider", "service"), null);
  assert.equal(journey.api.requestId("request-signature"), nextId);
  assert.equal(journeyFixture(persisted).api.bookingDraft("provider", "service"), null);
});

test("legacy booking expiry is preserved and malformed current data never falls back to an old draft", () => {
  const expired = { savedAt: Date.now() - 25 * 60 * 60 * 1000, value: draft };
  const persisted = storage({ ...oldJourney(), "skillmate-journey-v1:account:booking:provider:service:": JSON.stringify(expired) });
  assert.equal(journeyFixture(persisted).api.bookingDraft("provider", "service"), null);
  assert.equal(JSON.parse(persisted.getItem("skillflex-journey-v1:account:booking:provider:service:")).savedAt, expired.savedAt);
  persisted.values.set("skillflex-journey-v1:account:booking:provider:service:", "invalid json");
  persisted.values.set("skillmate-journey-v1:account:booking:provider:service:", item(draft));
  assert.equal(journeyFixture(persisted).api.bookingDraft("provider", "service"), null);
});
