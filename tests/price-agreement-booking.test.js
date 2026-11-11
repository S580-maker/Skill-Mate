const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261104130000_customer_confirmed_price_agreement_bookings.sql"),
  "utf8",
);
const userScript = fs.readFileSync(path.join(root, "user.js"), "utf8") + fs.readFileSync(path.join(__dirname, "..", "booking-ui.js"), "utf8") + fs.readFileSync(path.join(__dirname, "..", "provider-profile.js"), "utf8");
const userStyle = fs.readFileSync(path.join(root, "user.css"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const notifications = fs.readFileSync(path.join(root, "notifications.js"), "utf8");

test("accepting an offer records an agreement without creating a booking", () => {
  const decisionFunction = migration.slice(
    migration.indexOf("create or replace function public.decide_price_offer"),
    migration.indexOf("create or replace function public.create_booking_from_price_agreement"),
  );
  assert.match(decisionFunction, /insert into public\.price_agreements/);
  assert.match(decisionFunction, /agreed_scope_snapshot = v_scope/);
  assert.doesNotMatch(decisionFunction, /insert into public\.bookings/);
});

test("agreement booking RPC uses stored terms and creates a single pending request", () => {
  const bookingFunction = migration.slice(
    migration.indexOf("create or replace function public.create_booking_from_price_agreement"),
    migration.indexOf("create function public.propose_booking_appointment"),
  );
  assert.match(bookingFunction, /where id = p_negotiation_id and customer_id = v_user_id/);
  assert.match(bookingFunction, /v_agreement\.agreed_price, v_agreement\.listed_price/);
  assert.match(bookingFunction, /v_agreement\.id, v_agreement\.scope_snapshot, v_agreement\.currency/);
  assert.match(bookingFunction, /if found then return v_booking/);
  assert.match(bookingFunction, /p_scheduled_at is null or p_scheduled_at <= now\(\)/);
});

test("appointment changes require a customer-approved proposal", () => {
  assert.match(migration, /create function public\.propose_booking_appointment/);
  assert.match(migration, /create function public\.respond_booking_appointment/);
  assert.match(migration, /p_accept boolean/);
  assert.match(migration, /p\.status = 'accepted' and p\.responded_by = auth\.uid\(\)/);
  assert.match(migration, /status = case when p_accept then 'accepted' else 'rejected' end/);
  assert.doesNotMatch(migration, /proposed_at timestamptz not null check \(proposed_at > now\(\)\)/);
});

test("booking directory keeps existing view columns in place and appends new columns", () => {
  const viewDefinition = migration.slice(
    migration.indexOf("create or replace view public.booking_directory"),
    migration.indexOf("drop policy if exists \"Students request bookings for another provider\""),
  );
  assert.match(viewDefinition, /b\.note, b\.agreed_price, b\.currency, b\.status,\s+customer\.full_name as customer_name, provider\.full_name as provider_name,\s+s\.title as service_title, s\.category, b\.listed_price, b\.price_negotiation_id,\s+b\.location,/);
});

test("agreed booking UI requires customer confirmation and exposes time approval", () => {
  assert.match(index, /id="booking-confirm-details" type="checkbox"/);
  assert.match(userScript, /document\.querySelector\("#booking-confirm-details"\)\.required = Boolean\(negotiation\)/);
  assert.match(userScript, /p_location: pendingBooking\.requestedLocation/);
  assert.match(userScript, /data-appointment-response="accept"/);
  assert.match(userScript, /data-appointment-response="reject"/);
  assert.match(userScript, /p_proposed_at: proposedAt\.toISOString\(\)/);
  assert.match(userScript, /p_accept: accept/);
  assert.match(notifications, /conversation_id, booking_id/);
  assert.match(notifications, /skillflex:open-booking/);
  assert.match(userScript, /skillflex:open-booking/);
});

test("existing chats expose the compact service bar and agreed booking link", () => {
  assert.match(userScript, /const chatServices = \[\.\.\.serviceMap\.values\(\)\]/);
  assert.match(userScript, /actions\.className = "chat-negotiation-actions"/);
  assert.match(userScript, /propose\.dataset\.chatPricePropose = ""/);
  assert.match(userScript, /propose\.textContent = "Propose Price"/);
  assert.match(userScript, /selector\.dataset\.chatServiceSelect = ""/);
  assert.match(userScript, /action === "counter" \|\| action === "proposal" \|\| action === "initial"/);
  assert.match(userScript, /function createChatPriceOfferCard/);
  assert.match(userScript, /data-negotiation-chat="\$\{escapeHTML\(booking\.priceNegotiationId\)\}"/);
  assert.match(userScript, /function handleNegotiationChatAction/);
  assert.match(index, /id="price-offer-conversation-id"/);
  assert.match(index, /id="price-offer-service-summary"/);
  assert.match(index, /id="price-offer-submit"/);
  assert.match(userScript, /conversationId: chat\.id/);
  assert.match(userScript, /let conversationId = activeConversationId/);
  assert.match(userScript, /error\.userMessage = error\.message\.trim\(\)\.slice\(0, 240\)/);
  assert.match(userStyle, /@media \(max-width: 680px\) \{\s+\.chat-negotiations \{ display: grid;/);
  assert.match(userStyle, /\.chat-proposal-card \{[^}]*line-height: 1\.3;/);
});

test("chat proposal sheet includes a message without changing legacy price-only behavior", () => {
  assert.match(userScript, /messageLabel\.hidden = action === "proposal" && service\?\.negotiationMode !== "hybrid" && !chatProposal/);
  assert.match(userScript, /action === "proposal" && service\?\.negotiationMode !== "hybrid" && !isChatProposal\s+\? "" : document\.querySelector\("#price-offer-message"\)\.value\.trim\(\)/);
  assert.match(userScript, /modal\.classList\.toggle\("chat-price-sheet", chatProposal\)/);
});

test("counteroffer action is available in both formal negotiation modes", () => {
  assert.match(userScript, /const availableActions = \[\["accept", "Accept"\], \["reject", "Reject"\]\]/);
  assert.match(userScript, /if \(\["negotiation", "hybrid"\]\.includes\(service\?\.negotiationMode\)\) availableActions\.push\(\["counter", "Counter"\]\)/);
});
