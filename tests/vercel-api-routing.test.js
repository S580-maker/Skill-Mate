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
  await apiRouter({ method: "GET", query: { path: "auth/sign-in" } }, response);
  assert.equal(response.statusCode, 405);
  assert.deepEqual(response.body, { error: "Method not allowed." });
});

test("Vercel API router returns 404 for unknown routes", async () => {
  const response = createResponse();
  await apiRouter({ method: "GET", query: { path: "unknown" } }, response);
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: "Not found." });
});
