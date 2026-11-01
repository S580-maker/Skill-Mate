const { test } = require("node:test");
const assert = require("node:assert/strict");
const apiRouter = require("../api/[...path]");

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

test("Vercel catch-all dispatches known routes from dynamic path parameters", async () => {
  const response = createResponse();
  await apiRouter({ method: "GET", query: { path: ["session"] } }, response);
  assert.equal(response.statusCode, 405);
  assert.deepEqual(response.body, { error: "Method not allowed." });
});

test("Vercel catch-all returns 404 for unknown routes", async () => {
  const response = createResponse();
  await apiRouter({ method: "GET", query: { path: ["unknown"] } }, response);
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: "Not found." });
});
