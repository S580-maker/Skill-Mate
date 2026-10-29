const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const smartSearch = require("../smart-search.js");
const marketplace = require("../marketplace-utils.js");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("marketplace search ranking prioritizes service names over provider details", () => {
  const source = read("user.js");
  const start = source.indexOf("function marketplaceSearchScore");
  const end = source.indexOf("function renderMarketplace", start);
  const context = { window: { skillmateSmartSearch: smartSearch } };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);

  const serviceMatch = { service: "Braids and styling", category: "Hair & beauty", name: "Ama", description: "" };
  const nameMatch = { service: "Hair consultation", category: "Other", name: "Braids by Ama", description: "" };
  assert.ok(context.marketplaceSearchScore(serviceMatch, "braids") > context.marketplaceSearchScore(nameMatch, "braids"));
});

test("search suggestions show popular starting points and ranked matching services", () => {
  const source = read("user.js");
  const start = source.indexOf("function renderSearchSuggestions");
  const end = source.indexOf("function renderGroups", start);
  const target = { hidden: true, innerHTML: "" };
  const providers = [
    { service: "Braids & protective styling", category: "Hair & beauty", name: "Akosua", id: "hair" },
    { service: "Laptop clean & tune-up", category: "Tech help", name: "Daniel", id: "tech" },
  ];
  const context = {
    globalSearch: { value: "" },
    document: {
      body: { classList: { contains: () => true } },
      querySelector: () => target,
    },
    window: { skillmateSmartSearch: smartSearch, skillmateMarketplace: marketplace },
    appSupabase: null,
    seedProviders: providers,
    state: { blocked: [] },
    selectedCategory: "All",
    escapeHTML: value => String(value),
    getCategoryIcon: () => "•",
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("function marketplaceSearchScore"), source.indexOf("function renderMarketplace")), context);
  vm.runInContext(source.slice(start, end), context);

  context.renderSearchSuggestions();
  assert.equal(target.hidden, false);
  assert.match(target.innerHTML, /Popular searches/);
  assert.match(target.innerHTML, /data-search-suggestion="Tutoring"/);

  context.globalSearch.value = "braids";
  context.renderSearchSuggestions();
  assert.match(target.innerHTML, /Braids &amp; protective styling|Braids & protective styling/);
  assert.doesNotMatch(target.innerHTML, /Laptop clean/);
});
