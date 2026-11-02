const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "migrations", "20261105090000_api_security_hardening.sql"),
  "utf8",
);
const schema = fs.readFileSync(path.join(__dirname, "..", "supabase", "schema.sql"), "utf8");

test("Supabase hardening migration enables RLS and OTP verification on every public table", () => {
  assert.match(migration, /namespace\.nspname = 'public'/);
  assert.match(migration, /alter table %I\.%I enable row level security/);
  assert.match(migration, /create policy %I on %I\.%I as restrictive for all to authenticated using \(public\.is_verified_session\(\)\) with check \(public\.is_verified_session\(\)\)/);
});

test("Supabase hardening migration removes anonymous grants and protects the CV bucket", () => {
  assert.match(migration, /revoke all privileges on schema public from public, anon/);
  assert.match(migration, /revoke all privileges on all tables in schema public from public, anon/);
  assert.match(migration, /revoke execute on all functions in schema public from public, anon/);
  assert.match(migration, /'student-verification-ids', 'provider-cvs'/);
  assert.match(migration, /\('provider-cvs', 'provider-cvs', false, 5242880/);
});

test("initial schema applies the same RLS gate and storage restrictions", () => {
  assert.match(schema, /create policy %I on %I\.%I as restrictive for all to authenticated using \(public\.is_verified_session\(\)\)/);
  assert.match(schema, /'student-verification-ids', 'provider-cvs'/);
  assert.match(schema, /\('support-screenshots', 'support-screenshots', false, 5242880/);
});
