// Runs only local assets in an isolated browser; never signs in or writes live data.
// Usage: node tests/browser-landing-smoke.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { app } = require("../server");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "skillflex-landing-"));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let server, chrome, socket;

async function main() {
  server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const executable = process.env.CHROME_PATH || [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium",
  ].find(file => fs.existsSync(file));
  assert.ok(executable, "Set CHROME_PATH to an installed Chromium browser.");
  chrome = spawn(executable, ["--headless", "--no-sandbox", "--disable-gpu", "--disable-software-rasterizer", "--in-process-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${path.join(output, "browser")}`], { windowsHide: true, stdio: "ignore" });
  const portFile = path.join(output, "browser", "DevToolsActivePort");
  for (let i = 0; !fs.existsSync(portFile) && i < 150; i++) await wait(100);
  assert.ok(fs.existsSync(portFile), "Isolated Chrome did not start.");
  const port = fs.readFileSync(portFile, "utf8").split(/\r?\n/)[0];
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map(), errors = [], requests = [], badResponses = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === "Network.requestWillBeSent") requests.push(message.params.request.url);
    if (message.method === "Network.responseReceived" && message.params.response.status >= 400 && !message.params.response.url.endsWith("/favicon.ico")) badResponses.push(message.params.response.url);
    if (!pending.has(message.id)) return;
    const { resolve, reject, timer } = pending.get(message.id);
    clearTimeout(timer); pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const key = async (key, code, windowsVirtualKeyCode) => {
    await call("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode, ...(key === "Enter" ? { text: "\r" } : key === " " ? { text: " " } : {}) });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode });
  };
  const navigate = async () => {
    await call("Page.navigate", { url: base + "/" });
    for (let i = 0; i < 100; i++) {
      if (await evaluate('document.readyState === "complete" && !!document.querySelector("#hero-title")').catch(() => false)) return;
      await wait(50);
    }
    throw new Error("Homepage did not load");
  };
  const screenshot = async (name, full = false) => {
    const dimensions = await evaluate('({width:innerWidth,height:document.documentElement.scrollHeight})');
    const result = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: full, ...(full ? { clip: { x: 0, y: 0, width: dimensions.width, height: dimensions.height, scale: 1 } } : {}) });
    fs.writeFileSync(path.join(output, name + ".png"), Buffer.from(result.data, "base64"));
  };
  await call("Page.enable"); await call("Runtime.enable"); await call("Network.enable");
  if (process.argv.includes("--access-audit")) {
    await require("./public-access-checks.cjs")({ base, call, evaluate, screenshot, wait });
    assert.deepEqual(errors, [], "No browser exceptions during public/access checks");
    console.log(`Screenshots: ${output}`);
    return;
  }
  for (const width of [1440, 1024, 768, 390, 320]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await navigate();
    await evaluate('document.fonts.ready.then(() => true)');
    await wait(100);
    for (let i = 0; i < 60 && !await evaluate('!!document.querySelector(".hero-illustration[data-ready]")'); i++) await wait(50);
    assert.equal(await evaluate('!!document.querySelector(".hero-illustration[data-ready]")'), true, "Prominent Storyset hero loads immediately");
    assert.equal(await evaluate('document.querySelectorAll(".storyset-credit").length'), 1, "One Storyset credit remains in the footer");
    assert.equal(await evaluate('document.querySelector(".hero-illustration").shadowRoot.querySelector(".credit")'), null, "No label beneath the hero illustration");
    const artwork = await evaluate('(()=>{const r=document.querySelector(".hero-illustration").getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:innerHeight};})()');
    assert.ok(artwork.width >= 200 && artwork.top < artwork.height - 100, `Hero artwork is visible on arrival: ${JSON.stringify(artwork)}`);
    if (width > 800) assert.ok(artwork.bottom <= artwork.height, "Desktop illustration fits the first viewport");
    assert.equal(await evaluate(`Array.from(document.fonts).some(f => f.family === "Plus Jakarta Sans" && f.status === "loaded") && [400,500,600,700,800].every(w => document.fonts.check(w + ' 14px "Plus Jakarta Sans"'))`), true, "Plus Jakarta Sans loads locally at all requested weights");
    assert.equal(await evaluate('location.pathname'), "/");
    const dimensions = await evaluate('({viewport:innerWidth,width:document.documentElement.scrollWidth})');
    assert.ok(dimensions.width <= width + 1, `${width}px: overflow ${JSON.stringify(dimensions)}`);
    assert.equal(await evaluate('document.querySelectorAll("h1").length'), 1);
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("main > section")).map(e=>e.getAttribute("aria-labelledby"))'), ["hero-title", "problem-title", "solution-title", "community-title", "faq-title", "cta-title"]);
    assert.equal(await evaluate('document.querySelectorAll(".faq-list details").length'), 5);
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[id]")).map(e=>e.id).filter((id,i,a)=>a.indexOf(id)!==i)'), []);
    const missingAnchors = await evaluate('Array.from(document.querySelectorAll(\'a[href^="#"]\')).filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.href)');
    assert.deepEqual(missingAnchors, []);
    const stepLayout = await evaluate(`Array.from(document.querySelectorAll('.step')).map(step => {
      const visual = step.querySelector('.step-visual').getBoundingClientRect();
      const copy = step.querySelector('.step-copy').getBoundingClientRect();
      return {visualX:visual.x,copyX:copy.x,visualY:visual.y,copyBottom:copy.bottom};
    })`);
    if (width > 560) {
      assert.ok(stepLayout[0].visualX < stepLayout[0].copyX && stepLayout[1].visualX > stepLayout[1].copyX && stepLayout[2].visualX < stepLayout[2].copyX, "Desktop steps alternate illustrations and copy");
    } else {
      assert.ok(stepLayout.every(step => step.visualY >= step.copyBottom), "Mobile steps place copy above the illustration without overlap");
      assert.ok(await evaluate('Array.from(document.querySelectorAll(".hero-actions .button, .menu-toggle, .cta .button")).every(e=>e.getBoundingClientRect().height>=44)'), "Primary mobile controls have 44px tap targets");
    }
    if (width === 1440 || width === 390 || width === 320) await screenshot(`hero-${width}`);
    // Scroll through the real page so every reveal is exercised before the full capture.
    await evaluate('document.documentElement.style.scrollBehavior="auto"');
    const height = await evaluate('document.documentElement.scrollHeight');
    for (let y = 0; y < height; y += 650) { await evaluate(`scrollTo(0,${y})`); await wait(400); }
    await wait(550);
    assert.equal(await evaluate('document.querySelectorAll(".reveal-pending").length'), 0, `${width}px: all sections reveal`);
    await evaluate('scrollTo(0,0)');
    if (width === 1440 || width === 390) await screenshot(`full-${width}`, true);
    console.log(`PASS layout, section order, anchors and scroll reveals: ${width}px`);
  }
  // Real keyboard input verifies native accordion semantics, not only programmatic clicks.
  await evaluate('document.querySelector(".faq-list summary").focus()');
  await key("Enter", "Enter", 13); await wait(50);
  assert.equal(await evaluate('document.querySelector(".faq-list details").open'), true);
  await key("Tab", "Tab", 9); await key(" ", "Space", 32); await wait(80);
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".faq-list details")).map(e=>e.open)'), [false, true, false, false, false]);
  await evaluate('document.querySelector(".menu-toggle").focus()');
  await key("Enter", "Enter", 13);
  assert.equal(await evaluate('document.querySelector(".menu-toggle").getAttribute("aria-expanded")'), "true");
  await key("Tab", "Tab", 9);
  assert.equal(await evaluate('document.activeElement.getAttribute("href")'), "#how-it-works");
  await key("Escape", "Escape", 27);
  assert.equal(await evaluate('document.querySelector(".menu-toggle").getAttribute("aria-expanded")'), "false");
  assert.equal(await evaluate('document.activeElement.className'), "menu-toggle");
  await key("Enter", "Enter", 13);
  await evaluate('document.querySelector(\'.main-nav a[href="#faqs"]\').click()');
  assert.equal(await evaluate('location.hash'), "#faqs");
  assert.equal(await evaluate('document.querySelector(".menu-toggle").getAttribute("aria-expanded")'), "false");
  const links = await evaluate('Array.from(document.querySelectorAll("a")).map(a=>a.getAttribute("href")).filter(h=>h.startsWith("/")).filter((h,i,a)=>a.indexOf(h)===i)');
  for (const link of links) {
    const response = await fetch(base + link, { redirect: "manual" });
    assert.equal(response.status, 200, `Destination exists: ${link}`);
  }
  assert.equal(await evaluate('document.querySelector(".hero-actions a").getAttribute("href")'), "/index.html#home");
  assert.equal(await evaluate('document.querySelector(".cta .button").getAttribute("href")'), "/login.html?mode=signup");
  console.log("PASS keyboard FAQs, mobile menu, Escape/focus, links and existing signup destination");
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await navigate();
  assert.equal(await evaluate('document.querySelectorAll(".reveal-pending").length'), 0);
  assert.equal(await evaluate('getComputedStyle(document.documentElement).scrollBehavior'), "auto");
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".button")).transitionDuration'), "0s");
  console.log("PASS reduced motion: no reveal, scroll or hover animation");
  await call("Emulation.setScriptExecutionDisabled", { value: true });
  await call("Page.navigate", { url: base + "/" }); await wait(500);
  // Runtime evaluation still works when page scripts are disabled.
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".main-nav")).display'), "flex");
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".section-heading")).opacity'), "1");
  await evaluate('document.querySelector(".faq-list summary").focus()'); await key("Enter", "Enter", 13);
  assert.equal(await evaluate('document.querySelector(".faq-list details").open'), true);
  console.log("PASS no-JavaScript fallback: navigation, content and native FAQs remain usable");
  assert.deepEqual(errors, [], "Uncaught browser errors");
  assert.deepEqual(badResponses, [], "Failed homepage assets");
  assert.ok(requests.every(url => url.startsWith(base + "/")), "Homepage makes no third-party requests");
  assert.ok(!requests.some(url => url.includes("/api/") || url.includes("supabase")), "Homepage is independent of authentication and backend");
  console.log(`Screenshots: ${output}`);
  await call("Browser.close").catch(() => {});
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  socket?.close(); chrome?.kill(); server?.close();
});
