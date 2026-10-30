// Runs the real frontend in Chrome with isolated local fixtures; never connects to Supabase.
// CHROME_PATH can override the installed browser. Screenshots are written to the OS temp folder.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "skillmate-mobile-"));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const authFixture = `<script>
window.__authCalls=[];
window.__signupCalls=[];
window.__verifyCalls=[];
window.__recoveryVerifyCalls=[];
window.skillmateRestoreSession=async()=>null;
window.syncSkillmateServerSession=async()=>{};
const originalAuthFetch=window.fetch.bind(window);
window.fetch=async(url,options)=>{
  if(url==="/api/auth/sign-up"){
    window.__signupCalls.push(JSON.parse(options.body));
    return new Response(JSON.stringify({message:"A six-digit verification code was sent to your email."}),{status:200,headers:{"content-type":"application/json"}});
  }
  if(url==="/api/auth/verify"){
    if(window.__recoveringPassword){
      window.__recoveryVerifyCalls.push(JSON.parse(options.body));
      return new Response(JSON.stringify({recovery:true}),{status:200,headers:{"content-type":"application/json"}});
    }
    window.__verifyCalls.push(JSON.parse(options.body));
    const invalid=window.__verifyCalls.length===1;
    return new Response(JSON.stringify(invalid?{error:"That code doesn’t match."}:{session:{access_token:"fixture-access-token",refresh_token:"fixture-refresh-token"}}),{status:invalid?400:200,headers:{"content-type":"application/json"}});
  }
  return originalAuthFetch(url,options);
};
window.skillmateSupabase={auth:{onAuthStateChange(){},signUp:async(args)=>{window.__authCalls.push(args);return {data:{session:null}};},setSession:async()=>({data:{session:{user:{id:"fixture",email:"student@example.test"}}}}),signInWithOAuth:async(args)=>{window.__authCalls.push(args);return {};}}};
</script>`;
const recoveryFixture = `<script>
window.__recoveringPassword=true;
window.__recoveryRequests=[];
window.__passwordUpdateRequests=[];
window.__recoveryVerifyCalls=[];
const recoveryOriginalFetch=window.fetch.bind(window);
window.fetch=async(url,options={})=>{
  if(url==="/api/auth/verify"){
    window.__recoveryVerifyCalls.push(JSON.parse(options.body));
    return new Response(JSON.stringify({recovery:true}),{status:200,headers:{"content-type":"application/json"}});
  }
  if(url==="/api/auth/password-recovery"&&options.method==="POST"){
    window.__recoveryRequests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({message:"If an account uses this email, a six-digit verification code has been sent."}),{status:200,headers:{"content-type":"application/json"}});
  }
  if(url==="/api/auth/password-recovery"&&options.method==="PUT"){
    window.__passwordUpdateRequests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({message:"Password updated"}),{status:200,headers:{"content-type":"application/json"}});
  }
  if(url==="/api/auth/resend")return new Response(JSON.stringify({message:"A new code was sent."}),{status:200,headers:{"content-type":"application/json"}});
  return recoveryOriginalFetch(url,options);
};
</script>`;
const onboardingFixture = `<script>
window.syncSkillmateServerSession=async()=>{};
window.skillmateSupabase={auth:{getSession:async()=>({data:{session:{user:{id:"fixture",email:"student@example.test",app_metadata:{provider:"google"},user_metadata:{full_name:"Test Student"}}}}})},
from(){return {select(){return this;},eq(){return this;},single:async()=>({data:{full_name:"Test Student",university:"",skills:[],avatar_url:"",onboarding_completed:false}}),update(data){sessionStorage.setItem("onboarding-fixture",JSON.stringify(data));return this;}};}};
</script>`;
const server = http.createServer((req, res) => {
  const name = new URL(req.url, "http://localhost").pathname.slice(1) || "index.html";
  if (!/^[\w-]+\.(html|css|js|svg)$/.test(name)) { res.writeHead(404).end(); return; }
  let content;
  try { content = fs.readFileSync(path.join(root, name), "utf8"); }
  catch { res.writeHead(404).end(); return; }
  if (name.endsWith(".html")) {
    content = content.replace(/<script[^>]*src="(?:https:[^"]+|supabase-config.js|supabase-client.js[^"]*)"[^>]*><\/script>/g, "");
    if (name === "login.html") content = content.replace('<script src="ghana-universities.js">', `${authFixture}<script src="ghana-universities.js">`);
    if (name === "forgot-password.html") content = content.replace('<script src="forgot-password.js?v=2">', `${recoveryFixture}<script src="forgot-password.js?v=2">`);
    if (name === "onboarding.html") content = content.replace('<script src="ghana-universities.js">', `${onboardingFixture}<script src="ghana-universities.js">`);
  }
  if (name === "user.js") content = content.replace("bootstrapStudentApp().catch((error) => {", `Promise.resolve().then(() => {
    state.profile.university = "University of Ghana";
    if (new URLSearchParams(location.search).has("new")) state.services = [];
    initializeDashboard(); loadAccountSettings(); showConnectedApp();
  }).catch((error) => {`);
  res.setHeader("Content-Type", name.endsWith(".css") ? "text/css" : name.endsWith(".js") ? "application/javascript" : name.endsWith(".svg") ? "image/svg+xml" : "text/html");
  res.end(content);
});

let chrome, socket;
async function main() {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const executable = process.env.CHROME_PATH || [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium",
  ].find(file => fs.existsSync(file));
  assert.ok(executable, "Set CHROME_PATH to an installed Chrome or Chromium browser.");
  chrome = spawn(executable, ["--headless", "--no-sandbox", "--disable-gpu", "--disable-software-rasterizer", "--in-process-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${path.join(output, "browser")}`], { windowsHide: true, stdio: "ignore" });
  const portFile = path.join(output, "browser", "DevToolsActivePort");
  for (let i = 0; !fs.existsSync(portFile) && i < 150; i++) await wait(100);
  assert.ok(fs.existsSync(portFile), "Chrome did not start its isolated debugging endpoint.");
  const port = fs.readFileSync(portFile, "utf8").split(/\r?\n/)[0];
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map(), errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      clearTimeout(timer); pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    }
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
  const navigate = async route => {
    await call("Page.navigate", { url: `${base}/${route}` });
    for (let i = 0; i < 100; i++) {
      const selector = route.startsWith("login") ? "#auth-submit" : route.startsWith("onboarding") ? "#onboarding-name" : "#marketplace-grid .provider-card";
      if (await evaluate(`document.readyState !== "loading" && !!document.querySelector(${JSON.stringify(selector)})`).catch(() => false)) break;
      await wait(50);
    }
    await wait(200);
  };
  const screenshot = async name => {
    await wait(200);
    const { data } = await call("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(output, `${name}.png`), Buffer.from(data, "base64"));
  };
  const checkWidth = async label => {
    const dimensions = await evaluate(`({viewport:innerWidth, document:document.documentElement.scrollWidth, body:document.body.scrollWidth})`);
    assert.ok(dimensions.document <= dimensions.viewport + 1 && dimensions.body <= dimensions.viewport + 1, `${label}: horizontal overflow ${JSON.stringify(dimensions)}`);
    const duplicates = await evaluate(`Array.from(document.querySelectorAll('[id]')).map(e=>e.id).filter((id,i,all)=>all.indexOf(id)!==i)`);
    assert.deepEqual(duplicates, [], `${label}: duplicate IDs`);
  };
  const verifyOtpFlow = async () => {
    await navigate("login.html?mode=signup"); await checkWidth("390:signup");
    assert.equal(await evaluate('document.querySelector("#apple-signin")'), null, "Apple sign-in has been removed");
    assert.equal(await evaluate('document.querySelector("#confirm-password-field").hidden'), true);
    await screenshot("signup-390");
    await evaluate('document.querySelector("#auth-name").value="Test Student";document.querySelector("#auth-university").value="University of Ghana";document.querySelector("#auth-email").value="student@example.test";document.querySelector("#auth-password").value="test-password-123";document.querySelector("#auth-consent").checked=true;document.querySelector("#auth-form").requestSubmit()');
    await wait(100);
    assert.equal(await evaluate('window.__signupCalls.length'), 1);
    assert.equal(await evaluate('"student_id_number" in window.__signupCalls[0]'), false);
    assert.equal(await evaluate('document.querySelector("#auth-otp").hidden'), false, "Signup immediately opens the OTP screen");
    assert.equal(await evaluate('document.querySelector("#otp-title").textContent'), "Verify your email");
    assert.equal(await evaluate('document.querySelectorAll(".auth-otp-inputs input").length'), 6, "Verification displays exactly six digit inputs");
    assert.equal(await evaluate('document.querySelector("#otp-submit").disabled'), true, "Verify remains disabled until six digits are entered");
    await checkWidth("390:otp");
    await call("Emulation.setDeviceMetricsOverride", { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
    await checkWidth("320:otp");
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const pasteCode = async code => evaluate(`(()=>{const clipboard=new DataTransfer();clipboard.setData("text",${JSON.stringify(code)});document.querySelector('.auth-otp-inputs input').dispatchEvent(new ClipboardEvent("paste",{clipboardData:clipboard,bubbles:true,cancelable:true}));return Array.from(document.querySelectorAll(".auth-otp-inputs input"),input=>input.value).join("")})()`);
    assert.equal(await pasteCode("12a3456"), "123456", "Pasting accepts and distributes only numeric OTP digits");
    const completeState = await evaluate('({disabled:document.querySelector("#otp-submit").disabled,values:Array.from(document.querySelectorAll(".auth-otp-inputs input"),input=>input.value)})');
    assert.equal(completeState.disabled, false, `Verify enables when all six digits are present: ${JSON.stringify(completeState)}`);
    await pasteCode("000000");
    await evaluate('document.querySelector("#otp-form").requestSubmit()');
    await wait(100);
    assert.equal(await evaluate('document.querySelector("#auth-otp").classList.contains("is-error")'), true, "A rejected code highlights and animates the OTP inputs");
    assert.equal(await evaluate('document.querySelector("#otp-message").textContent'), "That code doesn’t match.");
    assert.equal(await evaluate('document.querySelector("#otp-submit").disabled'), false, "A rejected code can be retried");
    await pasteCode("123456");
    await evaluate('document.querySelector("#otp-form").requestSubmit()');
    await wait(100);
    assert.equal(await evaluate('document.querySelector("#auth-otp").classList.contains("is-success")'), true, "A valid code shows the success state");
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".auth-otp-check")).display'), "block", "Success displays the animated checkmark");
    assert.equal(await evaluate('document.querySelector("#otp-submit .auth-submit-spinner").hidden'), true, "Success replaces the loading spinner");
    assert.deepEqual(await evaluate('window.__verifyCalls.map(call=>call.code)'), ["000000", "123456"]);
    let redirected = false;
    for (let attempt = 0; attempt < 15 && !redirected; attempt++) {
      await wait(100);
      redirected = await evaluate('location.pathname.endsWith("/index.html")');
    }
    assert.ok(redirected, "Successful verification redirects into the app");
  };
  const verifyPasswordRecoveryFlow = async () => {
    await navigate("forgot-password.html");
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await checkWidth("390:password-recovery");
    await evaluate('document.querySelector("#recovery-email").value="student@example.test";document.querySelector("#forgot-password-form").requestSubmit()');
    await wait(50);
    assert.equal(await evaluate('window.__recoveryRequests.length'), 1);
    assert.equal(await evaluate('window.__recoveryRequests[0].email'), "student@example.test");
    assert.equal(await evaluate('document.querySelectorAll(".recovery-otp-inputs input").length'), 6, "Password recovery uses six OTP inputs");
    assert.equal(await evaluate('document.querySelector("#recovery-verify").disabled'), true);
    const pasteRecoveryCode = async code => evaluate(`(()=>{const clipboard=new DataTransfer();clipboard.setData("text",${JSON.stringify(code)});document.querySelector('.recovery-otp-inputs input').dispatchEvent(new ClipboardEvent("paste",{clipboardData:clipboard,bubbles:true,cancelable:true}));return Array.from(document.querySelectorAll(".recovery-otp-inputs input"),input=>input.value).join("")})()`);
    assert.equal(await pasteRecoveryCode("654321"), "654321");
    assert.equal(await evaluate('document.querySelector("#recovery-verify").disabled'), false);
    await evaluate('document.querySelector("#recovery-code-form").requestSubmit()');
    await wait(400);
    assert.deepEqual(await evaluate('window.__recoveryVerifyCalls.map(call=>call.code)'), ["654321"]);
    assert.equal(await evaluate('document.querySelector("#new-password-form").hidden'), false, "Verified email advances to password selection");
    assert.equal(await evaluate('document.querySelector("#recovery-title").textContent'), "Set a new password");
    await evaluate('document.querySelector("#new-password").value="new-password-123";document.querySelector("#confirm-new-password").value="different-password";document.querySelector("#new-password-form").requestSubmit()');
    assert.equal(await evaluate('document.querySelector("#new-password-message").textContent'), "Your passwords do not match.");
    assert.equal(await evaluate('window.__passwordUpdateRequests.length'), 0, "Mismatched passwords are not sent");
    await evaluate('document.querySelector("#confirm-new-password").value="new-password-123";document.querySelector("#new-password-form").requestSubmit()');
    await wait(50);
    assert.deepEqual(await evaluate('window.__passwordUpdateRequests'), [{ password: "new-password-123" }]);
    assert.equal(await evaluate('document.querySelector("#new-password-message").classList.contains("success")'), true);
  };
  await call("Page.enable"); await call("Runtime.enable"); await call("Network.enable");
  await call("Page.bringToFront");
  await call("Network.setBlockedURLs", { urls: ["*supabase.co*", "*supabase.in*", "*fonts.googleapis.com*", "*fonts.gstatic.com*"] });
  if (process.argv.includes("--otp-only")) {
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await verifyOtpFlow();
    console.log("PASS six-digit OTP flow: six inputs, sanitized paste, disabled state, incorrect-code retry, success animation and redirect");
    return;
  }
  if (process.argv.includes("--recovery-only")) {
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await verifyPasswordRecoveryFlow();
    console.log("PASS password recovery: send code, verify six digits, reject mismatched passwords, and set a new password");
    return;
  }
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width <= 768 });
    await navigate("index.html");
    assert.equal(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length'), 6);
    await checkWidth(`${width}:discover`);
    if (width === 390 || width === 1440) await screenshot(`discover-${width}`);
    for (const page of ["bookings", "messages", "profile-settings", "provider", "earnings", "saved", "help-support"]) {
      await evaluate(`showPage(${JSON.stringify(page)})`);
      await checkWidth(`${width}:${page}`);
    }
    if (width === 390) {
      await evaluate('showPage("bookings");document.querySelector("[data-booking-direction=received]").click()');
      assert.equal(await evaluate('document.querySelectorAll("#user-booking-list .booking-card").length'), 3);
      await screenshot("bookings-390");
      await evaluate('showPage("messages")');
      assert.equal(await evaluate('document.querySelector("#messages-layout").hasAttribute("data-chat-open")'), false, "Messages opens with the conversation list, not an active chat");
      assert.equal(await evaluate('document.querySelector(".chat-panel-empty") !== null'), true, "No chat opens until the user selects one");
      await evaluate('document.querySelector(".conversation-item").click()');
      assert.equal(await evaluate('document.querySelector("#messages-layout").getAttribute("data-chat-open")'), "true", "Selecting a conversation opens its chat");
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".mobile-nav")).display'), "none");
      await checkWidth("390:open-chat"); await screenshot("chat-390");
      await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 430, deviceScaleFactor: 1, mobile: true });
      await wait(100);
      assert.ok(await evaluate('document.querySelector(".chat-compose").getBoundingClientRect().bottom <= innerHeight + 1'), "Chat input stays above the viewport edge when the available height shrinks");
      await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
      await evaluate('document.querySelector("[data-chat-back]").click()');
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".mobile-nav")).display'), "grid");
    }
    console.log(`PASS layouts: ${width}px`);
  }
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate("index.html");
  await evaluate('showPage("profile-settings")');
  assert.notEqual(await evaluate('getComputedStyle(document.querySelector("#mode-switch-label")).display'), "none", "Seller action label must be visible on phones");
  await screenshot("profile-390");
  await evaluate('document.querySelector(".profile-completeness-action").click()');
  assert.equal(await evaluate('document.querySelector("#profile-modal").open'), true, "Add details opens the editor");
  assert.equal(await evaluate('document.querySelector("#profile-university").value'), "University of Ghana");
  assert.equal(await evaluate('document.querySelector("#profile-student-id").required'), false);
  await evaluate('document.querySelector("#profile-modal").close();showPage("provider");document.querySelector("#view-provider [data-open=profile-modal]").click();document.querySelector("#profile-bio").value="Updated bio from the profile editor";document.querySelector("#profile-form").requestSubmit()');
  assert.equal(await evaluate('state.profile.university'), "University of Ghana", "Bio edits must preserve the saved campus");
  assert.equal(await evaluate('state.profile.bio'), "Updated bio from the profile editor");
  await evaluate('showPage("home");globalSearch.focus();globalSearch.value="braids";globalSearch.dispatchEvent(new Event("input"));globalSearch.blur();globalSearch.focus()');
  await wait(30);
  assert.equal(await evaluate('document.body.classList.contains("search-open")'), true, "Rapid refocus must keep suggestions open");
  assert.ok(await evaluate('document.querySelectorAll("[data-search-suggestion]").length>0'));
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  assert.equal(await evaluate('globalSearch.value'), "", "First Escape clears the query");
  assert.equal(await evaluate('document.activeElement===globalSearch'), true, "Clearing the query retains focus");
  await evaluate('globalSearch.blur()');
  await wait(20);
  await evaluate('document.querySelector(".more-categories").click();document.querySelector("#all-categories [data-category=Photography]").click()');
  assert.equal(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length'), 0);
  await evaluate('document.querySelector("[data-clear-search]").click();globalSearch.value="braids";globalSearch.dispatchEvent(new Event("input"))');
  await wait(350);
  assert.ok(await evaluate('!!document.querySelector("#marketplace-grid [data-book=akosua]")'));
  await evaluate('document.querySelector("#marketplace-grid [data-book=akosua]").click()');
  assert.equal(await evaluate('document.querySelector("#booking-price").textContent'), "GH₵ 120");
  assert.equal(await evaluate('document.querySelector("#booking-time").type'), "time");
  await checkWidth("390:booking-dialog"); await screenshot("booking-request-390");
  await evaluate('document.querySelector("#booking-time").value="13:15";document.querySelector("#booking-form").requestSubmit()');
  assert.equal(await evaluate('state.bookings[0].status'), "Pending");
  assert.equal(await evaluate('state.activePage'), "bookings");
  await evaluate('showPage("profile-settings");document.querySelector("[data-theme-toggle]").click();showPage("home")');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), "dark");
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".mobile-nav")).display'), "grid");
  assert.ok(await evaluate('document.querySelector(".mobile-nav").getBoundingClientRect().bottom <= innerHeight + 1'), "Navigation stays on screen after switching theme");
  assert.ok(await evaluate('!!document.elementFromPoint(45,innerHeight-25).closest(".mobile-nav")'), "Toasts must not cover the navigation");
  await screenshot("discover-dark-390");
  await evaluate('globalSearch.value="";renderMarketplace();openProviderProfile("akosua")');
  await checkWidth("390:provider-details");
  await evaluate('document.querySelector("[data-group-provider=akosua]").click()');
  assert.equal(await evaluate('document.querySelector("#groups-modal").open'), true);
  assert.ok(await evaluate('Array.from(document.querySelectorAll("#group-grid .group-card h3")).every(e=>e.textContent.includes("Braids"))'));
  await evaluate('showPage("messages")');
  assert.equal(await evaluate('document.querySelectorAll("dialog[open]").length'), 0, "Changing pages closes stacked group dialogs");
  await evaluate('showPage("home");globalSearch.value="";selectedCategory="All";window.__originalProviderServices=providerServices;window.__testServices=[{id:"audit-tech",providerId:"daniel",title:"Audit laptop repair",category:"Tech help",description:"Laptop repair",price:50,active:true},{id:"audit-math",providerId:"daniel",title:"Audit calculus tutoring",category:"Tutoring",description:"Calculus help",price:40,active:true}];providerServices=id=>id==="daniel"?window.__testServices:window.__originalProviderServices(id);renderMarketplace("marketplace-grid",window.skillmateMarketplace.expandListings([seedProviders[0]],window.__testServices))');
  assert.equal(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length'), 2);
  await evaluate('document.querySelector("#marketplace-grid [data-book=daniel][data-service=audit-math]").click()');
  assert.equal(await evaluate('document.querySelector("#booking-service").value'), "audit-math", "Book the selected service rather than the provider's first service");
  assert.ok(await evaluate('document.querySelector("#booking-price").textContent.includes("40")'));
  await evaluate('providerServices=window.__originalProviderServices;document.querySelector("#booking-modal").close()');
  await navigate("index.html?new=1");
  assert.equal(await evaluate('document.querySelector(".side-nav [data-page=provider]").hidden'), true);
  await evaluate('showPage("profile-settings");document.querySelector("#mode-switch").click()');
  assert.equal(await evaluate('document.querySelector("#service-modal").open'), true);
  await checkWidth("390:create-service"); await screenshot("add-service-390");
  await evaluate('document.querySelector("#service-title").value="Campus design help";document.querySelector("#service-description").value="A custom poster with two revisions included.";document.querySelector("#service-price").value="50";document.querySelector("#service-delivery").value="online";document.querySelector("#service-form").requestSubmit()');
  assert.equal(await evaluate('document.querySelector("#service-review").hidden'), false);
  await evaluate('document.querySelector("#service-form").requestSubmit()'); await wait(200);
  assert.equal(await evaluate('state.services.length'), 1);
  assert.equal(await evaluate('document.querySelector(".side-nav [data-page=provider]").hidden'), false);
  await verifyOtpFlow();
  await navigate("login.html");
  assert.equal(await evaluate('document.querySelectorAll(".auth-social-buttons button").length'), 1);
  await evaluate('document.querySelector("#google-signin").click()');
  assert.equal(await evaluate('document.querySelector("#consent-field").hidden'), false);
  assert.equal(await evaluate('window.__authCalls.length'), 0);
  await evaluate('document.querySelector("#auth-consent").checked=true;document.querySelector("#google-signin").click()');
  assert.equal(await evaluate('window.__authCalls[0].provider'), "google");
  await navigate("onboarding.html"); await checkWidth("390:onboarding");
  assert.equal(await evaluate('document.querySelector("#onboarding-name").value'), "Test Student");
  assert.equal(await evaluate('document.querySelector(".onboarding-extras").open'), false);
  await screenshot("onboarding-390");
  await evaluate('document.querySelector("#onboarding-campus").value="University of Ghana";document.querySelector("#onboarding-form").requestSubmit()');
  await wait(150);
  assert.equal(await evaluate('JSON.parse(sessionStorage.getItem("onboarding-fixture")).onboarding_completed'), true);
  assert.equal(await evaluate('JSON.parse(sessionStorage.getItem("onboarding-fixture")).university'), "University of Ghana");
  await verifyPasswordRecoveryFlow();
  assert.deepEqual(errors, [], "Uncaught browser errors");
  console.log("PASS interactions: profile editing, student details, mobile seller label, search refocus, service selection, categories, booking, chat, theme, first listing, Google-only signup");
  console.log(`Screenshots: ${output}`);
  await call("Browser.close").catch(() => {});
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  socket?.close(); chrome?.kill(); server.close();
});
