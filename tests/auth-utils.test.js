const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { maskEmail, getResendRetryDelay } = require("../auth-utils");

const root = path.join(__dirname, "..");
const headers = (values) => ({ headers: { get: (name) => values[name] ?? null } });

test("maskEmail keeps the first character and domain, and passes through invalid input", () => {
  assert.equal(maskEmail("ama@school.edu"), "a••••@school.edu");
  assert.equal(maskEmail("abcdefghijk@school.edu"), "a•••••••@school.edu");
  assert.equal(maskEmail("not-an-email"), "not-an-email");
});

test("getResendRetryDelay prefers retry-after, then ratelimit-reset, then the error text", () => {
  assert.equal(getResendRetryDelay(headers({ "retry-after": "12" }), ""), 12);
  assert.equal(getResendRetryDelay(headers({ "ratelimit-reset": "7.2" }), ""), 8);
  assert.equal(getResendRetryDelay(headers({}), "Please wait 45 seconds"), 45);
  assert.equal(getResendRetryDelay(headers({}), "boom"), 30);
});

test("sign-in and recovery pages load the shared helpers instead of redefining them", () => {
  for (const [page, script] of [["login.html", "auth.js"], ["forgot-password.html", "forgot-password.js"]]) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    assert.ok(html.indexOf("auth-utils.js") !== -1 && html.indexOf("auth-utils.js") < html.indexOf(script), `${page} loads auth-utils.js first`);
    assert.doesNotMatch(fs.readFileSync(path.join(root, script), "utf8"), /function (maskEmail|getResendRetryDelay)\b/);
  }
});
