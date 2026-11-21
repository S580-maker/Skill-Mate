const { test } = require("node:test");
const assert = require("node:assert/strict");
const apiRouter = require("../api");

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    append(name, value) {
      this.headers[name] = this.headers[name] ? `${this.headers[name]}, ${value}` : value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test("Vercel API router dispatches known nested routes from the rewrite parameter", async () => {
  const response = createResponse();
  await apiRouter({ method: "GET", ip: "127.0.0.1", query: { path: "auth/sign-in" } }, response);
  assert.equal(response.statusCode, 405);
  assert.deepEqual(response.body, { error: "Method not allowed." });
});

test("Vercel API router returns 404 for unknown routes", async () => {
  const response = createResponse();
  await apiRouter({ method: "GET", ip: "127.0.0.1", query: { path: "unknown" } }, response);
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: "Not found." });
});

test("Vercel API router dispatches the admin moderation endpoint with origin protection", async () => {
  const response = createResponse();
  await apiRouter({
    method: "POST",
    ip: "127.0.0.1",
    query: { path: "admin-moderation" },
    headers: { origin: "https://attacker.example", host: "skillmate.example" },
  }, response);
  assert.equal(response.statusCode, 403);
  assert.match(response.body.error, /same-origin|admin dashboard/i);
});
