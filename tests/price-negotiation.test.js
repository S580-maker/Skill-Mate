const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "migrations", "20261103100000_price_negotiation.sql"),
  "utf8",
);
const fixedModeMigration = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "migrations", "20261105100000_fixed_price_negotiation_mode.sql"),
  "utf8",
);
const consolidatedModesMigration = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "migrations", "20261105110000_consolidated_negotiation_modes.sql"),
  "utf8",
);
const userScript = fs.readFileSync(path.join(__dirname, "..", "user.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("private minimums are isolated from public service listings", () => {
  assert.match(migration, /alter column negotiation_mode drop default/);
  assert.match(migration, /revoke insert, update on public\.services from authenticated/);
  assert.match(migration, /create or replace function public\.save_service_listing/);
  assert.match(migration, /create table public\.service_negotiation_settings/);
  assert.match(migration, /on public\.service_negotiation_settings for select to authenticated\s+using \(provider_id = \(select auth\.uid\(\)\)\)/);
  assert.match(migration, /revoke all on public\.service_negotiation_settings from public, anon, authenticated/);
  const directoryView = migration.slice(
    migration.indexOf("create or replace view public.provider_directory"),
    migration.indexOf("create or replace view public.booking_directory"),
  );
  assert.doesNotMatch(directoryView, /minimum_price/);
  assert.match(migration, /p_minimum_price numeric/);
});

test("offer decisions are transactional, authorized and enforce private minimums", () => {
  assert.match(migration, /select \* into v_negotiation from public\.price_negotiations\s+where id = v_offer\.negotiation_id for update/);
  assert.match(migration, /v_user_id = v_offer\.proposer_id/);
  assert.match(migration, /v_offer\.status <> 'pending'/);
  assert.match(migration, /v_offer\.amount < v_minimum/);
  assert.match(migration, /update public\.price_offers set status = 'countered'/);
  assert.match(migration, /accepted_offer_id = v_offer\.id/);
});

test("agreed booking creation uses the immutable accepted amount and original listed price", () => {
  const bookingFunction = migration.slice(
    migration.indexOf("create or replace function public.create_booking_from_price_agreement"),
    migration.indexOf("create or replace view public.provider_directory"),
  );
  assert.match(bookingFunction, /v_negotiation\.state <> 'agreed'/);
  assert.match(bookingFunction, /v_negotiation\.agreed_price, v_negotiation\.listed_price/);
  assert.match(bookingFunction, /price_negotiation_id = p_negotiation_id/);
  assert.match(migration, /price_negotiation_id is null/);
  assert.doesNotMatch(migration, /paystack|hubtel|mobile money/i);
});

test("pricing modes are simplified, legacy modes migrate safely and fixed services reject negotiation", () => {
  assert.match(index, /name="service-negotiation-mode" type="radio" value="fixed"/);
  assert.match(consolidatedModesMigration, /check \(negotiation_mode in \('fixed', 'negotiation', 'hybrid'\)\)/);
  assert.match(consolidatedModesMigration, /set negotiation_mode = 'negotiation'\s+where negotiation_mode in \('chat', 'controlled'\)/);
  assert.match(consolidatedModesMigration, /create or replace function public\.normalize_legacy_negotiation_mode/);
  assert.match(fixedModeMigration, /set negotiation_mode = 'chat'\s+where negotiation_mode = 'controlled'/);
  assert.match(fixedModeMigration, /new\.negotiation_mode := 'chat'/);
  assert.match(consolidatedModesMigration, /v_service\.negotiation_mode = 'hybrid'\s+then coalesce\(nullif\(btrim\(v_offer\.message\), ''\), v_service\.description\)\s+else v_service\.description end/);
  assert.match(fixedModeMigration, /create trigger reject_fixed_price_negotiation\s+before insert or update on public\.price_negotiations/);
  assert.match(fixedModeMigration, /create trigger reject_fixed_price_offer\s+before insert or update on public\.price_offers/);
  assert.match(userScript, /negotiationMode !== "fixed"/);
  assert.match(userScript, /service\.negotiationMode === "fixed" \? "Fixed Price"/);
  assert.match(userScript, /service\.negotiationMode !== "fixed" \? `<span class="detail-negotiation-actions">/);
  assert.match(userScript, /if \(!isProvider && \["negotiation", "hybrid"\]\.includes\(service\.negotiationMode\)\)/);
  assert.match(userScript, /action\.textContent = "Propose a price"/);
  assert.match(consolidatedModesMigration, /Fixed Price does not use a minimum price/);
});
