const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { TextEncoder } = require("node:util");
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
    TextEncoder,
    document: { body: { dataset: {} }, querySelector: get, getElementById: id => get(`#${id}`) },
    authForm: get("#auth-form"), authMessage: get("#auth-message"),
    passwordInput: get("#auth-password"), confirmPasswordInput: get("#auth-confirm-password"),
    passwordVisibility: get("#password-visibility"), confirmPasswordVisibility: get("#confirm-password-visibility"),
    setPasswordVisibility() {}, updatePasswordHint() {}, authMode: "signin", authSubmitting: false,
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("function setAuthMode(mode)"), source.indexOf("function loadGhanaianUniversities()")), context);
  return { context, get };
}

function otpFixture(fetchHandler = async () => ({ ok: false, json: async () => ({ error: "That code doesn’t match." }) })) {
  const nodes = new Map();
  const intervals = [];
  const makeNode = () => ({
    value: "", disabled: false, hidden: false, textContent: "", attributes: {}, handlers: {},
    classList: {
      values: new Set(),
      add(...names) { names.forEach(name => this.values.add(name)); },
      remove(...names) { names.forEach(name => this.values.delete(name)); },
      contains(name) { return this.values.has(name); },
    },
    addEventListener(name, callback) { this.handlers[name] = callback; },
    requestSubmit() { this.submissions = (this.submissions || 0) + 1; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    focus() { this.focused = true; },
    querySelector() { return spinner; },
  });
  const inputs = Array.from({ length: 6 }, makeNode);
  const spinner = makeNode();
  const selectors = {
    "#otp-form": makeNode(),
    "#auth-otp": makeNode(),
    "#otp-submit": Object.assign(makeNode(), { disabled: true }),
    "#otp-submit-label": makeNode(),
    "#otp-message": makeNode(),
    "#otp-resend": makeNode(),
    "#otp-resend-prefix": makeNode(),
    "#otp-countdown": makeNode(),
  };
  for (const [selector, node] of Object.entries(selectors)) nodes.set(selector, node);
  const document = {
    querySelector: selector => nodes.get(selector),
    querySelectorAll: selector => selector === ".auth-otp-inputs input" ? inputs : [],
  };
  const navigations = [];
  const requests = [];
  const context = {
    document,
    authSubmitting: false,
    authClient: { auth: { setSession: async () => ({ data: { session: {} }, error: null }) } },
    fetch: async (url, options) => {
      requests.push({ url, body: options.body ? JSON.parse(options.body) : undefined, options });
      return fetchHandler(url, options);
    },
    getPostAuthUrl: () => "index.html",
    window: {
      clearInterval() {},
      setInterval(callback, delay) { intervals.push({ callback, delay }); return intervals.length; },
      setTimeout(callback) { callback(); return 1; },
      sessionStorage: { getItem() { return null; }, removeItem() {} },
      syncSkillmateServerSession: async () => {},
      location: { assign(url) { navigations.push(url); } },
    },
    console: { error() {} },
  };
  vm.createContext(context);
  context.getResendRetryDelay = require("../auth-utils").getResendRetryDelay;
  vm.runInContext("let otpCountdownTimer = null;", context);
  vm.runInContext(source.slice(
    source.indexOf("function startOtpCountdown"),
    source.indexOf("function showOtpChallenge"),
  ), context);
  vm.runInContext(source.slice(
    source.indexOf("async function submitOtpCode"),
    source.indexOf('document.querySelector("#otp-resend").addEventListener'),
  ), context);
  vm.runInContext(source.slice(
    source.indexOf('document.querySelector("#otp-resend").addEventListener'),
    source.indexOf('document.querySelector("#otp-back").addEventListener'),
  ), context);
  return { context, inputs, nodes: selectors, requests, navigations, intervals };
}

test("OTP markup has exactly six one-digit inputs", () => {
  const markup = fs.readFileSync(path.join(__dirname, "..", "login.html"), "utf8");
  const group = markup.match(/<div class="auth-otp-inputs"[\s\S]*?<\/div>/)?.[0] || "";
  const inputs = group.match(/<input\b[^>]*>/g) || [];
  assert.equal(inputs.length, 6);
  assert.equal(inputs.every(input => /maxlength="1"/.test(input) && /pattern="\[0-9\]"/.test(input)), true);
  assert.match(markup, /6-digit code/);
});

test("OTP input filters digits, handles navigation and paste, and gates verification", () => {
  const { inputs, nodes } = otpFixture();
  assert.equal(nodes["#otp-submit"].disabled, true);
  inputs[0].value = "x1";
  inputs[0].handlers.input();
  assert.equal(inputs[0].value, "1");
  assert.equal(inputs[1].focused, true);

  inputs[2].handlers.keydown({ key: "Backspace" });
  assert.equal(inputs[1].focused, true);

  let prevented = false;
  inputs[3].handlers.paste({
    clipboardData: { getData: () => "12a3456" },
    preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true);
  assert.deepEqual(inputs.map(input => input.value), ["1", "2", "3", "4", "5", "6"]);
  assert.equal(nodes["#otp-submit"].disabled, false);
  assert.equal(nodes["#otp-form"].submissions, 1, "A complete pasted code automatically submits");
});

test("OTP verification rejects incorrect codes with retry feedback and accepts six digits", async () => {
  let attempts = 0;
  const { context, inputs, nodes, requests, navigations } = otpFixture(async () => {
    attempts++;
    return attempts === 1
      ? { ok: false, json: async () => ({ error: "That code doesn’t match." }) }
      : { ok: true, json: async () => ({ session: { access_token: "access", refresh_token: "refresh" } }) };
  });
  inputs.forEach((input, index) => { input.value = String(index); });

  await nodes["#otp-form"].handlers.submit({ preventDefault() {} });
  assert.equal(requests[0].body.code, "012345");
  assert.equal(nodes["#auth-otp"].classList.contains("is-error"), true);
  assert.equal(nodes["#otp-message"].textContent, "That code doesn’t match.");
  assert.equal(nodes["#otp-submit"].disabled, true);
  assert.equal(inputs.every(input => !input.disabled), true);
  assert.equal(inputs.every(input => input.value === ""), true, "Rejected digits are cleared for a fresh retry");

  inputs.forEach((input, index) => { input.value = String(index); });
  await nodes["#otp-form"].handlers.submit({ preventDefault() {} });
  assert.equal(requests[1].body.code, "012345");
  assert.equal(nodes["#auth-otp"].classList.contains("is-success"), true);
  assert.equal(nodes["#otp-submit-label"].textContent, "Verified");
  assert.deepEqual(navigations, ["index.html"]);
  assert.equal(context.authSubmitting, false);
});

test("OTP resend handles success and honors the server cooldown", async () => {
  let response = {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ message: "A new code was sent to your email." }),
  };
  const { nodes, requests } = otpFixture(async () => response);
  const button = nodes["#otp-resend"];

  button.disabled = false;
  await button.handlers.click();
  assert.equal(requests[0].url, "/api/auth/resend");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.credentials, "same-origin");
  assert.equal(nodes["#otp-message"].textContent, "A new code was sent to your email.");
  assert.equal(nodes["#otp-countdown"].textContent, "0:30");
  assert.equal(button.disabled, true);
  assert.equal(button.attributes["aria-busy"], undefined);

  response = {
    ok: false,
    status: 429,
    headers: { get: name => name === "retry-after" ? "19" : null },
    json: async () => ({ error: "Please wait 19 seconds before requesting another code." }),
  };
  button.disabled = false;
  await button.handlers.click();
  assert.equal(nodes["#otp-countdown"].textContent, "0:19");
  assert.equal(button.disabled, true);
  assert.equal(nodes["#otp-message"].textContent, "Please wait 19 seconds before requesting another code.");
});

test("OTP resend countdown uses elapsed time instead of throttled timer ticks", () => {
  const { context, nodes, intervals } = otpFixture();
  let now = 1000;
  context.Date = { now: () => now };
  const button = nodes["#otp-resend"];

  context.startOtpCountdown(30);
  assert.equal(nodes["#otp-countdown"].textContent, "0:30");
  assert.equal(button.disabled, true);
  now += 31_000;
  intervals.at(-1).callback();
  assert.equal(nodes["#otp-countdown"].textContent, "Resend code");
  assert.equal(button.disabled, false);
});

test("restored sessions without OTP proof start email verification instead of redirecting", async () => {
  const { context } = fixture();
  let challengeSession = null;
  const verifiedSession = { access_token: "unverified-access" };
  Object.assign(context, {
    sessionOtpStarted: false,
    sessionCheckStarted: false,
    authRedirectStarted: false,
    authSubmitting: false,
    getPostAuthUrl: () => "index.html",
    startSessionOtp: async session => { challengeSession = session; },
  });
  context.window = {
    sessionStorage: { getItem: () => null },
    syncSkillmateServerSession: async () => {
      const error = new Error("Verify your email.");
      error.code = "OTP_VERIFICATION_REQUIRED";
      throw error;
    },
    location: { replace() { assert.fail("Unverified sessions must not redirect."); } },
  };
  vm.runInContext(source.slice(
    source.indexOf("async function redirectForSession"),
    source.indexOf("async function startSessionOtp"),
  ), context);

  await context.redirectForSession(verifiedSession);

  assert.equal(challengeSession, verifiedSession);
  assert.equal(context.authRedirectStarted, false);
});

test("account modes switch visible fields, validation and the active accessible tab", () => {
  const { context, get } = fixture();
  context.setAuthMode("signup");
  assert.equal(context.document.body.dataset.authMode, "signup");
  assert.equal(get("#name-field").hidden, false);
  assert.equal(get("#auth-university").required, true);
  assert.equal(get("#auth-confirm-password").required, false);
  assert.equal(get("#auth-confirm-password").disabled, true);
  assert.equal(get("#consent-field").hidden, false);
  assert.equal(get("#auth-password").autocomplete, "new-password");
  assert.equal(get("#signup-tab").tabIndex, 0);
  assert.equal(get("#auth-form").attributes["aria-labelledby"], "signup-tab");
  context.setAuthMode("signin");
  assert.equal(get("#name-field").hidden, true);
  assert.equal(get("#consent-field").hidden, true);
  assert.equal(get("#auth-confirm-password").disabled, true);
  assert.equal(get("#auth-password").minLength, 0);
  assert.equal(get("#forgot-password-link").hidden, false);
  assert.equal(get("#signin-tab").tabIndex, 0);
  context.setAuthMode("recovery");
  assert.equal(get("#auth-tabs").hidden, true);
  assert.equal(get("#auth-social-section").hidden, true);
  assert.equal(get("#consent-field").hidden, true);
  assert.equal(get("#auth-confirm-password").required, true);
  assert.equal(get("#auth-confirm-password").disabled, false);
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

test("Ghana university suggestions load from the built-in directory without a network request", () => {
  const { context, get } = fixture();
  const universities = ["University of Ghana", "Ashesi University"];
  const options = get("#ghana-university-options");
  const status = get("#university-directory-status");
  options.replaceChildren = (...items) => { options.children = items; };
  context.window = { SKILLMATE_UNIVERSITY_DIRECTORY: { fallback: universities } };
  context.document.createElement = () => ({ value: "" });
  vm.runInContext(source.slice(
    source.indexOf("function loadGhanaianUniversities()"),
    source.indexOf('document.querySelector("#signin-tab").addEventListener'),
  ), context);

  context.loadGhanaianUniversities();

  assert.deepEqual(options.children.map(option => option.value), universities);
  assert.equal(status.textContent, "Choose a suggestion or type your university name.");
});

test("duplicate password sign-in submissions share the in-flight operation", async () => {
  const { context, get } = fixture();
  let requests = 0;
  context.authClient = { auth: { signInWithPassword() { throw new Error("Browser password sign-in must not be used."); } } };
  context.fetch = () => {
    requests++;
    return new Promise(resolve => { context.completeChallenge = () => resolve({ ok: true, json: async () => ({ message: "Code sent" }) }); });
  };
  context.showOtpChallenge = email => {
    context.challengeEmail = email;
    context.document.body.dataset.authMode = "verification";
  };
  context.window = { syncSkillmateServerSession: async () => {}, location: { assign() {} }, clearInterval() {}, setInterval() { return 1; } };
  context.document.querySelectorAll = () => [];
  context.document.querySelector("#otp-form").addEventListener = () => {};
  context.document.querySelector("#auth-social-section").hidden = false;
  context.document.querySelector("#auth-note").hidden = false;
  context.document.querySelector(".auth-footer").hidden = false;
  context.getPostAuthUrl = () => "index.html";
  get("#auth-email").value = "student@example.test";
  get("#auth-password").value = "valid-password";
  vm.runInContext(source.slice(source.indexOf('authForm.addEventListener("submit"'), source.lastIndexOf("if (!authClient)")), context);
  const event = { preventDefault() {} };
  const first = get("#auth-form").handlers.submit(event);
  const second = get("#auth-form").handlers.submit(event);
  assert.equal(requests, 1);
  context.completeChallenge();
  await Promise.all([first, second]);
  assert.equal(get("#auth-submit").disabled, false);
  assert.equal(context.document.body.dataset.authMode, "verification");
  assert.equal(context.challengeEmail, "student@example.test");
});

test("account creation starts an OTP challenge before a browser session is created", async () => {
  const { context, get } = fixture();
  let requestUrl = "";
  let requestBody = null;
  let otpRequest = null;
  context.authMode = "signup";
  context.isInvalidRefreshTokenError = () => false;
  context.friendlyAuthError = () => "Unexpected authentication error.";
  context.authClient = { auth: {
    async signUp() { throw new Error("Signup must wait for OTP before creating a user."); },
  } };
  context.fetch = async (url, options) => {
    requestUrl = url;
    requestBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ message: "Code sent" }) };
  };
  context.showOtpChallenge = (email, signup) => { otpRequest = { email, signup }; };
  context.window = { location: { assign() {} } };
  get("#auth-email").value = "student@example.test";
  get("#auth-password").value = "valid-password";
  get("#auth-name").value = "Test Student";
  get("#auth-university").value = "University of Ghana";
  vm.runInContext(source.slice(source.indexOf('authForm.addEventListener("submit"'), source.lastIndexOf("if (!authClient)")), context);

  await get("#auth-form").handlers.submit({ preventDefault() {} });

  assert.equal(requestUrl, "/api/auth/sign-up");
  assert.deepEqual(requestBody, {
    email: "student@example.test",
    password: "valid-password",
    fullName: "Test Student",
    university: "University of Ghana",
  });
  assert.equal(get("#auth-password").value, "");
  assert.deepEqual(otpRequest, { email: "student@example.test", signup: true });
});
