// Runs the actual SQL against isolated PostgreSQL in memory; no live database is used.
const { PGlite } = require("@electric-sql/pglite");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const db = new PGlite();
const users = {
  provider: "11111111-1111-4111-8111-111111111111",
  customer: "22222222-2222-4222-8222-222222222222",
  responder: "33333333-3333-4333-8333-333333333333",
  outsider: "44444444-4444-4444-8444-444444444444",
  admin: "55555555-5555-4555-8555-555555555555",
};
const sessions = Object.fromEntries(Object.entries(users).map(([key, id]) => [key, `a${id.slice(1)}`]));
async function asUser(name, verified = true) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', 'authenticated', false), set_config('request.jwt.claim.session_id', $2, false)", [users[name], verified ? sessions[name] : "99999999-9999-4999-8999-999999999999"]);
  await db.exec("set role authenticated");
}
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
async function rejects(sql, args, message) { await assert.rejects(db.query(sql, args), message); }
async function main() {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema realtime;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('session_id', current_setting('request.jwt.claim.session_id',true)) $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner uuid,metadata jsonb default '{}');
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
    create table realtime.messages(id uuid,topic text);
    create function realtime.topic() returns text language sql stable as $$ select coalesce(current_setting('request.realtime.topic',true),'') $$;
    grant usage on schema auth,storage,realtime,public to authenticated,anon,service_role;
    grant execute on all functions in schema auth to authenticated,anon,service_role;
  `);
  await db.exec(fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8").replace("create extension if not exists pgcrypto;", ""));
  for (const name of fs.readdirSync(path.join(root, "supabase/migrations")).filter(name => name >= "20261103100000" && name < "20261106100000").sort()) {
    await db.exec(fs.readFileSync(path.join(root, "supabase/migrations", name), "utf8"));
  }
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261106100000_marketplace_growth.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261107100000_marketplace_email_notifications.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261107110000_system_health_telemetry.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261107120000_client_completion_verification.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261108180000_admin_moderation.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261110120000_paystack_test_payments.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261111120000_cancel_unpaid_bookings.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261111130000_accept_booking_requests.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261111140000_finalize_verified_payments.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261111150000_require_client_completion_verification.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261111160000_provider_paystack_withdrawals.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261111170000_paystack_test_transfer_sandbox.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261111180000_provider_wallet_ledger.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261113100000_booking_cancellation_actor_notifications.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261114100000_customer_cancel_accepted_unpaid_bookings.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261114110000_notification_swipe_actions.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261115100000_booking_idempotency.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261121100000_new_order_price_negotiation.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261121120000_hot_path_scaling.sql"), "utf8"));
  console.log("PASS all database migrations compile against PostgreSQL");
  for (const [name, id] of Object.entries(users)) {
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)", [id, `${name}@example.test`, JSON.stringify({ full_name: name, university: name === "outsider" ? "Other University" : "University of Ghana" })]);
    await db.query("insert into public.verified_auth_sessions(session_id,user_id) values($1,$2)", [sessions[name], id]);
  }
  await db.query("update public.profiles set role='admin' where id=$1", [users.admin]);
  await asUser("provider");
  await db.exec("reset role"); // Seed the pre-existing listing; listing creation has its own RPC.
  const service = (await rows("insert into public.services(provider_id,title,category,description,price,currency,negotiation_mode) values($1,'Laptop care','Tech help','A full laptop cleaning and fan check.',50,'GHS','fixed') returning id", [users.provider]))[0].id;
  await asUser("provider");
  const day = (await rows("select (current_date+2)::text as day"))[0].day;
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const hours = JSON.stringify([{ day: weekday, start: "09:00", end: "12:00" }]);
  await db.query("select public.save_provider_availability('Africa/Accra',60,$1::jsonb,'{}',true)", [hours]);
  await rejects("select public.save_provider_availability('Wrong/Zone',60,$1::jsonb,'{}',true)", [hours], /valid time zone/);
  await rejects("select public.save_provider_availability('Africa/Accra',60,$1::jsonb,'{}',true)", [JSON.stringify([{ day: weekday, start: "11:00", end: "09:00" }])], /full appointment/);
  await asUser("customer", false);
  await rejects("select * from public.available_provider_slots($1,$2::date)", [users.provider, day], /Sign in/);
  await asUser("customer");
  assert.equal((await rows("select * from public.available_provider_slots($1,$2::date)", [users.provider, day])).length, 3);
  const makeBooking = async (hour) => (await rows("insert into public.bookings(service_id,customer_id,provider_id,scheduled_at,agreed_price,listed_price,currency) values($1,auth.uid(),$2,$3,50,50,'GHS') returning id", [service, users.provider, `${day}T${hour}:00Z`]))[0].id;
  await rejects("insert into public.bookings(service_id,customer_id,provider_id,scheduled_at,agreed_price,listed_price) values($1,auth.uid(),$2,$3,50,50)", [service, users.provider, `${day}T08:00:00Z`], /unavailable/);
  const first = await makeBooking("09:00");
  assert.equal((await rows("select count(*)::int as count from public.booking_directory where id=$1", [first]))[0].count, 1, "the customer sees the new request in Sent bookings");
  await rejects(
    "insert into public.bookings(service_id,customer_id,provider_id,scheduled_at,agreed_price,listed_price,currency) values($1,auth.uid(),$2,$3,50,50,'GHS')",
    [service, users.provider, `${day}T09:00:00Z`],
    /bookings_active_exact_request_unique_idx/,
  );
  await rejects("select public.accept_booking_request($1)", [first], /Only the assigned provider/);
  await asUser("responder");
  assert.equal((await rows("select * from public.booking_directory where id=$1", [first])).length, 0, "an unrelated user cannot view either participant's booking");
  assert.equal((await rows("select * from public.bookings where id=$1", [first])).length, 0, "row-level security hides another user's raw booking");
  await rejects("update public.bookings set note='unauthorized edit' where id=$1", [first], /permission denied/);
  await rejects("select public.update_booking_status($1,'cancelled')", [first], /cannot make that booking status change/i);
  await rejects("select public.cancel_unpaid_booking_by_customer($1)", [first], /Booking not found/);
  await asUser("provider");
  assert.equal((await rows("select count(*)::int as count from public.booking_directory where id=$1", [first]))[0].count, 1, "the provider sees the same request in Received bookings");
  assert.ok((await rows(
    "select 1 from public.notifications where user_id=auth.uid() and booking_id=$1 and title='New booking request'",
    [first],
  )).length, "the provider receives a notification linked to the new booking");
  await db.query("select public.accept_booking_request($1)", [first]);
  await db.query("select public.accept_booking_request($1)", [first]);
  await asUser("customer");
  const acceptedBooking = (await rows(
    "select status, payment_status, provider_accepted_at, agreed_price, listed_price from public.booking_directory where id=$1",
    [first],
  ))[0];
  assert.equal(acceptedBooking.status, "pending");
  assert.equal(acceptedBooking.payment_status, "awaiting_payment");
  assert.ok(acceptedBooking.provider_accepted_at);
  assert.equal(Number(acceptedBooking.agreed_price), 50);
  assert.equal(Number(acceptedBooking.listed_price), 50, "fixed-price bookings show the listed price as the agreed price");
  assert.ok((await rows(
    "select 1 from public.notifications where user_id=auth.uid() and booking_id=$1 and title='Your booking was accepted' and body like '%confirmed%payment is still required%'",
    [first],
  )).length, "the customer is notified that acceptance is confirmed but payment is still required");
  await asUser("provider");
  const providerAcceptedBooking = (await rows(
    "select status, payment_status, provider_accepted_at, agreed_price, listed_price from public.booking_directory where id=$1",
    [first],
  ))[0];
  assert.deepEqual(providerAcceptedBooking, acceptedBooking, "the provider reads the same accepted/unpaid booking state");
  assert.equal((await rows("select * from public.available_provider_slots($1,$2::date)", [users.provider, day])).length, 2);
  await asUser("provider");
  await rejects("select public.start_booking_work($1)", [first], /Only the provider/);
  await asUser("customer");
  const rejected = await makeBooking("11:00");
  await asUser("provider");
  await db.query("select public.update_booking_status($1,'declined')", [rejected]);
  assert.equal((await rows("select status from public.booking_directory where id=$1", [rejected]))[0].status, "declined");
  await asUser("customer");
  assert.equal((await rows("select status from public.booking_directory where id=$1", [rejected]))[0].status, "declined", "both participants see a rejected request");
  assert.ok((await rows(
    "select 1 from public.notifications where user_id=auth.uid() and booking_id=$1 and body like '%declined%'",
    [rejected],
  )).length, "the customer is notified when the provider rejects the request");
  const pendingCancelled = await makeBooking("11:00");
  await db.query("select public.update_booking_status($1,'cancelled')", [pendingCancelled]);
  assert.equal((await rows("select status from public.booking_directory where id=$1", [pendingCancelled]))[0].status, "cancelled");
  assert.ok((await rows(
    "select 1 from public.notifications where user_id=auth.uid() and booking_id=$1 and body like '%cancelled by you%'",
    [pendingCancelled],
  )).length, "the customer receives confirmation for cancelling a pending request");
  await asUser("provider");
  assert.equal((await rows("select status from public.booking_directory where id=$1", [pendingCancelled]))[0].status, "cancelled", "the provider sees the customer's pending cancellation");
  assert.ok((await rows(
    "select 1 from public.notifications where user_id=auth.uid() and booking_id=$1 and body like '%cancelled%'",
    [pendingCancelled],
  )).length, "the provider is notified when the customer cancels");

  await db.exec("reset role");
  const negotiatedConversation = (await rows("insert into public.conversations default values returning id"))[0].id;
  const negotiatedService = (await rows(
    "insert into public.services(provider_id,title,category,description,price,currency,negotiation_mode) values($1,'Negotiated laptop care','Tech help','A custom laptop service with an agreed scope.',50,'GHS','negotiation') returning id",
    [users.provider],
  ))[0].id;
  const secondNegotiatedService = (await rows(
    "insert into public.services(provider_id,title,category,description,price,currency,negotiation_mode) values($1,'Phone diagnostics','Repairs','A separate service with a separate price.',75,'GHS','negotiation') returning id",
    [users.provider],
  ))[0].id;
  await db.query(
    "insert into public.conversation_members(conversation_id,user_id) values($1,$2),($1,$3)",
    [negotiatedConversation, users.customer, users.provider],
  );
  await asUser("customer");
  assert.equal((await rows(
    "select public.start_conversation($1,null) as id",
    [users.provider],
  ))[0].id, negotiatedConversation, "the existing provider chat is reused");
  assert.equal((await rows(
    "select public.start_conversation($1,null) as id",
    [users.provider],
  ))[0].id, negotiatedConversation, "opening another service negotiation keeps the same chat");
  const negotiationId = (await rows(
    "select public.create_price_negotiation($1,$2,42,'Two-hour agreed session') as id",
    [negotiatedService, negotiatedConversation],
  ))[0].id;
  const acceptedOfferId = (await rows(
    "select id from public.price_offers where negotiation_id=$1 and status='pending'",
    [negotiationId],
  ))[0].id;
  const secondNegotiationId = (await rows(
    "select public.create_price_negotiation($1,$2,null,'') as id",
    [secondNegotiatedService, negotiatedConversation],
  ))[0].id;
  assert.notEqual(secondNegotiationId, negotiationId, "another service gets a separate negotiation");
  assert.equal((await rows(
    "select public.create_price_negotiation($1,$2,null,'') as id",
    [secondNegotiatedService, negotiatedConversation],
  ))[0].id, secondNegotiationId, "repeated opens reuse the active negotiation");
  await db.query(
    "select public.create_price_negotiation($1,$2,68,'Phone screen and charging-port diagnostics')",
    [secondNegotiatedService, negotiatedConversation],
  );
  const secondOfferId = (await rows(
    "select id from public.price_offers where negotiation_id=$1 and status='pending'",
    [secondNegotiationId],
  ))[0].id;
  await rejects(
    "select public.create_price_negotiation($1,$2,67,'Duplicate pending offer')",
    [secondNegotiatedService, negotiatedConversation],
    /offer is already waiting/,
  );
  await asUser("provider");
  await db.query("select public.decide_price_offer($1,'accept',null,'')", [acceptedOfferId]);
  const acceptedTerms = (await rows(
    "select n.service_id, n.provider_id, n.customer_id, n.state, n.agreed_price, a.service_id as agreement_service_id from public.price_negotiations n join public.price_agreements a on a.negotiation_id=n.id where n.id=$1",
    [negotiationId],
  ))[0];
  assert.equal(acceptedTerms.service_id, negotiatedService);
  assert.equal(acceptedTerms.agreement_service_id, negotiatedService);
  assert.equal(acceptedTerms.provider_id, users.provider);
  assert.equal(acceptedTerms.customer_id, users.customer);
  assert.equal(acceptedTerms.state, "agreed");
  assert.equal(Number(acceptedTerms.agreed_price), 42);
  assert.equal((await rows(
    "select status from public.price_offers where id=$1",
    [secondOfferId],
  ))[0].status, "pending", "accepting one service offer leaves another pending");
  await asUser("customer");
  const negotiated = (await rows(
    "select (public.create_booking_from_price_agreement($1,$2::timestamptz,'','Online')).id as id",
    [negotiationId, `${day}T11:00:00Z`],
  ))[0].id;
  const negotiatedTerms = (await rows(
    "select service_id, provider_id, customer_id, agreed_price, listed_price, price_agreement_id, status from public.booking_directory where id=$1",
    [negotiated],
  ))[0];
  assert.equal(negotiatedTerms.service_id, negotiatedService);
  assert.equal(negotiatedTerms.provider_id, users.provider);
  assert.equal(negotiatedTerms.customer_id, users.customer);
  assert.equal(Number(negotiatedTerms.agreed_price), 42);
  assert.equal(Number(negotiatedTerms.listed_price), 50);
  assert.ok(negotiatedTerms.price_agreement_id);
  assert.equal(negotiatedTerms.status, "pending", "negotiated requests preserve the agreed and listed price separately");
  const repeatedNegotiatedRequest = (await rows(
    "select (public.create_booking_from_price_agreement($1,$2::timestamptz,'','Online')).id as id",
    [negotiationId, `${day}T10:00:00Z`],
  ))[0].id;
  assert.equal(repeatedNegotiatedRequest, negotiated, "repeated agreement booking requests reuse the existing booking");
  assert.equal((await rows(
    "select scheduled_at from public.booking_directory where id=$1",
    [negotiated],
  ))[0].scheduled_at.toISOString(), `${day}T11:00:00.000Z`, "a repeat cannot overwrite the original appointment");
  await db.query("select public.update_booking_status($1,'cancelled')", [negotiated]);
  await asUser("provider");
  assert.equal((await rows("select status from public.booking_directory where id=$1", [negotiated]))[0].status, "cancelled");
  await asUser("customer");
  const nextNegotiation = (await rows(
    "select public.create_price_negotiation($1,$2,null,'') as id",
    [negotiatedService, negotiatedConversation],
  ))[0].id;
  assert.notEqual(nextNegotiation, negotiationId, "a cancelled order can start a fresh price round");
  assert.equal((await rows(
    "select public.create_price_negotiation($1,$2,null,'') as id",
    [negotiatedService, negotiatedConversation],
  ))[0].id, nextNegotiation, "reopening the discussion reuses the active round instead of creating duplicates");
  assert.equal((await rows(
    "select count(*)::int as count from public.price_negotiations where service_id=$1 and customer_id=$2",
    [negotiatedService, users.customer],
  ))[0].count, 2, "one history row is retained for each actual price round");
  assert.equal((await rows(
    "select state from public.price_negotiations where id=$1",
    [negotiationId],
  ))[0].state, "agreed", "the previous agreement remains unchanged for its cancelled booking");
  await db.query(
    "select public.create_price_negotiation($1,$2,39,'Fresh price for a new order')",
    [negotiatedService, negotiatedConversation],
  );
  assert.equal(Number((await rows(
    "select amount from public.price_offers where negotiation_id=$1",
    [nextNegotiation],
  ))[0].amount), 39, "the new order price offer attaches to its own negotiation");
  assert.equal((await rows(
    "select status from public.price_offers where negotiation_id=$1",
    [secondNegotiationId],
  ))[0].status, "pending", "a new round for one service does not affect another service's pending offer");
  assert.equal((await rows(
    "select count(*)::int as count from public.price_offers where status='pending' and negotiation_id in ($1,$2)",
    [nextNegotiation, secondNegotiationId],
  ))[0].count, 2, "different services can have independent pending offers");
  await asUser("provider");

  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
  await db.exec("set role service_role");
  const firstPayment = (await rows(
    "select * from public.create_paystack_payment_attempt($1,$2,$3,500)",
    [first, users.customer, "SKM_11111111-1111-4111-8111-111111111112"],
  ))[0];
  assert.equal(Number(firstPayment.service_amount_minor), 5000);
  assert.equal(Number(firstPayment.booking_fee_minor), 250);
  assert.equal(Number(firstPayment.total_amount_minor), 5250);
  assert.equal((await rows(
    "select public.apply_paystack_payment_event($1,'success',9001,5250,'GHS',null,'verification') as status",
    [firstPayment.reference],
  ))[0].status, "processing");
  await asUser("provider");
  await rejects("select public.finalize_verified_paystack_payment($1)", [firstPayment.reference], /permission denied/);
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
  await db.exec("set role service_role");
  assert.equal((await rows(
    "select public.finalize_verified_paystack_payment($1) as status",
    [firstPayment.reference],
  ))[0].status, "paid", "a server-verified Paystack success confirms the booking without waiting indefinitely for a webhook");
  await asUser("customer");
  const pendingPaymentBooking = (await rows(
    "select status, payment_status from public.booking_directory where id=$1",
    [first],
  ))[0];
  assert.equal(pendingPaymentBooking.status, "confirmed");
  assert.equal(pendingPaymentBooking.payment_status, "paid");
  await rejects("select public.cancel_unpaid_booking_by_customer($1)", [first], /provider-accepted unpaid booking/);
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
  await db.exec("set role service_role");
  const firstWebhook = "charge.success:9001";
  assert.equal((await rows(
    "select public.apply_paystack_payment_event($1,'success',9001,5250,'GHS',$2,'webhook') as status",
    [firstPayment.reference, firstWebhook],
  ))[0].status, "paid");
  assert.equal((await rows(
    "select public.apply_paystack_payment_event($1,'success',9001,5250,'GHS',$2,'webhook') as status",
    [firstPayment.reference, firstWebhook],
  ))[0].status, "paid");
  const payoutRecipient = (await rows(
    "insert into public.provider_payout_recipients(provider_id,recipient_code,recipient_type,name,bank_code,bank_name,account_last_four) values($1,'RCP_test','nuban','Provider','TEST','Test bank','1234') returning id",
    [users.provider],
  ))[0].id;
  const pendingWallet = (await rows(
    "select available_minor, pending_minor from public.get_provider_payout_balance($1)",
    [users.provider],
  ))[0];
  assert.equal(pendingWallet.available_minor, 0);
  assert.equal(pendingWallet.pending_minor, 5000);
  await rejects(
    "select * from public.request_provider_withdrawal($1,$2,1000,$3,'SKM_WD_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false)",
    [users.provider, payoutRecipient, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab"],
    /exceeds your available earnings/,
  );
  await asUser("provider");
  const paidBooking = (await rows(
    "select status, payment_status, provider_earnings_status, latest_payment_reference from public.booking_directory where id=$1",
    [first],
  ))[0];
  assert.equal(paidBooking.status, "confirmed");
  assert.equal(paidBooking.payment_status, "paid");
  assert.equal(paidBooking.provider_earnings_status, "pending");
  assert.equal(paidBooking.latest_payment_reference, firstPayment.reference);
  await db.query("select public.start_booking_work($1)", [first]);
  const providerInProgress = (await rows(
    "select status, work_started_at from public.booking_directory where id=$1",
    [first],
  ))[0];
  assert.equal(providerInProgress.status, "confirmed");
  assert.ok(providerInProgress.work_started_at);
  await asUser("customer");
  const customerInProgress = (await rows(
    "select status, work_started_at from public.booking_directory where id=$1",
    [first],
  ))[0];
  assert.deepEqual(customerInProgress, providerInProgress, "both accounts see the started booking");
  assert.ok((await rows(
    "select 1 from public.notifications where user_id=auth.uid() and booking_id=$1 and title='Your provider has started work'",
    [first],
  )).length, "the customer is notified when work starts");
  await rejects("select public.update_booking_status($1,'completed')", [first], /Only the customer can verify completion/);
  await asUser("provider");
  await db.query("select public.update_booking_status($1,'completed')", [first]);
  const pendingVerification = (await rows("select status, provider_completed_at from public.booking_directory where id=$1", [first]))[0];
  assert.equal(pendingVerification.status, "confirmed");
  assert.ok(pendingVerification.provider_completed_at);
  await asUser("customer");
  const customerPendingVerification = (await rows(
    "select status, provider_completed_at from public.booking_directory where id=$1",
    [first],
  ))[0];
  assert.deepEqual(customerPendingVerification, pendingVerification, "both accounts see that completion awaits customer verification");
  assert.ok((await rows(
    "select 1 from public.notifications where user_id=auth.uid() and booking_id=$1 and title='Completion needs your verification'",
    [first],
  )).length, "the customer receives a verification notification");
  await asUser("admin");
  await rejects("select public.update_booking_status($1,'completed')", [first], /Only the customer can verify completion/);
  await asUser("customer");
  assert.equal((await rows(
    "select status from public.booking_directory where id=$1",
    [first],
  ))[0].status, "confirmed", "an administrator cannot bypass customer completion verification");
  await db.query("select public.update_booking_status($1,'completed')", [first]);
  const verifiedCompletion = (await rows(
    "select status, customer_completed_at, provider_earnings_status from public.booking_directory where id=$1",
    [first],
  ))[0];
  assert.equal(verifiedCompletion.status, "completed");
  assert.ok(verifiedCompletion.customer_completed_at);
  assert.equal(verifiedCompletion.provider_earnings_status, "eligible_for_payout");
  await db.query(
    "insert into public.reviews(booking_id,reviewer_id,provider_id,rating,body) values($1,auth.uid(),$2,5,'Reliable and helpful service.')",
    [first, users.provider],
  );
  const savedReview = (await rows(
    "select booking_id, reviewer_id, provider_id, rating, body from public.reviews where booking_id=$1",
    [first],
  ))[0];
  assert.equal(savedReview.booking_id, first);
  assert.equal(savedReview.reviewer_id, users.customer);
  assert.equal(savedReview.provider_id, users.provider, "the review is linked to the booking's provider");
  assert.equal(savedReview.rating, 5);
  await rejects(
    "insert into public.reviews(booking_id,reviewer_id,provider_id,rating,body) values($1,auth.uid(),$2,4,'Duplicate review.')",
    [first, users.provider],
    /duplicate key/,
  );
  await asUser("provider");
  assert.equal((await rows(
    "select booking_id from public.reviews where booking_id=$1 and provider_id=auth.uid()",
    [first],
  )).length, 1, "the provider sees the review attached to the completed booking");
  const providerCompleted = (await rows(
    "select status, customer_completed_at from public.booking_directory where id=$1",
    [first],
  ))[0];
  assert.equal(providerCompleted.status, "completed", "the provider sees the same final status after customer verification");
  assert.ok(providerCompleted.customer_completed_at);
  assert.ok((await rows(
    "select 1 from public.notifications where user_id=auth.uid() and booking_id=$1 and body like '%verified as complete%'",
    [first],
  )).length, "the provider is notified after the customer verifies completion");
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
  await db.exec("set role service_role");
  const eligibleWallet = (await rows(
    "select available_minor, earned_minor, pending_minor from public.get_provider_payout_balance($1)",
    [users.provider],
  ))[0];
  assert.equal(eligibleWallet.available_minor, 5000);
  assert.equal(eligibleWallet.earned_minor, 5000);
  assert.equal(eligibleWallet.pending_minor, 0);
  const withdrawal = (await rows(
    "select * from public.request_provider_withdrawal($1,$2,2000,$3,'SKM_WD_66666666-6666-4666-8666-666666666666',false)",
    [users.provider, payoutRecipient, "77777777-7777-4777-8777-777777777777"],
  ))[0];
  assert.equal(withdrawal.status, "pending");
  assert.equal((await rows(
    "select public.claim_provider_withdrawal_submission($1,$2) as claimed",
    [users.provider, withdrawal.reference],
  ))[0].claimed, true);
  assert.equal((await rows(
    "select public.claim_provider_withdrawal_submission($1,$2) as claimed",
    [users.provider, withdrawal.reference],
  ))[0].claimed, false, "the same reserved transfer cannot be submitted twice");
  assert.equal((await rows(
    "select status from public.provider_withdrawals where id=$1",
    [withdrawal.id],
  ))[0].status, "processing");
  assert.equal((await rows(
    "select available_minor from public.get_provider_payout_balance($1)",
    [users.provider],
  ))[0].available_minor, 3000, "processing transfers reserve funds against duplicate withdrawals");
  assert.equal((await rows(
    "select reference from public.request_provider_withdrawal($1,$2,2000,$3,'SKM_WD_88888888-8888-4888-8888-888888888888',false)",
    [users.provider, payoutRecipient, "77777777-7777-4777-8777-777777777777"],
  ))[0].reference, withdrawal.reference, "repeated idempotency keys do not create another withdrawal");
  assert.equal((await rows(
    "select count(*)::integer as count from public.provider_wallet_ledger where withdrawal_id=$1 and entry_type='withdrawal_reserved'",
    [withdrawal.id],
  ))[0].count, 1, "idempotent retries create only one ledger reservation");
  await rejects(
    "select * from public.request_provider_withdrawal($1,$2,4000,$3,'SKM_WD_99999999-9999-4999-8999-999999999999')",
    [users.provider, payoutRecipient, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    /exceeds your available earnings/,
  );
  const parallelWithdrawals = await Promise.allSettled([
    rows("select reference from public.request_provider_withdrawal($1,$2,2000,$3,'SKM_WD_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac',false)",
      [users.provider, payoutRecipient, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad"]),
    rows("select reference from public.request_provider_withdrawal($1,$2,2000,$3,'SKM_WD_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaae',false)",
      [users.provider, payoutRecipient, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaf"]),
  ]);
  assert.equal(parallelWithdrawals.filter(result => result.status === "fulfilled").length, 1,
    "simultaneous reservations cannot spend more than the remaining balance");
  await db.query(
    "select public.record_provider_withdrawal_result($1,'successful',2000,'GHS','TRF_test',null,'paystack')",
    [withdrawal.reference],
  );
  assert.equal((await rows(
    "select available_minor, reserved_minor, withdrawn_minor from public.get_provider_payout_balance($1)",
    [users.provider],
  ))[0].available_minor, 1000, "completed and concurrent withdrawals remain deducted from the available balance");
  assert.equal((await rows(
    "select reserved_minor, withdrawn_minor from public.get_provider_payout_balance($1)",
    [users.provider],
  ))[0].reserved_minor, 2000);
  assert.equal((await rows(
    "select withdrawn_minor from public.get_provider_payout_balance($1)",
    [users.provider],
  ))[0].withdrawn_minor, 2000);
  await db.query(
    "select public.record_provider_withdrawal_result($1,'reversed',2000,'GHS','TRF_test','Transfer reversed by Paystack','webhook')",
    [withdrawal.reference],
  );
  await db.query(
    "select public.record_provider_withdrawal_result($1,'reversed',2000,'GHS','TRF_test','Duplicate reversal event','webhook')",
    [withdrawal.reference],
  );
  assert.equal((await rows(
    "select available_minor from public.get_provider_payout_balance($1)",
    [users.provider],
  ))[0].available_minor, 3000, "reversed transfers restore the provider's available earnings exactly once");
  assert.equal((await rows(
    "select count(*)::integer as count from public.provider_wallet_ledger where withdrawal_id=$1 and entry_type='withdrawal_reversal'",
    [withdrawal.id],
  ))[0].count, 1);
  const failedWithdrawal = (await rows(
    "select * from public.request_provider_withdrawal($1,$2,1000,$3,'SKM_WD_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad',false)",
    [users.provider, payoutRecipient, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  ))[0];
  await rows("select public.claim_provider_withdrawal_submission($1,$2)",
    [users.provider, failedWithdrawal.reference]);
  await db.query(
    "select public.record_provider_withdrawal_result($1,'failed',1000,'GHS',null,'Rejected by Paystack','paystack')",
    [failedWithdrawal.reference],
  );
  await db.query(
    "select public.record_provider_withdrawal_result($1,'failed',1000,'GHS',null,'Duplicate failure event','webhook')",
    [failedWithdrawal.reference],
  );
  assert.equal((await rows(
    "select available_minor from public.get_provider_payout_balance($1)",
    [users.provider],
  ))[0].available_minor, 3000, "a failed transfer restores its reservation exactly once");
  assert.equal((await rows(
    "select count(*)::integer as count from public.provider_wallet_ledger where withdrawal_id=$1 and entry_type='withdrawal_release'",
    [failedWithdrawal.id],
  ))[0].count, 1);
  await asUser("provider");
  assert.equal((await rows(
    "select count(*)::integer as count from public.notifications where user_id=$1 and kind='payout_update' and title='Withdrawal failed'",
    [users.provider],
  ))[0].count, 1);
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
  await db.exec("set role service_role");
  await rows(
    "select * from public.record_provider_wallet_adjustment($1,100,'SKM_ADJ_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab','test adjustment')",
    [users.provider],
  );
  await rows(
    "select * from public.record_provider_wallet_adjustment($1,100,'SKM_ADJ_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab','test adjustment')",
    [users.provider],
  );
  assert.equal((await rows(
    "select count(*)::integer as count from public.provider_wallet_ledger where reference='SKM_ADJ_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab'",
  ))[0].count, 1, "balance adjustments are idempotent and auditable");
  await rows(
    "select * from public.record_provider_wallet_adjustment($1,-100,'SKM_ADJ_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac','correction test')",
    [users.provider],
  );
  const sandboxRecipient = (await rows(
    "insert into public.provider_payout_recipients(provider_id,recipient_code,recipient_type,name,bank_code,bank_name,account_last_four,payout_mode) values($1,'RCP_test_sandbox','mobile_money','Provider','TEST','Test mobile money','5678','test') returning id",
    [users.provider],
  ))[0].id;
  const sandboxWithdrawal = (await rows(
    "select * from public.request_provider_withdrawal($1,$2,2000,$3,'SKM_WD_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true)",
    [users.provider, sandboxRecipient, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
  ))[0];
  assert.equal(sandboxWithdrawal.test_mode, true);
  assert.equal((await rows(
    "select available_minor from public.get_provider_payout_balance($1)",
    [users.provider],
  ))[0].available_minor, 3000, "sandbox withdrawals never reduce the real available balance");
  await asUser("provider");
  await rejects("select * from public.provider_wallet_ledger", [], /permission denied/);
  await rejects("select public.record_provider_wallet_adjustment($1,100,'SKM_ADJ_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','test adjustment')",
    [users.provider], /permission denied/);
  await rejects("select public.start_booking_work($1)", [first], /Only the provider can start/);
  await rejects("select public.propose_booking_appointment($1,now()+interval '1 day')", [first], /active booking/);
  await asUser("customer");
  const completionNotification = (await rows(
    "select title, body from public.notifications where user_id=$1 and booking_id=$2 and title='Completion needs your verification' order by created_at desc limit 1",
    [users.customer, first],
  ))[0];
  assert.equal(completionNotification.title, "Completion needs your verification");
  assert.match(completionNotification.body, /marked complete.*verify the work/i);
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
  await db.exec("set role service_role");
  assert.equal((await rows(
    "select public.apply_paystack_payment_event($1,'refunded',9001,1250,'GHS','refund:1','webhook') as status",
    [firstPayment.reference],
  ))[0].status, "partially_refunded");
  assert.equal((await rows(
    "select public.apply_paystack_payment_event($1,'refunded',9001,1250,'GHS','refund:1','webhook') as status",
    [firstPayment.reference],
  ))[0].status, "partially_refunded");
  assert.equal((await rows(
    "select refunded_amount_minor, provider_earnings_status from public.paystack_payment_attempts where reference=$1",
    [firstPayment.reference],
  ))[0].refunded_amount_minor, 1250);
  assert.equal((await rows(
    "select public.apply_paystack_payment_event($1,'refunded',9001,4000,'GHS','refund:2','webhook') as status",
    [firstPayment.reference],
  ))[0].status, "refunded");
  await asUser("customer");
  const second = await makeBooking("10:00");
  assert.ok(second, "An outstanding review never blocks a new booking at the database");
  const unchangedFirst = (await rows(
    "select status, agreed_price, customer_completed_at from public.booking_directory where id=$1",
    [first],
  ))[0];
  assert.equal(unchangedFirst.status, "completed", "rebooking does not change the previous booking");
  assert.ok(unchangedFirst.customer_completed_at);
  assert.equal((await rows("select count(*)::int as count from public.reviews where booking_id=$1", [first]))[0].count, 1);
  await asUser("responder");
  const overlap = await makeBooking("10:00");
  await asUser("provider");
  await db.query("select public.accept_booking_request($1)", [second]);
  await rejects("select public.accept_booking_request($1)", [overlap], /already reserved/);
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
  await db.exec("set role service_role");
  const failedPayment = (await rows(
    "select * from public.create_paystack_payment_attempt($1,$2,$3,500)",
    [second, users.customer, "SKM_22222222-2222-4222-8222-222222222223"],
  ))[0];
  assert.equal((await rows(
    "select public.apply_paystack_payment_event($1,'failed',9002,5250,'GHS',null,'verification') as status",
    [failedPayment.reference],
  ))[0].status, "failed");
  const retryPayment = (await rows(
    "select * from public.create_paystack_payment_attempt($1,$2,$3,500)",
    [second, users.customer, "SKM_22222222-2222-4222-8222-222222222224"],
  ))[0];
  assert.equal(retryPayment.status, "pending");
  await asUser("provider");
  await rejects("select public.cancel_unpaid_booking($1)", [second], /payment attempt is still pending/);
  await asUser("customer");
  await rejects("select public.cancel_unpaid_booking_by_customer($1)", [second], /payment attempt is still pending/);
  const unpaid = await makeBooking("11:00");
  await asUser("provider");
  await db.query("select public.accept_booking_request($1)", [unpaid]);
  await db.query("select public.cancel_unpaid_booking($1)", [unpaid]);
  assert.equal((await rows(
    "select status from public.booking_directory where id=$1",
    [unpaid],
  ))[0].status, "cancelled", "the customer can see that the accepted booking was cancelled");
  assert.ok((await rows(
    "select 1 from public.notifications where user_id=$1 and booking_id=$2 and body like '%cancelled by you%'",
    [users.provider, unpaid],
  )).length, "the person who cancelled receives their own confirmation notification");
  await asUser("customer");
  assert.ok((await rows(
    "select 1 from public.notifications where user_id=$1 and booking_id=$2 and body like '%cancelled%'",
    [users.customer, unpaid],
  )).length, "the customer receives a booking-cancelled notification");
  assert.equal((await rows(
    "select exists(select 1 from public.available_provider_slots($1,$2::date) where starts_at=$3) as available",
    [users.provider, day, `${day}T11:00:00Z`],
  ))[0].available, true, "cancelling the unpaid booking releases its appointment");
  await rejects("select public.cancel_unpaid_booking($1)", [unpaid], /Only an unpaid booking/);

  const customerCancelled = await makeBooking("11:00");
  await asUser("provider");
  await db.query("select public.accept_booking_request($1)", [customerCancelled]);
  await asUser("customer");
  await db.query("select public.cancel_unpaid_booking_by_customer($1)", [customerCancelled]);
  assert.equal((await rows(
    "select status from public.booking_directory where id=$1",
    [customerCancelled],
  ))[0].status, "cancelled");
  assert.ok((await rows(
    "select 1 from public.notifications where user_id=$1 and booking_id=$2 and body like '%cancelled by you%'",
    [users.customer, customerCancelled],
  )).length, "the customer who cancelled is notified");
  await asUser("provider");
  assert.equal((await rows(
    "select status from public.booking_directory where id=$1",
    [customerCancelled],
  ))[0].status, "cancelled", "the provider can see the customer's cancelled booking");
  assert.ok((await rows(
    "select 1 from public.notifications where user_id=$1 and booking_id=$2 and body like '%cancelled%'",
    [users.provider, customerCancelled],
  )).length, "the provider receives a cancellation notification");
  await asUser("customer");
  await rejects("select public.cancel_unpaid_booking_by_customer($1)", [customerCancelled], /provider-accepted unpaid booking/);
  const ownedNotification = (await rows(
    "select id, user_id from public.notifications where booking_id=$1 and user_id in ($2,$3) limit 1",
    [customerCancelled, users.customer, users.provider],
  ))[0];
  const notificationOwnerName = ownedNotification.user_id === users.customer ? "customer" : "provider";
  const otherParticipantName = notificationOwnerName === "customer" ? "provider" : "customer";
  await asUser(otherParticipantName);
  await db.query("delete from public.notifications where id=$1", [ownedNotification.id]);
  await asUser(notificationOwnerName);
  assert.equal((await rows("select count(*)::int as count from public.notifications where id=$1", [ownedNotification.id]))[0].count, 1, "other participants cannot delete this user's notification");
  await db.query("delete from public.notifications where id=$1", [ownedNotification.id]);
  assert.equal((await rows(
    "select count(*)::int as count from public.notifications where id=$1",
    [ownedNotification.id],
  ))[0].count, 0, "a user can delete their own notification");
  await asUser("outsider");
  await db.query("delete from public.notifications where booking_id=$1", [customerCancelled]);
  await asUser(otherParticipantName);
  assert.equal((await rows(
    "select count(*)::int as count from public.notifications where booking_id=$1",
    [customerCancelled],
  ))[0].count > 0, true, "users cannot delete another person's notification");
  await asUser("customer");
  console.log("PASS availability, invalid hours, OTP, conflict exclusion, work permissions and optional reviews");

  const request = (await rows("select (public.post_campus_request('Poster for club','Design','We need an event poster and two revisions.',80,'online',current_date+4)).id as id"))[0].id;
  await rejects("select public.post_campus_request('Another poster','Design','We need an event poster and two revisions.',80,'online',current_date-1)", [], /deadline/);
  await asUser("outsider");
  assert.equal((await rows("select * from public.campus_request_directory where id=$1", [request])).length, 0);
  await rejects("select public.respond_campus_request($1,'I can help with this poster',75)", [request], /no longer available/);
  await asUser("responder");
  await db.query("select public.respond_campus_request($1,'I can help with a poster and two revisions.',75)", [request]);
  await rejects("select public.respond_campus_request($1,'Another duplicate offer here',70)", [request], /unique/);
  await rejects("select public.close_campus_request($1,false)", [request], /cannot change/);
  await db.query("select public.report_campus_request($1,'Please check the request details for spam.')", [request]);
  await asUser("provider");
  assert.equal((await rows("select * from public.campus_request_response_directory where request_id=$1", [request])).length, 0, "Other students cannot read private offers");
  await asUser("customer");
  assert.equal((await rows("select * from public.campus_request_response_directory where request_id=$1", [request])).length, 1);
  const conversation = (await rows("select public.start_request_conversation($1,$2) as id", [request, users.responder]))[0].id;
  assert.ok(conversation);
  await asUser("admin");
  await db.query("select public.close_campus_request($1,true)", [request]);
  await asUser("responder");
  assert.equal((await rows("select * from public.campus_request_directory where id=$1", [request])).length, 0);
  console.log("PASS campus scoping, response privacy, duplicate prevention, reporting, chat and admin moderation");
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
  // Move one pending request into the reminder window without changing its appointment.
  await db.query("update public.bookings set created_at=now()-interval '13 hours' where id=$1", [overlap]);
  assert.equal((await rows("select public.generate_booking_reminders() as count"))[0].count, 1);
  assert.equal((await rows("select public.generate_booking_reminders() as count"))[0].count, 0);
  console.log("PASS scheduled reminders are idempotent");

  assert.equal((await rows(
    "select count(*)::integer as count from public.marketplace_email_outbox where booking_id=$1 and event_type='booking_request'",
    [overlap],
  ))[0].count, 2, "booking request emails are queued for both participants");
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
  const messageConversation = (await rows("insert into public.conversations default values returning id"))[0].id;
  await db.query("insert into public.conversation_members(conversation_id,user_id) values($1,$2),($1,$3)", [messageConversation, users.customer, users.provider]);
  await asUser("customer");
  const canAccessTopic = async (prefix = "skillflex-chat") => {
    await db.query("select set_config('request.realtime.topic',$1,false)", [`${prefix}:${messageConversation}`]);
    return (await rows("select public.can_access_chat_realtime_topic() as allowed"))[0].allowed;
  };
  assert.equal(await canAccessTopic(), true, "verified members may join the renamed private topic");
  assert.equal(await canAccessTopic("skillmate-chat"), false, "legacy clients require coordinated rollout or rollback");
  await asUser("outsider");
  assert.equal(await canAccessTopic(), false, "a verified non-member cannot join");
  await asUser("customer", false);
  assert.equal(await canAccessTopic(), false, "membership does not bypass session verification");
  await asUser("customer");
  await db.query("insert into public.user_blocks(blocker_id,blocked_id) values(auth.uid(),$1)", [users.provider]);
  assert.equal(await canAccessTopic(), false, "blocking a participant revokes topic access");
  await asUser("provider");
  assert.equal(await canAccessTopic(), false, "the blocked participant also loses topic access");
  await asUser("customer");
  await db.query("delete from public.user_blocks where blocker_id=auth.uid() and blocked_id=$1", [users.provider]);
  assert.equal(await canAccessTopic(), true, "unblocking restores verified member access");
  const messageId = (await rows(
    "insert into public.messages(conversation_id,sender_id,body) values($1,auth.uid(),'Hello from a database test') returning id",
    [messageConversation],
  ))[0].id;
  await db.exec("reset role");
  const notification = (await rows("select id,body from public.notifications where kind='message' and conversation_id=$1 and user_id=$2", [messageConversation, users.provider]))[0];
  assert.equal(notification.body, "Open Skill Flex to read your new message.", "new message notifications use the renamed copy");
  await db.query("update public.notifications set body='Open Skillmate to read your new message.' where id=$1", [notification.id]);
  await db.exec(renameMigration);
  await db.exec(renameMigration);
  assert.deepEqual(await rows("select id,body from public.notifications where kind='message' and conversation_id=$1 and user_id=$2", [messageConversation, users.provider]), [{ id: notification.id, body: "Open Skill Flex to read your new message." }], "reapplying the rename updates existing notification copy without duplicating rows");
  console.log("PASS rename migration preserves verified private-topic authorization and updates notification copy idempotently");
  assert.equal((await rows(
    "select count(*)::integer as count from public.marketplace_email_outbox where message_id=$1 and recipient_id=$2 and available_at > now()+interval '9 minutes'",
    [messageId, users.provider],
  ))[0].count, 1, "message emails enter the queue with a ten-minute delay");
  await asUser("customer");
  await rejects("select * from public.marketplace_email_outbox", [], /permission denied/);
  await rejects("select * from public.claim_marketplace_email_notifications()", [], /permission denied/);
  await asUser("provider");
  assert.equal((await rows(
    "select count(*)::integer as count from public.notifications where user_id=auth.uid() and kind='message' and conversation_id=$1",
    [messageConversation],
  ))[0].count, 1, "message alerts are consolidated to one per conversation");
  assert.equal((await rows(
    "select count(*)::integer as count from public.messages where conversation_id=$1 and sender_id<>auth.uid() and read_at is null",
    [messageConversation],
  ))[0].count, 1, "the unread badge source counts actual unread messages");
  await db.query(
    "update public.notifications set read_at=now() where user_id=auth.uid() and kind='message' and conversation_id=$1",
    [messageConversation],
  );
  await db.query(
    "update public.messages set read_at=now() where conversation_id=$1 and sender_id<>auth.uid() and read_at is null",
    [messageConversation],
  );
  await asUser("customer");
  await db.query(
    "insert into public.messages(conversation_id,sender_id,body) values($1,auth.uid(),'A second database test message')",
    [messageConversation],
  );
  await asUser("provider");
  const refreshedMessageNotification = (await rows(
    "select read_at, title from public.notifications where user_id=auth.uid() and kind='message' and conversation_id=$1",
    [messageConversation],
  ))[0];
  assert.equal(refreshedMessageNotification.read_at, null, "a new message reopens the consolidated notification");
  assert.equal(refreshedMessageNotification.title, "New messages");
  assert.equal((await rows(
    "select count(*)::integer as count from public.notifications where user_id=auth.uid() and kind='message' and conversation_id=$1",
    [messageConversation],
  ))[0].count, 1);
  await asUser("customer");

  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
  await db.exec("set role service_role");
  const claimed = await rows("select * from public.claim_marketplace_email_notifications()");
  assert.ok(claimed.length, "due booking email events can be claimed");
  assert.equal(claimed.some((event) => event.message_id === messageId), false, "the delayed message is not claimed before ten minutes");
  const token = claimed[0].claim_token;
  assert.ok(claimed.every((event) => event.claim_token === token));
  await rows("select public.finish_marketplace_email_notifications($1,$2::uuid[],true)", [token, claimed.map((event) => event.id)]);
  assert.equal((await rows(
    "select count(*)::integer as count from public.marketplace_email_outbox where id=any($1::uuid[]) and processed_at is not null",
    [claimed.map((event) => event.id)],
  ))[0].count, claimed.length);

  await db.query(
    "insert into public.marketplace_email_outbox(recipient_id,event_type,booking_id,available_at) values($1,'booking_update',$2,now())",
    [users.provider, overlap],
  );
  const retry = await rows("select * from public.claim_marketplace_email_notifications()");
  await rows("select public.finish_marketplace_email_notifications($1,$2::uuid[],false)", [retry[0].claim_token, [retry[0].id]]);
  const retryState = (await rows("select attempts,failed_at,available_at from public.marketplace_email_outbox where id=$1", [retry[0].id]))[0];
  assert.equal(retryState.attempts, 1);
  assert.equal(retryState.failed_at, null);
  assert.ok(new Date(retryState.available_at) > new Date(), "failed emails are rescheduled for retry");
  console.log("PASS email outbox protects access, delays unread messages, queues both booking participants and retries");

  await db.query(
    `insert into public.system_health_snapshots(
      sampled_at,database_bytes,storage_bytes,active_connections,max_connections,
      auth_ok,auth_probe_ms,database_ok,database_probe_ms
    ) values(now(),1000,2000,2,100,true,30,true,40)`,
  );
  await asUser("customer");
  await rejects("select * from public.system_health_snapshots", [], /permission denied/);
  await rejects("select * from public.read_system_health_snapshots(24)", [], /permission denied/);
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
  await db.exec("reset role");
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values('portfolio-images','sample-a','{\"size\":\"1234\"}'),('portfolio-images','sample-b','{\"size\":\"unknown\"}')",
  );
  await db.exec("set role service_role");
  const capture = await rows("select public.capture_system_health_snapshot(true,30,true,40) as sampled_at");
  assert.ok(capture[0].sampled_at);
  const snapshots = await rows("select * from public.read_system_health_snapshots(24)");
  assert.equal(snapshots.length, 2);
  assert.ok(Number(snapshots[0].database_bytes) > 0);
  assert.equal(Number(snapshots[0].storage_bytes), 1234);
  assert.equal(snapshots[0].auth_ok, true);
  assert.equal(snapshots[0].database_probe_ms, 40);
  console.log("PASS system telemetry captures live database/storage health, retains samples and is service-only");

  // A complete negotiated booking across real customer/provider security contexts.
  await db.exec("reset role");
  const negotiatedService = (await rows("insert into public.services(provider_id,title,category,description,price,currency,negotiation_mode) values($1,'Laptop consultation','Tech help','One hour of setup help.',80,'GHS','negotiation') returning id", [users.provider]))[0].id;
  await asUser("customer");
  const bookingConversation = (await rows("select public.start_conversation($1) as id", [users.provider]))[0].id;
  const negotiation = (await rows("select public.create_price_negotiation($1,$2,65,'One hour of setup help.') as id", [negotiatedService, bookingConversation]))[0].id;
  const offer = (await rows("select id from public.price_offers where negotiation_id=$1", [negotiation]))[0].id;
  await rejects("select public.decide_price_offer($1,'accept')", [offer], /offer|own|respond/i);
  await asUser("provider");
  await db.query("select public.decide_price_offer($1,'accept')", [offer]);
  await asUser("customer");
  const agreed = (await rows("select (public.create_booking_from_price_agreement($1,$2,'Please bring setup notes','On campus')).*", [negotiation, `${day}T11:00:00Z`]))[0];
  assert.equal(Number(agreed.agreed_price), 65);
  assert.equal(agreed.status, "pending");
  assert.ok(agreed.scope_snapshot);
  const duplicate = (await rows("select (public.create_booking_from_price_agreement($1,$2,'Retry','On campus')).id as id", [negotiation, `${day}T11:00:00Z`]))[0].id;
  assert.equal(duplicate, agreed.id, "retrying an agreement returns the same booking");
  await asUser("provider");
  await db.query("select public.update_booking_status($1,'confirmed')", [agreed.id]);
  await db.query("select public.start_booking_work($1)", [agreed.id]);
  await db.query("select public.update_booking_status($1,'completed')", [agreed.id]);
  await asUser("customer");
  await rejects("insert into public.reviews(booking_id,reviewer_id,provider_id,rating,body) values($1,auth.uid(),$2,5,'Helpful session')", [agreed.id, users.provider]);
  await db.query("select public.update_booking_status($1,'completed')", [agreed.id]);
  await db.query("insert into public.reviews(booking_id,reviewer_id,provider_id,rating,body) values($1,auth.uid(),$2,5,'Helpful session')", [agreed.id, users.provider]);
  await rejects("insert into public.reviews(booking_id,reviewer_id,provider_id,rating,body) values($1,auth.uid(),$2,5,'Duplicate review')", [agreed.id, users.provider]);
  const cancelled = await makeBooking("11:00");
  await db.query("select public.update_booking_status($1,'cancelled')", [cancelled]);
  assert.equal((await rows("select status from public.booking_directory where id=$1", [cancelled]))[0].status, "cancelled");
  console.log("PASS customer/provider negotiation, agreement retry, booking, verified completion, reviews and cancellation");

  await db.query("select public.record_marketplace_journey('search')");
  await db.query("select public.record_marketplace_journey('search')");
  await rejects("select public.record_marketplace_journey('private search text')", [], /Unknown journey/);
  await rejects("select * from public.marketplace_journey_daily", [], /permission denied/);
  await rejects("select * from public.read_marketplace_journey()", [], /Administrator/);
  await asUser("customer", false);
  await rejects("select public.record_marketplace_journey('search')", [], /verified session/);
  await asUser("admin");
  assert.equal(Number((await rows("select * from public.read_marketplace_journey()"))[0].students), 1);
  await db.exec("reset role");
  await db.query("insert into public.marketplace_journey_daily(user_id,event_name,event_day) values($1,'discover',current_date-91)", [users.customer]);
  await asUser("customer"); await db.query("select public.record_marketplace_journey('discover')");
  await db.exec("reset role");
  assert.equal((await rows("select count(*)::integer as count from public.marketplace_journey_daily where event_day<current_date-90"))[0].count, 0);
  console.log("PASS activity aggregates deduplicate stages, reject private text, enforce admin reads and expire old data");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.close());
