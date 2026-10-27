const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "..", "auth.js"), "utf8");

function fixture() {
  const nodes = new Map();
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      dataset: {}, attributes: {}, value: "", hidden: false, handlers: {},
      classList: { toggle() {}, remove() {}, add() {} },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; },
      addEventListener(name, callback) { this.handlers[name] = callback; },
      focus() { this.focused = true; },
      querySelector() { return get("spinner"); },
    });
    return nodes.get(selector);
  };
  const context = {
    document: { body: { dataset: {} }, querySelector: get, getElementById: id => get(`#${id}`) },
    authForm: get("#auth-form"), authMessage: get("#auth-message"),
    passwordInput: get("#auth-password"), confirmPasswordInput: get("#auth-confirm-password"),
    passwordVisibility: get("#password-visibility"), confirmPasswordVisibility: get("#confirm-password-visibility"),
    setPasswordVisibility() {}, updatePasswordHint() {}, authMode: "signin", authSubmitting: false,
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("function setAuthMode(mode)"), source.indexOf("async function loadGhanaianUniversities")), context);
  return { context, get };
}

test("account modes switch visible fields, validation and the active accessible tab", () => {
  const { context, get } = fixture();
  context.setAuthMode("signup");
  assert.equal(context.document.body.dataset.authMode, "signup");
  assert.equal(get("#name-field").hidden, false);
  assert.equal(get("#auth-student-id").required, true);
  assert.equal(get("#auth-student-id").disabled, false);
  assert.equal(get("#auth-password").autocomplete, "new-password");
  assert.equal(get("#signup-tab").tabIndex, 0);
  assert.equal(get("#auth-form").attributes["aria-labelledby"], "signup-tab");
  context.setAuthMode("signin");
  assert.equal(get("#name-field").hidden, true);
  assert.equal(get("#auth-student-id").disabled, true);
  assert.equal(get("#auth-confirm-password").disabled, true);
  assert.equal(get("#auth-password").minLength, 0);
  assert.equal(get("#forgot-password-link").hidden, false);
  assert.equal(get("#signin-tab").tabIndex, 0);
  context.setAuthMode("recovery");
  assert.equal(get("#auth-tabs").hidden, true);
  assert.equal(get("#auth-social-section").hidden, true);
  assert.equal(get("#consent-field").hidden, true);
  assert.equal(get("#auth-form").attributes["aria-labelledby"], "auth-title");
});

test("arrow keys select and focus the account tab; mode changes are blocked during authentication", () => {
  const { context, get } = fixture();
  vm.runInContext(source.slice(source.indexOf('document.querySelector("#signin-tab").addEventListener'), source.indexOf('passwordInput.addEventListener("input"')), context);
  get("#auth-tabs").handlers.keydown({ key: "ArrowRight", preventDefault() {} });
  assert.equal(context.authMode, "signup");
  assert.equal(get("#signup-tab").focused, true);
  context.authSubmitting = true;
  get("#signin-tab").handlers.click();
  assert.equal(context.authMode, "signup");
});

test("duplicate password sign-in submissions share the in-flight operation", async () => {
  const { context, get } = fixture();
  let calls = 0;
  let complete;
  context.authClient = { auth: { signInWithPassword: () => {
    calls++;
    return new Promise(resolve => { complete = resolve; });
  } } };
  context.window = { syncSkillmateServerSession: async () => {}, location: { assign() {} } };
  context.getPostAuthUrl = () => "index.html";
  get("#auth-email").value = "student@example.test";
  get("#auth-password").value = "valid-password";
  vm.runInContext(source.slice(source.indexOf('authForm.addEventListener("submit"'), source.lastIndexOf("if (!authClient)")), context);
  const event = { preventDefault() {} };
  const first = get("#auth-form").handlers.submit(event);
  const second = get("#auth-form").handlers.submit(event);
  assert.equal(calls, 1);
  complete({ data: { session: {} } });
  await Promise.all([first, second]);
  assert.equal(get("#auth-submit").disabled, false);
});
