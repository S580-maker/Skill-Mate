const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const clientSource = fs.readFileSync(path.join(root, "supabase-client.js"), "utf8");
const adminSource = fs.readFileSync(path.join(root, "admin-auth.js"), "utf8");

test("expired secure admin sessions retain HTTP status so the dashboard can return to sign-in", async () => {
  const context = {
    window: {},
    fetch: async () => ({
      status: 401,
      ok: false,
      json: async () => ({ error: "Your sign-in session has expired. Please sign in again." }),
    }),
    console: { error() {} },
  };
  vm.runInNewContext(clientSource, context);

  await assert.rejects(
    context.window.syncSkillmateServerSession({ access_token: "expired-token" }),
    (error) => error.status === 401 && /session has expired/i.test(error.message),
  );
  assert.match(adminSource, /if \(error\.status === 401\)[\s\S]*?clearExpiredSkillmateSession\(\)[\s\S]*?login\.html\?next=admin/);
});
