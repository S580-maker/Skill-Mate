const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const migration = read("supabase/migrations/20261104120000_provider_showcase_reviews.sql");
const userScript = read("user.js");
const page = read("index.html");

test("provider showcase exposes portfolio, reviews, skills and a signed private CV", () => {
  assert.match(migration, /add column if not exists cv_path text/);
  assert.match(migration, /values \('provider-cvs', 'provider-cvs', false, 5242880, array\['application\/pdf'\]\)/);
  assert.match(migration, /create policy "Signed-in students can read provider CVs"\s+on storage\.objects for select to authenticated/);
  assert.match(migration, /p\.skills, p\.cv_path, p\.cv_name/);
  assert.match(migration, /as completed_bookings/);
  assert.match(userScript, /createSignedUrl\(provider\.cvPath, 900\)/);
  assert.match(userScript, /Selected work/);
  assert.match(userScript, /Student reviews/);
  assert.match(userScript, /Education &amp; skills/);
  assert.match(page, /id="settings-cv-file" type="file" accept="application\/pdf,\.pdf"/);
});

test("completed-work reviews are optional and do not block another booking", () => {
  const growthMigration = read("supabase/migrations/20261106100000_marketplace_growth.sql");
  assert.match(growthMigration, /drop trigger if exists bookings_require_completed_work_review/);
  assert.match(userScript, /function pendingCustomerReviews\(\)/);
  assert.doesNotMatch(userScript, /requireCustomerReview\(/);
  assert.match(read("marketplace-growth.js"), /data-dismiss-reviews/);
  assert.match(userScript, /You can book again at any time/);
  assert.match(page, /id="required-review-reminder"/);
});

test("account closure removes uploaded provider CV files", () => {
  assert.match(read("api/_lib/account-delete.js"), /removeStorageFolder\(url, serviceRoleKey, "provider-cvs", userId, true\)/);
});
