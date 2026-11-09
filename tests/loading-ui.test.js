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
  const loading = context.window.skillmateLoading;
  for (const result of ["success", "failure"]) {
    const finish = loading.show(target, { label: 'Loading <updates> "now"', variant: "cards" });
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
