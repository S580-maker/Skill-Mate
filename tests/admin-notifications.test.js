const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const adminSource = fs.readFileSync(path.join(root, "admin-auth.js"), "utf8");

test("admin notification bell opens an accessible notifications dialog", () => {
  const vercelHtml = fs.readFileSync(path.join(root, "api/_lib/admin.html"), "utf8");
  assert.equal(vercelHtml, adminHtml);
  assert.match(adminHtml, /aria-haspopup="dialog" aria-controls="admin-notifications-dialog"/);
  assert.match(adminHtml, /<dialog[^>]+id="admin-notifications-dialog"/);
  assert.match(adminHtml, /id="admin-notifications-list"/);
  assert.match(adminHtml, /data-close-admin-notifications/);
});

test("admin notifications are scoped to the signed-in admin and only marked read individually", () => {
  assert.match(adminSource, /\.select\("id, title, body, read_at, created_at"\)[\s\S]*?\.eq\("user_id", window\.adminProfile\.id\)/);
  assert.match(adminSource, /\.update\(\{ read_at: readAt \}\)\.eq\("id", notification\.id\)\.eq\("user_id", window\.adminProfile\.id\)\.select\("id"\)/);
  assert.match(adminSource, /markRead\.textContent = "Mark as read"/);
  assert.doesNotMatch(adminSource, /\.update\(\{ read_at: new Date\(\)\.toISOString\(\) \}\)\.in\("id"/);
});

test("admin unread notification badge reflects the unread count accessibly", () => {
  const start = adminSource.indexOf("function updateAdminNotificationBadge(");
  const end = adminSource.indexOf("\nasync function refreshAdminNotificationBadge", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const badge = { hidden: true };
  const button = {
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const context = {
    document: {
      querySelector(selector) {
        return selector === ".notification-dot" ? badge : button;
      },
    },
  };
  vm.runInNewContext(`${adminSource.slice(start, end)}; updateAdminNotificationBadge(3);`, context);
  assert.equal(badge.hidden, false);
  assert.equal(button.attributes["aria-label"], "Notifications, 3 unread");

  vm.runInNewContext("updateAdminNotificationBadge(0)", context);
  assert.equal(badge.hidden, true);
  assert.equal(button.attributes["aria-label"], "Notifications");
});
