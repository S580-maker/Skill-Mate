const { test } = require("node:test");
const assert = require("node:assert/strict");
const { contentSecurityPolicy, serializePolicy } = require("../api/_lib/content-security-policy");
const vercel = require("../vercel.json");

test("hosted and Express production CSP agree and block executable inline content", () => {
  const policy = contentSecurityPolicy({ production: true, supabaseUrl: "https://example.supabase.co" });
  assert.deepEqual(policy["script-src"], ["'self'"]);
  assert.deepEqual(policy["script-src-attr"], ["'none'"]);
  assert.deepEqual(policy["object-src"], ["'none'"]);
  assert.ok(policy["connect-src"].includes("wss:"));
  assert.ok(policy["style-src"].includes("'unsafe-inline'"), "Existing SVG/shadow-root styles still work");
  const header = vercel.headers[0].headers.find(header => header.key === "Content-Security-Policy");
  assert.equal(header.value, serializePolicy(policy));
});

test("CSP preserves local preview embedding and explicitly configured HTTP Supabase origins", () => {
  const policy = contentSecurityPolicy({ production: false, supabaseUrl: "http://127.0.0.1:54321/rest/v1" });
  assert.equal(policy["frame-ancestors"], undefined);
  assert.ok(policy["connect-src"].includes("http://127.0.0.1:54321"));
  assert.ok(policy["connect-src"].includes("ws://127.0.0.1:54321"));
  assert.ok(policy["img-src"].includes("http://127.0.0.1:54321"));
  assert.ok(!contentSecurityPolicy({ supabaseUrl: "https://example.supabase.co" })["connect-src"].includes("http:"));
});
