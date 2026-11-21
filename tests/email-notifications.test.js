const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const nodemailer = require("nodemailer");
const handler = require("../api/_lib/routes/email-notifications");

const originalFetch = global.fetch;
const originalTransport = nodemailer.createTransport;
const envKeys = [
  "CRON_SECRET",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
];
const originalEnvironment = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const recipient = "11111111-1111-4111-8111-111111111111";
const secondRecipient = "22222222-2222-4222-8222-222222222222";
const claimToken = "33333333-3333-4333-8333-333333333333";
const ids = {
  unread: "44444444-4444-4444-8444-444444444444",
  read: "55555555-5555-4555-8555-555555555555",
  booking: "66666666-6666-4666-8666-666666666666",
  disabledBooking: "77777777-7777-4777-8777-777777777777",
};

function responseStub() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(status) { this.statusCode = status; return this; },
    json(body) { this.body = body; return this; },
  };
}

function configureEnvironment() {
  Object.assign(process.env, {
    CRON_SECRET: "test-cron-secret",
    SUPABASE_URL: "https://email-test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "587",
    SMTP_USER: "mailer@example.test",
    SMTP_PASS: "test-password",
    SMTP_FROM: "Skill Flex <mailer@example.test>",
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  nodemailer.createTransport = originalTransport;
  for (const key of envKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

test("email worker rejects unauthorized requests before touching Supabase", async () => {
  configureEnvironment();
  global.fetch = () => assert.fail("Unauthorized cron requests cannot contact Supabase");
  const res = responseStub();
  await handler({ method: "POST", headers: { authorization: "Bearer wrong" } }, res);
  assert.equal(res.statusCode, 401);
});

test("email worker batches unread messages and booking updates and respects preferences", async () => {
  configureEnvironment();
  const sent = [];
  let messageLookups = 0;
  const finished = [];
  nodemailer.createTransport = () => ({ sendMail: async (message) => sent.push(message) });
  global.fetch = async (url, options) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.pathname.endsWith("/rpc/claim_marketplace_email_notifications")) {
      return {
        ok: true,
        json: async () => [
          { id: ids.unread, recipient_id: recipient, event_type: "message", message_id: ids.unread, claim_token: claimToken },
          { id: ids.read, recipient_id: recipient, event_type: "message", message_id: ids.read, claim_token: claimToken },
          { id: ids.booking, recipient_id: recipient, event_type: "booking_request", booking_id: ids.booking, claim_token: claimToken },
          { id: ids.disabledBooking, recipient_id: secondRecipient, event_type: "booking_update", booking_id: ids.disabledBooking, claim_token: claimToken },
        ],
      };
    }
    if (parsedUrl.pathname.endsWith("/profiles")) {
      const id = parsedUrl.searchParams.get("id");
      if (id === `eq.${recipient}`) {
        return { ok: true, json: async () => [{ id: recipient, notify_messages: true, notify_booking_updates: true }] };
      }
      return {
        ok: true,
        json: async () => [
          { id: recipient, notify_messages: true, notify_booking_updates: true },
          { id: secondRecipient, notify_messages: true, notify_booking_updates: false },
        ],
      };
    }
    if (parsedUrl.pathname.endsWith("/messages")) {
      messageLookups += 1;
      return {
        ok: true,
        json: async () => [
          { id: ids.unread, read_at: null },
          { id: ids.read, read_at: messageLookups === 1 ? "2026-11-04T10:00:00Z" : null },
        ],
      };
    }
    if (parsedUrl.pathname.endsWith(`/auth/v1/admin/users/${recipient}`)) {
      return { ok: true, json: async () => ({ email: "student@example.test" }) };
    }
    if (parsedUrl.pathname.endsWith("/rpc/finish_marketplace_email_notifications")) {
      finished.push(JSON.parse(options.body));
      return { ok: true, json: async () => 1 };
    }
    assert.fail(`Unexpected request: ${url}`);
  };

  const res = responseStub();
  await handler({ method: "POST", headers: { authorization: "Bearer test-cron-secret" } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { processed: 4, sent: 1, retrying: 0 });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "student@example.test");
  assert.match(sent[0].text, /1 unread message/);
  assert.match(sent[0].text, /1 booking update/);
  assert.doesNotMatch(sent[0].text, /private message content/);
  assert.deepEqual(finished.map((item) => item.p_succeeded), [true]);
  assert.deepEqual(new Set(finished[0].p_outbox_ids), new Set(Object.values(ids)));
  assert.equal(messageLookups, 2, "message read state is checked again immediately before sending");
});

test("failed SMTP delivery is returned to the durable queue for retry", async () => {
  configureEnvironment();
  const finishes = [];
  nodemailer.createTransport = () => ({ sendMail: async () => { throw Object.assign(new Error("SMTP unavailable"), { code: "ECONNECTION" }); } });
  global.fetch = async (url, options) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.pathname.endsWith("/rpc/claim_marketplace_email_notifications")) {
      return {
        ok: true,
        json: async () => [{ id: ids.booking, recipient_id: recipient, event_type: "booking_update", booking_id: ids.booking, claim_token: claimToken }],
      };
    }
    if (parsedUrl.pathname.endsWith("/profiles")) {
      return { ok: true, json: async () => [{ id: recipient, notify_messages: true, notify_booking_updates: true }] };
    }
    if (parsedUrl.pathname.endsWith(`/auth/v1/admin/users/${recipient}`)) {
      return { ok: true, json: async () => ({ email: "student@example.test" }) };
    }
    if (parsedUrl.pathname.endsWith("/rpc/finish_marketplace_email_notifications")) {
      finishes.push(JSON.parse(options.body));
      return { ok: true, json: async () => 1 };
    }
    assert.fail(`Unexpected request: ${url}`);
  };

  const res = responseStub();
  await handler({ method: "POST", headers: { authorization: "Bearer test-cron-secret" } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { processed: 1, sent: 0, retrying: 1 });
  assert.equal(finishes.length, 1);
  assert.equal(finishes[0].p_succeeded, false);
  assert.deepEqual(finishes[0].p_outbox_ids, [ids.booking]);
});
