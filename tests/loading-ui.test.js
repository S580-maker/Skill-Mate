const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

test("loading placeholders preserve existing content and clean up on success or failure", () => {
  const existing = { title: "Cached notification" };
  const children = [existing];
  const attributes = {};
  const target = {
    tagName: "UL", append: item => children.push(item),
    setAttribute: (key, value) => { attributes[key] = value; },
    removeAttribute: key => { delete attributes[key]; },
  };
  const context = { window: {}, document: { createElement: tagName => ({ tagName,
    remove() { const index = children.indexOf(this); if (index >= 0) children.splice(index, 1); },
  }) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "loading-ui.js"), "utf8"), context);
  const loading = context.window.skillflexLoading;
  for (const result of ["success", "failure"]) {
    const finish = loading.show(target, { label: 'Loading <updates> "now"', variant: "cards", delay: 0 });
    assert.equal(children[0], existing, result);
    assert.equal(children[1].tagName, "li");
    assert.equal(attributes["aria-busy"], "true");
    assert.match(children[1].innerHTML, /role="status"/);
    assert.match(children[1].innerHTML, /Loading &lt;updates&gt; &quot;now&quot;/);
    finish(); finish();
    assert.deepEqual(children, [existing]);
    assert.equal(attributes["aria-busy"], undefined);
  }
});

test("loading ownership cancels obsolete timers and never steals focus or deletes cached content", () => {
  const timers = new Map(); let id = 0;
  const children = [], attributes = {};
  const target = {
    tagName: "DIV", append: child => children.push(child),
    setAttribute: (key, value) => { attributes[key] = value; },
    removeAttribute: key => { delete attributes[key]; },
  };
  const context = { window: {}, setTimeout: callback => { timers.set(++id, callback); return id; }, clearTimeout: key => timers.delete(key),
    document: { createElement: () => ({ remove() { const index = children.indexOf(this); if (index >= 0) children.splice(index, 1); } }) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "loading-ui.js"), "utf8"), context);
  const { show } = context.window.skillflexLoading;
  const fast = show(target);
  fast();
  assert.equal(timers.size, 0, "fast result cancels the delayed placeholder");
  assert.equal(children.length, 0);
  const old = show(target);
  const next = show(target, { delay: 0 });
  old();
  assert.equal(timers.size, 0);
  assert.equal(children.length, 1, "only the current request owns a placeholder");
  assert.equal(attributes["aria-busy"], "true");
  next();
  children.push({ cached: true });
  const refresh = show(target, { preserve: true, delay: 0 });
  assert.equal(children.length, 1, "refresh keeps cached content without extra skeleton rows");
  refresh();
  assert.equal(attributes["aria-busy"], undefined);
  assert.deepEqual(children, [{ cached: true }]);
});

test("read deadline rejects hung requests and releases its timer on success", async () => {
  const context = { window: {}, document: {}, setTimeout, clearTimeout };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "loading-ui.js"), "utf8"), context);
  const { withTimeout } = context.window.skillflexLoading;
  assert.equal(await withTimeout(Promise.resolve("ready"), 30), "ready");
  await assert.rejects(withTimeout(new Promise(() => {}), 5), /timed out/);
});
