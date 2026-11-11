const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "user.js"), "utf8");
const start = source.indexOf("function providerAvatarMarkup(");
const end = source.indexOf("\nfunction listingImage(", start);
const context = {
  escapeHTML: value => String(value ?? "").replace(/[&<>"']/g, ""),
  window: { skillflexMarketplace: { safeImageUrl: () => "" } },
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

test("verified provider avatars receive the verified-ring class only when verified", () => {
  assert.match(context.providerAvatarMarkup({ color: "blue", initials: "AB", verified: true }), /provider-avatar avatar-blue is-verified/);
  assert.match(context.providerAvatarMarkup({ color: "blue", initials: "AB", verified: false }), /provider-avatar avatar-blue"/);
  assert.doesNotMatch(context.providerAvatarMarkup({ color: "blue", initials: "AB", verified: false }), /is-verified/);
});

test("verified avatar ring uses the success color and remains green on hover", () => {
  const styles = fs.readFileSync(path.join(__dirname, "..", "user.css"), "utf8");
  assert.match(styles, /\.provider-avatar\.is-verified\s*\{[^}]*border-color:\s*var\(--success\)[^}]*box-shadow:\s*0 0 0 2px var\(--success\)/);
  assert.match(styles, /\.provider-profile-trigger:hover \.provider-avatar\.is-verified\s*\{[^}]*var\(--success\)/);
});
