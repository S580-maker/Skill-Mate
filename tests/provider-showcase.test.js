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

test("customers are prompted for completed-work reviews and cannot bypass the booking gate", () => {
  assert.match(migration, /create trigger bookings_require_completed_work_review\s+before insert on public\.bookings/);
  assert.match(migration, /Please review your completed work before requesting another booking/);
  assert.match(userScript, /function pendingCustomerReviews\(\)/);
  assert.match(userScript, /function requireCustomerReview\(\)/);
  assert.match(userScript, /if \(requireCustomerReview\(\)\) return;/);
  assert.match(userScript, /review-required-note/);
  assert.match(page, /id="required-review-reminder"/);
});

test("account closure removes uploaded provider CV files", () => {
  assert.match(read("api/_lib/account-delete.js"), /removeStorageFolder\(url, serviceRoleKey, "provider-cvs", userId, true\)/);
});
