const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const adminSource = fs.readFileSync(path.join(root, "admin-auth.js"), "utf8");

test("demand-gap aggregation compares distinct interested buyers with distinct active providers", () => {
  const start = adminSource.indexOf("function buildAdminDemandGapRows(");
  const end = adminSource.indexOf("\nasync function fetchAllAdminRows", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const context = {};
  vm.runInNewContext(`${adminSource.slice(start, end)}; this.rows = buildAdminDemandGapRows(
    [
      { category: "Tutoring", requester_id: "buyer-1" },
      { category: "tutoring", requester_id: "buyer-1" },
      { category: "Tutoring", requester_id: "buyer-2" },
      { category: "Design", requester_id: "buyer-3" },
      { category: "Design", requester_id: "buyer-4" },
      { category: "Design", requester_id: "buyer-5" }
    ],
    [
      { category: "TUTORING", provider_id: "provider-1" },
      { category: "Tutoring", provider_id: "provider-1" },
      { category: "Design", provider_id: "provider-6" },
      { category: "Design", provider_id: "provider-7" },
      { category: "Photography", provider_id: "provider-8" }
    ]
  );`, context);

  assert.deepEqual(JSON.parse(JSON.stringify(context.rows)), [
    { category: "Design", buyerCount: 3, requestCount: 3, providerCount: 2, gap: 1, priority: "Recruit now" },
    { category: "Tutoring", buyerCount: 2, requestCount: 3, providerCount: 1, gap: 1, priority: "Build supply" },
    { category: "Photography", buyerCount: 0, requestCount: 0, providerCount: 1, gap: 0, priority: "No open demand" },
  ]);
});

test("demand-gap query uses current open buyer requests and active listings with real paginated rows", () => {
  assert.match(adminSource, /from\("campus_requests"\)[\s\S]*?\.select\("id, category, requester_id"\)[\s\S]*?\.eq\("status", "open"\)[\s\S]*?\.gt\("expires_at", new Date\(\)\.toISOString\(\)\)/);
  assert.match(adminSource, /from\("services"\)[\s\S]*?\.select\("id, category, provider_id"\)[\s\S]*?\.eq\("is_active", true\)/);
  assert.match(adminSource, /query\.range\(offset, offset \+ pageSize - 1\)/);
  assert.match(fs.readFileSync(path.join(root, "admin.html"), "utf8"), /“Recruit now” means 3\+ buyers/);
});

test("demand gaps are available in both admin entry points and have mobile-friendly markup", () => {
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  assert.equal(fs.readFileSync(path.join(root, "api/_lib/admin.html"), "utf8"), html);
  assert.match(html, /href="#demand-gaps"[\s\S]*?<span>Provider demand<\/span>/);
  assert.match(html, /id="demand-gaps"[\s\S]*?id="demand-gap-focus-count"[\s\S]*?id="demand-gap-request-count"[\s\S]*?id="demand-gap-category-count"[\s\S]*?id="demand-gap-rows"/);
  assert.match(html, /Interested buyers[\s\S]*?Active providers[\s\S]*?Recommended next step/);
  assert.doesNotMatch(html, /Supply gap = distinct buyers|High priority means/);
  assert.match(html, /id="demand-gap-error" role="alert" hidden/);
  assert.match(fs.readFileSync(path.join(root, "styles.css"), "utf8"), /@media \(max-width: 600px\)[\s\S]*?\.demand-gap-row \{ grid-template-columns: repeat\(2/);
});
