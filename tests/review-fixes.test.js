const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const source = read("user.js");

function profileFixture(error) {
  const calls = [];
  const context = {
    state: { profile: { university: "Campus", location: "Hall", studentIdNumber: "" } },
    appUser: { id: "owner" },
    appSupabase: {
      async rpc(name, args) { calls.push({ name, args }); return { error }; },
      from(table) { return { update(data) { calls.push({ table, data }); return { eq: async (column, owner) => { calls.push({ column, owner }); return { error: null }; } }; } }; },
    },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("async function persistStudentProfileDetails"), source.indexOf('document.querySelector("#profile-form").addEventListener')), context);
  return { context, calls, details: { name: "Student", university: "Campus", bio: "Updated bio", location: "Hall", studentIdNumber: "" } };
}
test("student profile edits use one authenticated RPC with optional ID and location", async () => {
  const { context, calls, details } = profileFixture(null);
  await context.persistStudentProfileDetails(details);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "save_student_profile");
  assert.equal(calls[0].args.p_university, "Campus");
  assert.equal(calls[0].args.p_student_id_number, "");
  assert.equal(calls[0].args.p_location, "Hall");
});
test("legacy bio-only edits preserve campus, ID and location", async () => {
  const { context, calls, details } = profileFixture({ code: "PGRST202" });
  await context.persistStudentProfileDetails(details);
  assert.deepEqual(Object.keys(calls[1].data).sort(), ["bio", "full_name"]);
  assert.equal(calls[2].owner, "owner");
});
for (const changed of [{ university: "Other campus" }, { location: "Another hall" }, { studentIdNumber: "ID-123" }]) {
  test(`legacy profile rejects ${Object.keys(changed)[0]} changes without partially saving other fields`, async () => {
    const { context, calls, details } = profileFixture({ code: "PGRST202" });
    await assert.rejects(context.persistStudentProfileDetails({ ...details, ...changed }), /have not been saved/);
    assert.equal(calls.length, 1, "no profile write is permitted after the missing RPC");
  });
}
test("permission failures are preserved instead of falling back to direct writes", async () => {
  const error = { code: "42501", message: "Permission denied" };
  const { context, calls, details } = profileFixture(error);
  assert.equal((await context.persistStudentProfileDetails(details)).error, error);
  assert.equal(calls.length, 1);
});
test("admin export keeps booking type out of the date column", async () => {
  let exported, click;
  const dateNodes = [{ nodeType: 3, textContent: "29 Oct 2026" }, { nodeType: 1, textContent: "Individual" }];
  const cells = [
    { querySelector: () => ({ textContent: "Customer" }) },
    { querySelector: selector => ({ textContent: selector === "strong" ? "Service" : "Provider" }) },
    { childNodes: [{ nodeType: 1, textContent: "29 Oct 2026Individual" }], querySelector: selector => selector === ".date-cell" ? { childNodes: dateNodes } : { textContent: "Individual" } },
    { textContent: "Individual" }, { textContent: "Confirmed" },
  ];
  const context = {
    document: { querySelector: () => ({ addEventListener(_, fn) { click = fn; } }), createElement: () => ({ click() {} }) },
    Node: { TEXT_NODE: 3 }, Blob, getBookingRows: () => [{ querySelectorAll: () => cells }],
    URL: { createObjectURL(blob) { exported = blob; return "blob:fixture"; }, revokeObjectURL() {} },
    window: { setTimeout() {} }, showToast() {},
  };
  const script = read("script.js");
  vm.runInNewContext(script.slice(script.indexOf('document.querySelector("#export-button").addEventListener'), script.indexOf('document.querySelector("#period-select").addEventListener')), context);
  click();
  assert.match(await exported.text(), /"29 Oct 2026","Individual"/);
  assert.doesNotMatch(await exported.text(), /2026Individual|Individual Individual/);
});
