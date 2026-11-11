const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "auth-callback.js"), "utf8");

function runCallback(href) {
  const currentUrl = new URL(href);
  let redirect = null;
  vm.runInNewContext(source, {
    URL,
    URLSearchParams,
    window: {
      location: {
        href: currentUrl.href,
        origin: currentUrl.origin,
        search: currentUrl.search,
        hash: currentUrl.hash,
        replace: value => { redirect = value; },
      },
    },
  });
  return redirect;
}

test("Google OAuth hash callback is handed to login with verification enabled", () => {
  const callbackHash = "#access_token=oauth-token&refresh_token=refresh-token";
  const redirect = new URL(runCallback(`https://skillflex.example/landing.html${callbackHash}`));

  assert.equal(redirect.pathname, "/login.html");
  assert.equal(redirect.searchParams.get(  "skillflex-google-otp"), "1");
  assert.equal(redirect.hash, callbackHash);
});

test("OAuth code callback parameters are preserved for login", () => {
  const redirect = new URL(runCallback(
    "https://skillflex.example/landing.html?code=oauth-code&state=state-value&next=admin",
  ));

  assert.equal(redirect.pathname, "/login.html");
  assert.equal(redirect.searchParams.get(  "skillflex-google-otp"), "1");
  assert.equal(redirect.searchParams.get("code"), "oauth-code");
  assert.equal(redirect.searchParams.get("state"), "state-value");
  assert.equal(redirect.searchParams.get("next"), "admin");
  assert.equal(redirect.searchParams.get("error"), null);
});

test("regular landing page visits stay on the landing page", () => {
  assert.equal(runCallback("https://skillflex.example/landing.html#home"), null);
});
