const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const edgeFunctionDirectory = path.join(__dirname, "..", "supabase", "functions", "push-notification-webhook");
const edgeFunctionEntry = fs.readFileSync(path.join(edgeFunctionDirectory, "index.ts"), "utf8");

async function createEdgeFunction({ environment = {}, fetchHandler = async () => new Response("{}", { status: 200 }) } = {}) {
  const { createPushWebhookHandler } = await import(
    pathToFileURL(path.join(edgeFunctionDirectory, "handler.mjs")).href
  );
  return createPushWebhookHandler({
    getEnv(name) { return environment[name] || ""; },
    fetcher: fetchHandler,
    logError() {},
  });
}

function insertEvent() {
  return {
    type: "INSERT",
    table: "notifications",
    schema: "public",
    record: {
      user_id: "223e4567-e89b-42d3-a456-426614174000",
      kind: "message",
      title: "New message",
      body: "Private message contents",
      target_path: "messages",
    },
  };
}

test("Edge Function entry authenticates database webhooks with a Supabase secret key", () => {
  assert.match(edgeFunctionEntry, /withSupabase\(\{ auth: "secret" \}, handler\)/);
  assert.match(edgeFunctionEntry, /Deno\.serve\(/);
  const config = fs.readFileSync(path.join(__dirname, "..", "supabase", "config.toml"), "utf8");
  assert.match(config, /\[functions\.push-notification-webhook\]\s*verify_jwt = false/);
});

test("Edge Function rejects other database events before forwarding", async () => {
  let dispatched = false;
  const handler = await createEdgeFunction({
    environment: {
      PUSH_DISPATCH_SECRET: "server-secret",
      PUSH_DISPATCH_URL: "https://skillflex.example/api/push-dispatch",
    },
    fetchHandler: async () => { dispatched = true; return new Response("{}", { status: 200 }); },
  });
  const event = insertEvent();
  event.type = "UPDATE";
  const response = await handler(new Request("https://edge.example/functions/v1/push-notification-webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  }));
  assert.equal(response.status, 400);
  assert.equal(dispatched, false);
});

test("Edge Function returns method errors without invoking the delivery service", async () => {
  let dispatched = false;
  const handler = await createEdgeFunction({
    fetchHandler: async () => { dispatched = true; return new Response("{}", { status: 200 }); },
  });
  const response = await handler(new Request("https://edge.example/functions/v1/push-notification-webhook", {
    method: "GET",
  }));
  assert.equal(response.status, 405);
  assert.equal(dispatched, false);
});

test("Edge Function forwards valid notification inserts using the server-only dispatch secret", async () => {
  let forwarded;
  const handler = await createEdgeFunction({
    environment: {
      PUSH_DISPATCH_SECRET: "server-secret",
      PUSH_DISPATCH_URL: "https://skillflex.example/api/push-dispatch",
    },
    fetchHandler: async (url, options) => {
      forwarded = { url: String(url), options };
      return new Response("{}", { status: 200 });
    },
  });
  const response = await handler(new Request("https://edge.example/functions/v1/push-notification-webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(insertEvent()),
  }));
  assert.equal(response.status, 200);
  assert.equal(forwarded.url, "https://skillflex.example/api/push-dispatch");
  assert.equal(forwarded.options.headers["x-skillflex-push-secret"], "server-secret");
  assert.deepEqual(JSON.parse(forwarded.options.body), insertEvent());
});

test("Edge Function forwards negotiation notifications linked to their conversation", async () => {
  let forwarded;
  const handler = await createEdgeFunction({
    environment: {
      PUSH_DISPATCH_SECRET: "server-secret",
      PUSH_DISPATCH_URL: "https://skillflex.example/api/push-dispatch",
    },
    fetchHandler: async (url, options) => {
      forwarded = { url: String(url), options };
      return new Response("{}", { status: 200 });
    },
  });
  const event = insertEvent();
  event.record.kind = "negotiation_counter";
  event.record.conversation_id = "323e4567-e89b-42d3-a456-426614174000";
  const response = await handler(new Request("https://edge.example/functions/v1/push-notification-webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(forwarded.options.body), event);
});

test("Edge Function refuses to forward to a non-HTTPS dispatch URL", async () => {
  const handler = await createEdgeFunction({
    environment: {
      PUSH_DISPATCH_SECRET: "server-secret",
      PUSH_DISPATCH_URL: "http://skillflex.example/api/push-dispatch",
    },
  });
  const response = await handler(new Request("https://edge.example/functions/v1/push-notification-webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(insertEvent()),
  }));
  assert.equal(response.status, 503);
});
