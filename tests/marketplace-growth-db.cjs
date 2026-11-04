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
    create function realtime.topic() returns text language sql stable as $$ select ''::text $$;
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
  await asUser("provider");
  await db.query("select public.update_booking_status($1,'confirmed')", [first]);
  await asUser("customer");
  assert.equal((await rows("select * from public.available_provider_slots($1,$2::date)", [users.provider, day])).length, 2);
  await rejects("select public.start_booking_work($1)", [first], /Only the provider/);
  await asUser("provider");
  await db.query("select public.start_booking_work($1)", [first]);
  assert.ok((await rows("select work_started_at from public.booking_directory where id=$1", [first]))[0].work_started_at);
  await db.query("select public.update_booking_status($1,'completed')", [first]);
  await asUser("customer");
  const second = await makeBooking("10:00");
  assert.ok(second, "An outstanding review never blocks a new booking at the database");
  await asUser("responder");
  const overlap = await makeBooking("10:00");
  await asUser("provider");
  await db.query("select public.update_booking_status($1,'confirmed')", [second]);
  await rejects("select public.update_booking_status($1,'confirmed')", [overlap], /unavailable/);
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
  const messageId = (await rows(
    "insert into public.messages(conversation_id,sender_id,body) values($1,auth.uid(),'Hello from a database test') returning id",
    [messageConversation],
  ))[0].id;
  await db.exec("reset role");
  assert.equal((await rows(
    "select count(*)::integer as count from public.marketplace_email_outbox where message_id=$1 and recipient_id=$2 and available_at > now()+interval '9 minutes'",
    [messageId, users.provider],
  ))[0].count, 1, "message emails enter the queue with a ten-minute delay");
  await asUser("customer");
  await rejects("select * from public.marketplace_email_outbox", [], /permission denied/);
  await rejects("select * from public.claim_marketplace_email_notifications()", [], /permission denied/);

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
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.close());
