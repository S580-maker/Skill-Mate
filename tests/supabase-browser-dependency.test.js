const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.join(__dirname, "..");
test("browser SDK is pinned, intact and loaded before client initialization on every auth entry point", () => {
  const metadata = JSON.parse(fs.readFileSync(path.join(root, "assets/vendor/supabase-source.json"), "utf8"));
  const bytes = fs.readFileSync(path.join(root, "assets/vendor", metadata.file));
  assert.equal("sha384-" + crypto.createHash("sha384").update(bytes).digest("base64"), metadata.integrity);
  assert.match(fs.readFileSync(path.join(root, "assets/vendor/supabase-LICENSE.txt"), "utf8"), /MIT/);
  for (const page of ["admin.html", "api/_lib/admin.html", "index.html", "login.html", "onboarding.html", "reset.html"]) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    assert.ok(html.includes(`src="/assets/vendor/${metadata.file}" integrity="${metadata.integrity}"`), page);
    const sdk = html.indexOf(metadata.file), config = html.indexOf('src="supabase-config.js"'), client = html.indexOf('src="supabase-client.js');
    assert.ok(sdk >= 0 && sdk < config && config < client, `${page}: dependency order is preserved`);
    assert.doesNotMatch(html, /src="https:[^"]*supabase-js/);
  }
});
