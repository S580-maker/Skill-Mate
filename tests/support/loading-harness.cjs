// Serves the real student app with a scriptable fake Supabase client so loading,
// empty and failed states can be exercised in headless Chrome. It never contacts Supabase.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { contentSecurityPolicy, serializePolicy } = require("../../api/_lib/content-security-policy");

const root = path.resolve(__dirname, "..", "..");
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json" };

// Runs in the page in place of supabase-client.js. Query-string options seed window.__fake,
// which tests can change at runtime: delay (ms), failing (table names or "all"), empty.
const fakeClient = `(() => {
  const params = new URLSearchParams(location.search);
  const fake = window.__fake = {
    delay: Number(params.get("delay") || 0),
    failing: new Set((params.get("fail") || "").split(",").filter(Boolean)),
    empty: params.has("empty"),
    calls: [],
  };
  const future = days => new Date(Date.now() + days * 864e5).toISOString();
  const providers = [
    ["p1", "Kwame Asante", "Tutoring", "Calculus and statistics tutoring", 60],
    ["p2", "Efua Boateng", "Design", "Logo and poster design", 120],
    ["p3", "Yaw Owusu", "Tech help", "Laptop setup and troubleshooting", 80],
    ["p4", "Abena Darko", "Writing", "Essay editing and proofreading", 45],
    ["p5", "Nana Adjei", "Photography", "Graduation and event photos", 200],
    ["p6", "Esi Quartey", "Beauty", "Braiding and hair styling", 150],
  ];
  const data = {
    profiles: [{ id: "me", full_name: "Ama Mensah", university: "University of Ghana", course: "Computer Science", bio: "Third-year student.", campus_verified: true, role: params.has("admin") ? "admin" : "student", skills: ["Design"], avatar_url: "", onboarding_completed: true, phone_number: "", notify_booking_updates: true, notify_messages: true }],
    notifications: [{ id: "n1", title: "Booking update", body: "Your appointment is confirmed.", created_at: future(-1), read_at: future(-1) }],
    provider_directory: providers.map(([id, name, category, title, price], index) => ({ service_id: "s" + (index + 1), provider_id: id, full_name: name, avatar_url: "", university: "University of Ghana", course: "Student", category, service_title: title, service_description: "Friendly, reliable help from a fellow student.", price, currency: "GHS", accepts_groups: false, campus_verified: index % 2 === 0, completed_bookings: index * 3, negotiation_mode: "fixed", service_created_at: future(-index - 1), skills: [], bio: "" })),
    services: [{ id: "own1", provider_id: "me", title: "Resume review and interview practice", category: "Writing", price: 70, description: "One-hour session.", accepts_groups: false, is_active: true, currency: "GHS", negotiation_mode: "fixed", created_at: future(-2) }],
    booking_directory: [
      { id: "b1", service_id: "s1", provider_id: "p1", customer_id: "me", customer_name: "Ama Mensah", service_title: "Calculus and statistics tutoring", category: "Tutoring", agreed_price: 60, listed_price: 60, currency: "GHS", scheduled_at: future(2), status: "pending", duration_minutes: 60 },
      { id: "b2", service_id: "s2", provider_id: "p2", customer_id: "me", customer_name: "Ama Mensah", service_title: "Logo and poster design", category: "Design", agreed_price: 120, listed_price: 120, currency: "GHS", scheduled_at: future(4), status: "confirmed", duration_minutes: 90 },
      { id: "b3", service_id: "own1", provider_id: "me", customer_id: "c9", customer_name: "Kofi Annan", service_title: "Resume review and interview practice", category: "Writing", agreed_price: 70, listed_price: 70, currency: "GHS", scheduled_at: future(-3), status: "completed", duration_minutes: 60 },
    ],
    conversation_directory: [
      { conversation_id: "c1", other_user_id: "p1", other_user_name: "Kwame Asante" },
      { conversation_id: "c2", other_user_id: "p2", other_user_name: "Efua Boateng" },
    ],
    saved_services: [{ service_id: "s2" }, { service_id: "s4" }],
    student_identifiers: [{ student_id_number: "10987654" }],
  };
  const settle = (table, rows, mode) => {
    fake.calls.push(table);
    return new Promise(resolve => setTimeout(() => {
      if (fake.failing.has("all") || fake.failing.has(table)) {
        resolve({ data: null, error: { message: "Network request failed", code: "FAKE_FAILURE" } });
        return;
      }
      const list = fake.empty && table !== "profiles" ? [] : rows;
      resolve({ data: mode === "list" ? list : list[0] || null, error: null });
    }, fake.delay));
  };
  const query = (table, rows) => {
    let mode = "list", from = 0, to = Infinity;
    const builder = new Proxy({}, {
      get(_, key) {
        if (key === "then") return (resolve, reject) => settle(table, rows.slice(from, to === Infinity ? undefined : to + 1), mode).then(resolve, reject);
        if (key === "range") return (start, end) => { from = start; to = end; return builder; };
        if (key === "single" || key === "maybeSingle") return () => { mode = "one"; return builder; };
        return () => builder;
      },
    });
    return builder;
  };
  const session = { access_token: "fake", refresh_token: "fake", user: { id: "me", email: "ama@st.ug.edu.gh", app_metadata: { provider: "email" } } };
  const channel = { on() { return channel; }, subscribe(callback) { callback?.("SUBSCRIBED"); return channel; }, track: async () => "ok", presenceState: () => ({}), send: async () => "ok", unsubscribe: async () => "ok" };
  window.skillmateSupabase = {
    auth: { onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; }, getSession: async () => ({ data: { session }, error: null }), signOut: async () => ({ error: null }) },
    from: table => query(table, data[table] || []),
    rpc: name => query("rpc:" + name, []),
    channel: () => channel,
    removeChannel: async () => "ok",
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }), createSignedUrl: async () => ({ data: null, error: null }) }) },
  };
  window.syncSkillmateServerSession = async () => {};
  window.clearSkillmateServerSession = async () => {};
})();`;

function createServer() {
  return http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, "http://localhost").pathname.slice(1)) || "index.html";
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Security-Policy", serializePolicy(contentSecurityPolicy({ production: false })));
    if (name === "supabase-client.js") { res.setHeader("Content-Type", mime[".js"]); res.end(fakeClient); return; }
    if (name === "supabase-config.js") { res.setHeader("Content-Type", mime[".js"]); res.end("window.SKILLMATE_SUPABASE_CONFIG={url:'https://fake.supabase.test',anonKey:'fake'};"); return; }
    if (name.startsWith("assets/vendor/")) { res.setHeader("Content-Type", mime[".js"]); res.end(""); return; }
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep) || !mime[path.extname(file)] || !/^(assets[\\/]|[\w.-]+$)/.test(name) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.setHeader("Content-Type", mime[path.extname(file)]);
    res.end(fs.readFileSync(file));
  });
}

async function start() {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "skillmate-loading-"));
  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const executable = process.env.CHROME_PATH || [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium",
  ].find(file => fs.existsSync(file));
  if (!executable) throw new Error("Set CHROME_PATH to an installed Chrome or Chromium browser.");
  const chrome = spawn(executable, ["--headless", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${path.join(output, "browser")}`], { windowsHide: true, stdio: "ignore" });
  const portFile = path.join(output, "browser", "DevToolsActivePort");
  for (let i = 0; !fs.existsSync(portFile) && i < 150; i++) await wait(100);
  let port = "";
  for (let i = 0; !port && i < 50; i++) {
    try { port = fs.readFileSync(portFile, "utf8").split(/\r?\n/)[0]; } catch { await wait(100); }
  }
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  const pageErrors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") pageErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      clearTimeout(timer); pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    }
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 20000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  let themeScript = null;
  await call("Page.enable");
  await call("Runtime.enable");
  const harness = {
    base, output, evaluate, wait, pageErrors, call,
    async viewport(width, height = 900) {
      await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    },
    async emulate({ reducedMotion = false } = {}) {
      await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reducedMotion ? "reduce" : "no-preference" }] });
    },
    // theme.js reads this key before first paint, so it is set ahead of every document.
    async setTheme(theme) {
      if (themeScript) await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: themeScript });
      ({ identifier: themeScript } = await call("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("skillmate-theme",${JSON.stringify(theme)})}catch{}` }));
    },
    async open(route) {
      // A hash-only change would be a same-document navigation, so reset the page first.
      await call("Page.navigate", { url: "about:blank" });
      await wait(30);
      await call("Page.navigate", { url: `${base}/${route}` });
      for (let i = 0; i < 100; i++) {
        if (await evaluate("document.readyState !== 'loading'").catch(() => false)) break;
        await wait(20);
      }
    },
    async waitFor(expression, timeout = 8000) {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        if (await evaluate(expression).catch(() => false)) return true;
        await wait(25);
      }
      throw new Error(`Timed out waiting for: ${expression}`);
    },
    async screenshot(file) {
      const { data } = await call("Page.captureScreenshot", { format: "png" });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(data, "base64"));
      return file;
    },
    async close() {
      try { socket.close(); } catch { /* already closed */ }
      chrome.kill();
      server.close();
      await wait(300);
      try { fs.rmSync(output, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* Chrome may still hold profile files; the OS temp folder is cleaned later */ }
    },
  };
  return harness;
}

module.exports = { start, wait };
