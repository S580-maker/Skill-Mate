const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "user.js"), "utf8");
const start = source.indexOf("function currentChatStatus(");
const end = source.indexOf("function clearChatConnectionStatusTimer(", start);

function createStatusFixture(connection) {
  const chat = { id: "chat-1", messages: [] };
  const header = { dataset: {} };
  const status = {
    dataset: {},
    textContent: "",
    closest: selector => selector === ".chat-header" ? header : null,
  };
  const context = {
    appUser: { id: "viewer" },
    state: { messages: [chat], activePage: "messages" },
    activeConversationId: chat.id,
    messagePresence: new Map([[chat.id, { connection }]]),
    formatChatTime: () => "now",
    document: { querySelector: selector => selector === "#chat-status" ? status : null },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  return { context, status, header, chat };
}

test("chat header reports connecting and restored realtime states", () => {
  const fixture = createStatusFixture("connecting");
  assert.equal(fixture.context.currentChatStatus(fixture.chat), "Connecting…");
  fixture.context.renderChatHeaderStatus();
  assert.equal(fixture.status.textContent, "Connecting…");
  assert.equal(fixture.status.dataset.status, "connecting");

  fixture.context.messagePresence.set(fixture.chat.id, { connection: "restored" });
  fixture.context.renderChatHeaderStatus();
  assert.equal(fixture.status.textContent, "Connection restored");
  assert.equal(fixture.status.dataset.status, "restored");
  assert.equal(fixture.header.dataset.connection, "restored");
});

test("restored connection status has green indicator and avatar ring styles", () => {
  const styles = fs.readFileSync(path.join(__dirname, "..", "user.css"), "utf8");
  assert.match(styles, /\.chat-header small\[data-status="restored"\][^{]*\{[^}]*color:\s*var\(--success\)/);
  assert.match(styles, /\.chat-header small\[data-status="restored"\]::before\s*\{[^}]*background:\s*var\(--success\)[^}]*box-shadow:/);
  assert.match(styles, /\.chat-header\[data-connection="restored"\] \.person-avatar\s*\{[^}]*var\(--success\)/);
});
