const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("admin navigation updates the active section immediately when clicked", () => {
  const source = fs.readFileSync(path.join(__dirname, "../script.js"), "utf8");
  assert.match(source, /showAdminView\(link\.hash\.slice\(1\)\)/);
  assert.match(source, /addEventListener\("hashchange", \(\) => showAdminView\(\)\)/);
  const start = source.indexOf("function showAdminView(");
  const end = source.indexOf("\nfunction showToast(", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const views = ["overview", "bookings"].map((id) => ({
    id,
    hidden: true,
    closest: () => null,
    querySelector: () => ({ textContent: id }),
  }));
  const links = views.map((view) => ({
    hash: `#${view.id}`,
    attributes: {},
    classes: new Set(),
    classList: {
      toggle(name, active) {
        if (active) this.owner.classes.add(name);
        else this.owner.classes.delete(name);
      },
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    querySelector: () => ({ textContent: view.id }),
  }));
  links.forEach((link) => { link.classList.owner = link; });
  const breadcrumb = { textContent: "" };
  const document = {
    getElementById(id) { return views.find((view) => view.id === id) || null; },
    querySelectorAll(selector) { return selector === ".side-nav .nav-link" ? links : []; },
    querySelector(selector) {
      if (selector === "#admin-page-title") return breadcrumb;
      const match = selector.match(/href="#([^"]+)"/);
      return links.find((link) => link.hash === `#${match?.[1]}`) || null;
    },
  };
  const context = {
    adminViews: views,
    document,
    window: { location: { hash: "#overview" } },
  };

  vm.runInNewContext(`${source.slice(start, end)}; showAdminView("bookings");`, context);

  assert.deepEqual(views.map((view) => view.hidden), [true, false]);
  assert.deepEqual(links.map((link) => link.classes.has("active")), [false, true]);
  assert.deepEqual(links.map((link) => link.attributes["aria-current"] || null), [null, "page"]);
  assert.equal(breadcrumb.textContent, "bookings");

  context.window.location.hash = "#overview";
  vm.runInNewContext("showAdminView()", context);
  assert.deepEqual(views.map((view) => view.hidden), [false, true]);
  assert.deepEqual(links.map((link) => link.classes.has("active")), [true, false]);
});
