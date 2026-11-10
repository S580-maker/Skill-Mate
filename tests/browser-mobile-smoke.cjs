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
window.__googleOtpCalls=[];
window.__googleSignOutCalls=0;
window.__serverSessionSyncCalls=0;
window.__setSessionCalls=0;
window.skillmateRestoreSession=async()=>null;
window.syncSkillmateServerSession=async()=>{window.__serverSessionSyncCalls++;};
const originalAuthFetch=window.fetch.bind(window);
window.fetch=async(url,options)=>{
  if(url==="/api/auth/google-2fa"){
    window.__googleOtpCalls.push({body:JSON.parse(options.body),authorization:options.headers.authorization});
    return new Response(JSON.stringify({email:"student@example.test"}),{status:200,headers:{"content-type":"application/json"}});
  }
  if(url==="/api/auth/sign-up"){
    window.__signupCalls.push(JSON.parse(options.body));
    return new Response(JSON.stringify({message:"A six-digit verification code was sent to your email."}),{status:200,headers:{"content-type":"application/json"}});
  }
  if(url==="/api/auth/verify"){
    await new Promise(resolve=>setTimeout(resolve,500));
    if(window.sessionStorage.getItem("skillmate-google-otp-active")==="1"){
      window.__verifyCalls.push(JSON.parse(options.body));
      return new Response(JSON.stringify({provider:"google",session:{access_token:"verified-google-access",refresh_token:"verified-google-refresh"}}),{status:200,headers:{"content-type":"application/json"}});
    }
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
window.skillmateSupabase={auth:{onAuthStateChange(){},signUp:async(args)=>{window.__authCalls.push(args);return {data:{session:null}};},getSession:async()=>window.__googleSessionMissing?({data:{session:null},error:{message:"Auth session missing!"}}):({data:{session:{access_token:"google-access",refresh_token:"google-refresh",user:{id:"fixture",email:"student@example.test"}}},error:null}),setSession:async()=>{window.__setSessionCalls++;return {data:{session:{access_token:"verified-google-access",refresh_token:"verified-google-refresh",user:{id:"fixture",email:"student@example.test"}}},error:null};},signOut:async()=>{window.__googleSignOutCalls++;return {error:null};},signInWithOAuth:async(args)=>{window.__authCalls.push(args);return {};}}};
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
  if (/^assets\/illustrations\/storyset\/[a-z-]+\.(svg|html)$/.test(name)) {
    try {
      res.setHeader("Content-Type", name.endsWith(".svg") ? "image/svg+xml" : "text/html");
      res.end(fs.readFileSync(path.join(root, name)));
    } catch { res.writeHead(404).end(); }
    return;
  }
  if (/^assets\/fonts\/[\w-]+\.woff2$/.test(name)) {
    try { res.setHeader("Content-Type", "font/woff2"); res.end(fs.readFileSync(path.join(root, name))); }
    catch { res.writeHead(404).end(); }
    return;
  }
  if (/^assets\/[\w-]+\.png$/.test(name)) {
    try {
      res.setHeader("Content-Type", "image/png");
      res.end(fs.readFileSync(path.join(root, name)));
    } catch { res.writeHead(404).end(); }
    return;
  }
  if (!/^[\w-]+\.(html|css|js|svg)$/.test(name)) { res.writeHead(404).end(); return; }
  let content;
  try { content = fs.readFileSync(path.join(root, name), "utf8"); }
  catch { res.writeHead(404).end(); return; }
  if (name.endsWith(".html")) {
    content = content.replace(/<script[^>]*src="(?:https:[^"]+|\/assets\/vendor\/supabase-js-[^"]+|supabase-config.js|supabase-client.js[^"]*)"[^>]*><\/script>/g, "");
    if (name === "login.html") content = content.replace('<script src="ghana-universities.js">', `${authFixture}<script src="ghana-universities.js">`);
    if (name === "forgot-password.html") content = content.replace(/(<script src="forgot-password\.js[^"]*">)/, `${recoveryFixture}$1`);
    if (name === "onboarding.html") content = content.replace('<script src="ghana-universities.js">', `${onboardingFixture}<script src="ghana-universities.js">`);
  }
  if (name === "user.js") {
    content = content.replace("const appSupabase = window.skillmateSupabase;", "let appSupabase = window.skillmateSupabase;");
    content = content.replace("function syncMessageChannels() {", "function syncMessageChannels() { if (window.__testDisableRealtime) return;");
    content = content.replace("bootstrapStudentApp().then(() => window.clearTimeout(startupStuckTimer), (error) => {", `Promise.resolve().then(() => {
    state.profile.university = "University of Ghana";
    if (new URLSearchParams(location.search).has("new")) state.services = [];
    initializeDashboard(); loadAccountSettings(); showConnectedApp();
  }).then(() => window.clearTimeout(startupStuckTimer), (error) => {`);
  }
  if (name === "illustrations.js" && process.argv.includes("--illustrations-only")) {
    // Exercise the documented official-export configuration without shipping test artwork.
    content = content.replace('search: { slug:', 'search: { animatedFile: new URLSearchParams(location.search).has("export-test") ? "search.html" : null, slug:');
  }
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
    assert.equal(await evaluate('document.querySelectorAll(".brand-logo").length'), 0, `${label}: brand logos are removed`);
    assert.equal(await evaluate('document.querySelector(".brand-name")?.textContent'), "Skillmate", `${label}: text brand remains visible`);
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
    assert.equal(await pasteCode("00a0000"), "000000", "Pasting accepts and distributes only numeric OTP digits");
    await evaluate('document.querySelector("#otp-form").requestSubmit()');
    await screenshot("otp-verifying-390");
    await wait(350);
    assert.equal(await evaluate('document.querySelector("#auth-otp").classList.contains("is-error")'), true, "A rejected code highlights and animates the OTP inputs");
    assert.equal(await evaluate('document.querySelector("#otp-message").textContent'), "That code doesn’t match.");
    assert.equal(await evaluate('document.querySelector("#otp-submit").disabled'), true, "A rejected code clears the digits for a fresh retry");
    await evaluate('document.querySelectorAll(".auth-otp-inputs input").forEach((input,index)=>{input.value=String(index+1);input.dispatchEvent(new Event("input",{bubbles:true}));})');
    await evaluate('document.querySelector("#otp-form").requestSubmit()');
    await wait(550);
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
  const verifyGoogleOtpFlow = async () => {
    await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await navigate("login.html");
    await checkWidth("390:google-signin");
    await evaluate('document.querySelector("#auth-consent").checked=true;document.querySelector("#google-signin").click()');
    assert.equal(await evaluate('window.__authCalls[0].provider'), "google");
    assert.equal(await evaluate('new URL(window.__authCalls[0].options.redirectTo).pathname.endsWith("/login.html")'), true);
    assert.equal(await evaluate('new URL(window.__authCalls[0].options.redirectTo).searchParams.get("skillmate-google-otp")'), "1", "OAuth callback preserves the Google verification flow");
    await evaluate('redirectForSession({access_token:"google-access",refresh_token:"google-refresh",expires_in:3600})');
    await wait(100);
    assert.equal(await evaluate('window.__googleOtpCalls.length'), 1);
    assert.equal(await evaluate('window.__googleOtpCalls[0].authorization'), "Bearer google-access");
    assert.equal(await evaluate('document.querySelector("#auth-otp").hidden'), false);
    assert.equal(await evaluate('document.querySelectorAll(".auth-otp-inputs input").length'), 6);
    await evaluate('window.__googleSessionMissing=true');
    await evaluate('(()=>{const clipboard=new DataTransfer();clipboard.setData("text","246810");document.querySelector(".auth-otp-inputs input").dispatchEvent(new ClipboardEvent("paste",{clipboardData:clipboard,bubbles:true,cancelable:true}));document.querySelector("#otp-form").requestSubmit()})()');
    await wait(550);
    assert.deepEqual(await evaluate('window.__verifyCalls.map(call=>call.code)'), ["246810"]);
    assert.equal(await evaluate('window.__serverSessionSyncCalls'), 1, "Successful OTP reuses and syncs the preserved Google session");
    assert.equal(await evaluate('window.__setSessionCalls'), 1, "Missing local auth state is restored from the server-verified session");
    assert.equal(await evaluate('window.__googleSignOutCalls'), 0, "Google session is not cleared before the OTP is verified");
    assert.equal(await evaluate('sessionStorage.getItem("skillmate-google-otp-active")'), null);
    await wait(600);
    assert.equal(await evaluate('location.pathname.endsWith("/index.html")'), true, "Verified Google user enters the app");
    await call("Emulation.setEmulatedMedia", { features: [] });
  };
  const verifyGrowthFlow = async () => {
    await navigate("index.html");
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate('!!window.skillmateGrowth'), true);
    assert.equal(await evaluate('document.querySelector("#marketplace-filters").hidden'), true, "Marketplace filters start collapsed");
    const categoryControls = await evaluate(`(()=>{const row=document.querySelector(".marketplace-category-controls");const button=document.querySelector("#marketplace-filter-trigger");const box=button.getBoundingClientRect();return{first:row.firstElementChild===button,next:button.nextElementSibling.id,width:box.width,height:box.height,text:button.textContent.trim(),label:button.getAttribute("aria-label")};})()`);
    assert.equal(categoryControls.first, true, "Icon-only filter control is first in the service category row");
    assert.equal(categoryControls.next, "category-strip", "Service categories follow the filter button");
    assert.ok(categoryControls.width <= 44 && categoryControls.height <= 44, "Filter control stays compact");
    assert.equal(categoryControls.text, "", "Filter control has no visible text label");
    assert.equal(categoryControls.label, "Show service filters", "Filter control remains accessible");
    await evaluate('document.querySelector("#marketplace-filter-trigger").click()');
    assert.equal(await evaluate('document.querySelector("#marketplace-filters").hidden'), false, "Filter button reveals marketplace filters");
    await evaluate('document.querySelector("#marketplace-filter-trigger").click()');
    assert.equal(await evaluate('document.querySelector("#marketplace-filters").hidden'), true, "Filter button hides marketplace filters");
    await evaluate('showPage("home");const filters=document.querySelector("#marketplace-filters");filters.elements.min.value="60";filters.elements.max.value="100";filters.dispatchEvent(new Event("input",{bubbles:true}))');
    assert.equal(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length'), 2, "Budget filters combine");
    await evaluate('document.querySelector("#marketplace-filters").elements.verified.checked=true;document.querySelector("#marketplace-filters").dispatchEvent(new Event("input",{bubbles:true}))');
    assert.equal(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length'), 0, "Unverified providers are excluded");
    await evaluate('document.querySelector("#marketplace-filters").reset()'); await wait(50);
    assert.equal(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length'), 6);
    await screenshot("growth-filters-390"); await checkWidth("390:growth-filters");
    await evaluate('showPage("bookings");renderAll();document.querySelector("[data-dismiss-reviews]").click();renderAll()');
    assert.equal(await evaluate('document.querySelector("#required-review-reminder").hidden'), true, "Review reminders can be dismissed");
    await evaluate('document.querySelector("[data-rebook]").click()');
    assert.equal(await evaluate('document.querySelector("#booking-modal").open'), true, "Book again works with an outstanding review");
    assert.equal(await evaluate('document.querySelector("#booking-negotiation-id").value'), "", "Repeat bookings do not reuse a stale negotiated price");
    await evaluate('document.querySelector("#booking-modal").close();showPage("provider");appUser={id:"daniel"}');
    assert.equal(await evaluate('Boolean(document.querySelector("#view-provider #growth-metrics"))'), false, "Detailed booking stats are removed from My services");
    await evaluate('showPage("earnings")');
    assert.equal(await evaluate('Boolean(document.querySelector(".booking-insights"))'), false, "Booking insights are not hidden in a disclosure");
    assert.equal(await evaluate('document.querySelectorAll("#growth-metrics article").length'), 4, "Booking insights are visible on Estimated earnings");
    assert.ok(await evaluate('(document.querySelector("#growth-metrics").compareDocumentPosition(document.querySelector("#earnings-total")) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0'), "Booking insights appear above estimated earnings");
    await evaluate('showPage("provider")');
    assert.equal(await evaluate('document.querySelector("#availability-settings").open'), false, "Availability is collapsed by default");
    await evaluate('document.querySelector("#availability-settings > summary").click()');
    assert.equal(await evaluate('document.querySelector("#availability-settings").open'), true, "Availability can be expanded");
    await evaluate('document.querySelector("#availability-settings > summary").click()');
    assert.equal(await evaluate('document.querySelector("#availability-settings").open'), false, "Availability can be collapsed again");
    assert.equal(await evaluate('document.querySelectorAll("#availability-week .availability-row").length'), 7, "Weekly hours show one row per day");
    assert.ok(await evaluate('Array.from(document.querySelectorAll("#availability-week .availability-row")).every(row=>row.querySelector(".availability-time-range").hidden&&Array.from(row.querySelectorAll(".availability-time-range input")).every(input=>input.disabled&&!input.required))'), "Unchecked days hide and disable their time fields");
    await evaluate('document.querySelector("#availability-enabled").checked=true;document.querySelector("#availability-timezone").value="Africa/Accra";document.querySelectorAll("[data-hours-day]").forEach(row=>{const check=row.querySelector("[type=checkbox]");check.checked=true;check.dispatchEvent(new Event("change",{bubbles:true}));row.querySelector("[id^=hours-start]").value="09:00";row.querySelector("[id^=hours-end]").value="12:00"});document.querySelector("#availability-form").requestSubmit()');
    await wait(50);
    assert.ok(await evaluate('document.querySelector("#availability-feedback").textContent.includes("published")'));
    await checkWidth("390:availability"); await screenshot("growth-availability-390");
    await evaluate('appUser=null;openBooking("daniel","daniel-service")'); await wait(50);
    assert.equal(await evaluate('document.querySelector("#booking-slot-label").hidden'), false);
    assert.equal(await evaluate('document.querySelector("#booking-slot").options.length'), 4, "Three actual slots are available");
    await evaluate('document.querySelector("#booking-slot").selectedIndex=1;window.__bookedSlot=document.querySelector("#booking-slot").value;document.querySelector("#booking-location-type").selectedIndex=1;document.querySelector("#booking-location-type").dispatchEvent(new Event("change",{bubbles:true}));document.querySelector("#booking-confirm-details").checked=true;document.querySelector("#booking-form").requestSubmit()');
    assert.equal(await evaluate('state.bookings[0].scheduledAt'), await evaluate('window.__bookedSlot'));
    await evaluate('state.bookings[0].status="Confirmed";openBooking("daniel","daniel-service")'); await wait(50);
    assert.equal(await evaluate('Array.from(document.querySelector("#booking-slot").options).some(option=>option.value===window.__bookedSlot)'), false, "Confirmed work removes its slot");
    await evaluate('document.querySelector("#booking-modal").close();showPage("provider");renderAll()');
    assert.equal(await evaluate('Boolean(document.querySelector("#provider-booking-list"))'), false, "Provider bookings are not duplicated on My services");
    await evaluate('showPage("bookings");document.querySelector("[data-booking-direction=received]").click();document.querySelector("#user-booking-list [data-decision^=In]").click()');
    assert.ok(await evaluate('state.bookings.some(booking=>isOwnBooking(booking)&&booking.status==="In progress")'));
    assert.ok(await evaluate('Array.from(document.querySelectorAll("#user-booking-list [aria-current=step]")).some(item=>item.textContent==="In progress")'));
    await evaluate('showPage("home");document.querySelector(".request-board-entry button").click()');
    assert.equal(await evaluate('document.querySelector("#request-post-modal").open'), true, "The home banner opens the posting form directly");
    await checkWidth("390:request-post-form"); await screenshot("growth-post-form-390");
    await evaluate('document.querySelector("#request-title").value="Poster for our campus event";document.querySelector("#request-description").value="We need a clear event poster with two revisions. <img src=x onerror=alert(1)>";document.querySelector("#request-budget").value="80";document.querySelector("#request-post-form").requestSubmit()');
    await wait(70);
    assert.equal(await evaluate('document.querySelectorAll("#request-board-grid .request-card").length'), 1);
    assert.equal(await evaluate('state.activePage'), "requests", "Successful posting opens My requests");
    assert.equal(await evaluate('document.querySelector("#breadcrumb-title").textContent'), "Campus requests", "The request board has a page title");
    assert.equal(await evaluate('document.querySelectorAll("#request-board-grid .request-card img").length'), 0, "Request text is escaped");
    await checkWidth("390:request-board"); await screenshot("growth-request-board-390");
    await evaluate('appUser={id:"nana"};document.querySelector("#request-board-filter").value="campus";document.querySelector("#request-board-filter").dispatchEvent(new Event("change"));document.querySelector("[data-reply-request]").click();document.querySelector("#request-reply-message").value="I can create your poster with two revisions by Friday.";document.querySelector("#request-reply-price").value="75";document.querySelector("#request-reply-form").requestSubmit()'); await wait(60);
    assert.equal(await evaluate('document.querySelector("[data-reply-request]").disabled'), true, "A student can respond only once");
    await evaluate('appUser={id:"daniel"};document.querySelector("#request-board-filter").dispatchEvent(new Event("change"))');
    assert.equal(await evaluate('document.querySelectorAll(".request-response").length'), 0, "Other students cannot read a private response");
    await evaluate('appUser=null;document.querySelector("#request-board-filter").value="mine";document.querySelector("#request-board-filter").dispatchEvent(new Event("change"))');
    assert.equal(await evaluate('document.querySelectorAll(".request-response").length'), 1, "The requester can review responses");
    await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await checkWidth("1440:request-board"); await screenshot("growth-request-board-1440");
    await evaluate('document.querySelector("[data-close-request]").click()'); await wait(60);
    assert.ok(await evaluate('document.querySelector(".request-meta").textContent.includes("Closed")'));
    await evaluate('document.querySelector("#request-board-filter").value="campus";document.querySelector("#request-board-filter").dispatchEvent(new Event("change"))');
    assert.equal(await evaluate('document.querySelectorAll(".request-card").length'), 0, "Closed requests disappear from the open board");
    console.log("PASS marketplace growth: filters, optional reviews, rebooking, published slots, booking progress, request posts, private responses and closure");
  };
  const verifyRequestPostingRetry = async () => {
    await navigate("index.html");
    await evaluate(`window.__requestRows=[];window.__requestWrites=[];window.__failRequest=true;window.__requestReads=0;
      appUser={id:"requester-fixture"};
      appSupabase={from(table){return {select(){return this},order(){return this},in(){return this},async range(){window.__requestReads++;await new Promise(resolve=>setTimeout(resolve,200));return {data:table==="campus_request_directory"?window.__requestRows:[],error:null}},async limit(){return {data:[],error:null}}}},
      async rpc(name,args){window.__requestWrites.push({name,args});if(window.__failRequest)return {error:{code:"TEST",message:"Could not save your request. Please retry."}};
      const row={id:"request-fixture",requester_id:appUser.id,campus:"University of Ghana",title:args.p_title,description:args.p_description,category:args.p_category,budget:args.p_budget,delivery_method:args.p_delivery,status:"open",expires_at:new Date(Date.now()+86400000).toISOString()};window.__requestRows=[row];return {data:row,error:null}}};
      document.querySelector('.request-board-entry button').click()`);
    assert.equal(await evaluate('document.querySelector("#request-post-modal").open'), true, "Posting can start before the connected board has loaded");
    await evaluate('document.querySelector("#request-title").value="Need a poster for Friday";document.querySelector("#request-description").value="Please make an event poster with two revisions and a social media version.";document.querySelector("#request-budget").value="80";document.querySelector("#request-post-form").requestSubmit()');
    await wait(60);
    assert.equal(await evaluate('document.querySelector("#request-post-modal").open'), true, "A failed save keeps the form open");
    assert.equal(await evaluate('document.querySelector("#request-title").value'), "Need a poster for Friday", "A failed save preserves the task");
    assert.ok(await evaluate('document.querySelector("#request-post-feedback").textContent.includes("retry")'));
    await evaluate('window.__failRequest=false;window.skillmateGrowth.refreshBoard();document.querySelector("#request-post-form").requestSubmit();document.querySelector("#request-post-form").requestSubmit()');
    await wait(650);
    assert.equal(await evaluate('window.__requestWrites.length'), 2, "Retry sends one write, even with a double submission");
    assert.equal(await evaluate('window.__requestWrites[1].name'), "post_campus_request");
    assert.equal(await evaluate('window.__requestWrites[1].args.p_budget'), 80);
    assert.equal(await evaluate('state.activePage'), "requests");
    assert.equal(await evaluate('document.querySelector("#request-post-modal").open'), false);
    assert.equal(await evaluate('document.querySelector("#request-board-filter").value'), "mine");
    assert.equal(await evaluate('document.querySelectorAll("#request-board-grid .request-card").length'), 1, "A refresh already in progress does not hide the new post");
    assert.ok(await evaluate('window.__requestReads>=2'));
    await evaluate('appSupabase=null;appUser=null');
    console.log("PASS connected posting: banner opens form, failed save preserves inputs, retry saves once and displays the new post");
  };
  const verifyMissingGoogleSessionFeedback = async () => {
    await navigate("login.html?skillmate-google-otp=1");
    await wait(50);
    assert.equal(await evaluate('document.querySelector("#auth-message").textContent'), "Google sign-in returned without an authenticated session. Please try again.");
    assert.equal(await evaluate('sessionStorage.getItem("skillmate-google-otp-pending")'), null);
    assert.equal(await evaluate('new URL(location.href).searchParams.has("skillmate-google-otp")'), false);
  };
  await call("Page.enable"); await call("Runtime.enable"); await call("Network.enable");
  await call("Page.bringToFront");
  await call("Network.setBlockedURLs", { urls: ["*supabase.co*", "*supabase.in*", "*fonts.googleapis.com*", "*fonts.gstatic.com*"] });
  const verifyMobileTouch = async () => {
    // Browser touch input uses hit testing; element.click() would bypass blocking overlays.
    const tap = async selector => {
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:"center",behavior:"instant"})`);
      await wait(60);
      const point = await evaluate(`(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        const rect = node.getBoundingClientRect();
        const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x,y);
        return {x,y,hit:hit?.id || hit?.className || hit?.tagName,reachable:node===hit||node.contains(hit)};
      })()`);
      assert.equal(point.reachable, true, `Touch target ${selector} is blocked by ${point.hit}`);
      await call("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y }] });
      await call("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await wait(350);
    };
    for (const width of [320, 390, 768, 1024]) {
      await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: true });
      await call("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
      await navigate("index.html");
      await tap("#menu-toggle");
      assert.equal(await evaluate('document.querySelector("#menu-toggle").getAttribute("aria-expanded")'), "true");
      await tap('.side-nav [data-page="bookings"]');
      assert.equal(await evaluate('state.activePage'), "bookings");
      assert.equal(await evaluate('document.querySelector("#sidebar-backdrop").hidden'), true);
      await tap("#menu-toggle");
      await tap('.side-nav [data-page="home"]');
      await tap('#category-strip [data-category="Tutoring"]');
      assert.equal(await evaluate('selectedCategory'), "Tutoring", JSON.stringify(await evaluate('({page:state.activePage,active:document.activeElement?.outerHTML,category:document.querySelector(\'#category-strip [data-category="Tutoring"]\').outerHTML,dialogs:[...document.querySelectorAll("dialog[open]")].map(e=>e.id)})')));
      await tap("#marketplace-grid h3 button");
      assert.equal(await evaluate('document.querySelector("#provider-detail-modal").open'), true);
      await tap('#provider-detail-modal [data-close]');
      await tap("#global-search");
      await call("Input.insertText", { text: "calculus" });
      await tap("#marketplace-search-submit");
      assert.equal(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length'), 1);
      await tap("#menu-toggle");
      await tap(".account-menu > summary");
      await tap('.account-menu [data-page="profile-settings"]');
      assert.equal(await evaluate('state.activePage'), "profile-settings");
      await tap("#notifications-button");
      assert.equal(await evaluate('document.querySelector("#notifications-modal").open'), true);
      await tap('#notifications-modal [data-close]');
      await tap("#menu-toggle");
      await tap('.side-nav [data-page="messages"]');
      assert.equal(await evaluate('state.activePage'), "messages");
      await checkWidth(`${width}:touch`);
      console.log(`PASS real touch targets: navigation, categories, service details, search, account menu and notifications at ${width}px`);
    }
    await call("Emulation.setTouchEmulationEnabled", { enabled: false });
  };
  if (process.argv.includes("--touch-only")) {
    await verifyMobileTouch();
    assert.deepEqual(errors, [], "Uncaught browser errors");
    console.log(`Screenshots: ${output}`);
    return;
  }
  const verifyMarketplaceRedesign = async () => {
    await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate("index.html?new=1");
    await evaluate('document.fonts.ready');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".side-nav")).flexDirection'), "row");
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".main-content")).marginLeft'), "0px");
    assert.ok(await evaluate('document.querySelector(".marketplace-activity").getBoundingClientRect().left > document.querySelector(".discovery-main").getBoundingClientRect().left'));
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("#category-strip [data-category]")).map(n=>n.dataset.category)'), ["All", "Tutoring", "Design", "Writing", "Tech Support", "Media & Editing", "Events", "Lifestyle"]);
    await evaluate('document.querySelector(\'#category-strip [data-category="Tech Support"]\').click()');
    assert.equal(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length'), 2);
    await evaluate('document.querySelector(\'#category-strip [data-category="All"]\').click();globalSearch.value="calculus";document.querySelector("#marketplace-search-submit").click()');
    assert.equal(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length'), 1);
    await evaluate('globalSearch.value="";renderMarketplace();window.__redesignOriginal={supabase:appSupabase,loaded:dashboardDataLoaded,providers:connectedProviders,services:connectedServices,bookings:state.bookings};appSupabase={};dashboardDataLoaded=true;connectedProviders=[seedProviders[0]];connectedServices=[{id:"old-fixture",providerId:"daniel",title:"Older service",category:"Tech help",description:"Older test listing",price:40,active:true,createdAt:"2025-01-01T10:00:00Z"},{id:"new-fixture",providerId:"daniel",title:"New service",category:"Tech help",description:"New test listing",price:60,active:true,createdAt:"2026-01-01T10:00:00Z"},{id:"undated-fixture",providerId:"daniel",title:"Undated service",category:"Tech help",price:50,active:true}];renderMarketplace()');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("#recent-grid h3")).map(n=>n.textContent)'), ["New service", "Older service"], "Recent listings use real creation timestamps; undated rows are excluded");
    assert.equal(await evaluate('document.querySelector("#recent-grid .listing-cover-button").dataset.service'), "new-fixture");
    assert.equal(await evaluate('document.querySelector("#recent-grid [data-book]").dataset.service'), "new-fixture");
    assert.equal(await evaluate('document.querySelector("#recent-grid .rating").textContent'), "New provider", "No fabricated rating for connected listings without reviews");
    await evaluate('document.querySelector("#recent-view-all").click()');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("#marketplace-grid h3")).map(n=>n.textContent)'), ["New service", "Older service", "Undated service"]);
    await evaluate('appSupabase=window.__redesignOriginal.supabase;dashboardDataLoaded=window.__redesignOriginal.loaded;connectedProviders=window.__redesignOriginal.providers;connectedServices=window.__redesignOriginal.services;document.querySelector("#marketplace-filters").reset();state.bookings=[{id:"upcoming-fixture",providerId:"daniel",status:"Confirmed",date:"2035-01-01",time:"12:00"},{id:"past-fixture",providerId:"daniel",status:"Confirmed",date:"2020-01-01",time:"12:00"}];renderMarketplaceActivity()');
    assert.equal(await evaluate('document.querySelector(\'[data-activity-count="bookings"]\').textContent'), "1");
    await evaluate('document.querySelector(\'[data-activity-count="bookings"]\').closest("a").click()');
    assert.equal(await evaluate('state.activePage'), "bookings");
    assert.equal(await evaluate('bookingFilter'), "upcoming");
    await evaluate('state.bookings=window.__redesignOriginal.bookings;bookingFilter="all";showPage("home");document.querySelector(".offer-skill-card button").click()');
    assert.equal(await evaluate('document.querySelector("#service-modal").open'), true);
    await evaluate('document.querySelector("#service-modal").close();document.querySelector(".side-nav [data-page=activity]").click()');
    assert.equal(await evaluate('location.hash'), "#activity");
    assert.equal(await evaluate('document.querySelector(".side-nav [data-page=activity]").getAttribute("aria-current")'), "page");
    await evaluate('showPage("home");document.querySelector(".account-menu").open=true;document.querySelector("#verification-open").click()');
    assert.equal(await evaluate('document.querySelector("#verification-modal").open'), true);
    await evaluate('document.querySelector("#verification-modal").close();document.querySelector(".account-menu").open=false;renderAll()');
    await wait(500);
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate('document.querySelector("#menu-toggle").focus()');
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    assert.equal(await evaluate('document.querySelector("#menu-toggle").getAttribute("aria-expanded")'), "true", "Keyboard opens compact navigation");
    assert.equal(await evaluate('document.activeElement.dataset.page'), "home", "Menu moves focus to the first destination");
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: 8 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert.equal(await evaluate('document.activeElement.tagName'), "SUMMARY", "Shift Tab stays inside the open menu");
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    assert.equal(await evaluate('document.activeElement.id'), "menu-toggle", "Escape restores focus to menu trigger");
    assert.equal(await evaluate('document.querySelector("#menu-toggle").getAttribute("aria-expanded")'), "false");
    assert.ok(await evaluate('document.querySelector(".marketplace-activity").getBoundingClientRect().top >= document.querySelector(".discovery-main").getBoundingClientRect().bottom'), "Mobile activity sits below the marketplace");
    await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".provider-card")).transitionDuration'), "0s");
    await call("Emulation.setEmulatedMedia", { features: [] });
    await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate("index.html#activity");
    assert.equal(await evaluate('state.activePage'), "activity", "My Activity survives a direct link or refresh");
    await evaluate('showPage("home")');
    console.log("PASS marketplace redesign: navigation, grouped categories, search button, dated services, activity counts, creation and verification");
  };
  if (process.argv.includes("--marketplace-only")) {
    await verifyMarketplaceRedesign();
    await wait(500);
    await screenshot("marketplace-redesign-1440");
    assert.deepEqual(errors, [], "Uncaught browser errors");
    console.log(`Screenshots: ${output}`);
    return;
  }
  if (process.argv.includes("--growth-only")) {
    await verifyGrowthFlow();
    await verifyRequestPostingRetry();
    assert.deepEqual(errors, [], "Uncaught browser errors");
    console.log(`Screenshots: ${output}`);
    return;
  }
  if (process.argv.includes("--otp-only")) {
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await verifyOtpFlow();
    assert.deepEqual(errors, [], "Uncaught browser errors");
    console.log(`Screenshots: ${output}`);
    console.log("PASS six-digit OTP flow: six inputs, sanitized paste, disabled state, incorrect-code retry, success feedback and redirect");
    return;
  }
  if (process.argv.includes("--recovery-only")) {
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await verifyPasswordRecoveryFlow();
    console.log("PASS password recovery: send code, verify six digits, reject mismatched passwords, and set a new password");
    return;
  }
  if (process.argv.includes("--google-only")) {
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await verifyGoogleOtpFlow();
    await verifyMissingGoogleSessionFeedback();
    console.log("PASS Google sign-in: OAuth, six-digit verification and preserved-session app entry");
    return;
  }
  if (process.argv.includes("--polish-only")) {
    await require("./polish-layout-checks.cjs")({ call, evaluate, navigate, wait, screenshot, checkWidth });
    assert.deepEqual(errors, [], "Uncaught browser errors in isolated fixtures");
    console.log(`Fixture screenshots (not authenticated verification): ${output}`);
    return;
  }
  if (process.argv.includes("--main-illustrations-only")) {
    await require("./main-illustrations-browser-checks.cjs")({ call, evaluate, navigate, wait, screenshot, checkWidth });
    assert.deepEqual(errors, [], "Uncaught browser errors");
    console.log(`Screenshots: ${output}`);
    return;
  }
  if (process.argv.includes("--illustrations-only")) {
    await require("./illustrations-browser-checks.cjs")({ call, evaluate, navigate, wait, screenshot, checkWidth });
    assert.deepEqual(errors, [], "Uncaught browser errors");
    console.log(`Screenshots: ${output}`);
    return;
  }
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width <= 768 });
    // `?new=1` removes the demo profile's own listings so this checks the six seed providers only.
    await navigate("index.html?new=1");
    if (width <= 1024) {
      assert.equal(await evaluate('getComputedStyle(document.querySelector("#sidebar")).display'), "none", "Compact navigation is collapsed by default");
      await evaluate('document.querySelector("#menu-toggle").click()');
      assert.equal(await evaluate('document.querySelector("#menu-toggle").getAttribute("aria-expanded")'), "true");
      assert.equal(await evaluate('getComputedStyle(document.querySelector("#sidebar")).display'), "block");
      await checkWidth(width + ":navigation");
      await evaluate('document.querySelector("#sidebar-backdrop").click()');
      assert.equal(await evaluate('document.querySelector("#menu-toggle").getAttribute("aria-expanded")'), "false");
    }
    if (width === 1440) {
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".mobile-nav")).display'), "none", "The floating mobile navigation remains hidden on desktop");
    }
    if (width === 320 || width === 1440) {
      const skeleton = await evaluate(`(()=>{const screen=document.querySelector("#app-auth-status");screen.hidden=false;screen.classList.remove("is-exiting");document.body.classList.add("app-auth-pending");const shell=document.querySelector("#dashboard-loading-skeleton");const page=shell.querySelector(".sk-page");return{shellWidth:shell.getBoundingClientRect().width,pageWidth:page.getBoundingClientRect().width,hasHeader:Boolean(shell.querySelector(".sk-header")),scrollWidth:shell.scrollWidth,cardCount:shell.querySelectorAll(".sk-card").length};})()`);
      assert.equal(skeleton.shellWidth <= width + 1, true, `${width}: loading skeleton fits the viewport`);
      assert.equal(skeleton.pageWidth <= width + 1, true, `${width}: skeleton content has no horizontal overflow`);
      assert.equal(skeleton.scrollWidth <= width + 1, true, `${width}: skeleton does not scroll horizontally`);
      assert.equal(skeleton.hasHeader, true, "The skeleton previews the app header");
      assert.equal(skeleton.cardCount > 0, true, "The skeleton previews service cards");
      await evaluate('document.body.classList.remove("app-auth-pending");document.querySelector("#app-auth-status").hidden=true');
    }
    if (width === 320) {
      const chatTools = await evaluate(`(()=>{const original={services:connectedServices,user:appUser,negotiations:priceNegotiations};const results=[];for(const [mode,userId] of [["negotiation","test-customer"],["hybrid","test-customer"],["hybrid","test-provider"],["negotiation","test-provider"],["fixed","test-customer"],["fixed","test-provider"]]){connectedServices=[{id:"test-service",providerId:"test-provider",title:"Test service",active:true,negotiationMode:mode,price:50}];appUser={id:userId};priceNegotiations=[];const panel=createPriceNegotiationPanel({id:"test-conversation",providerId:"test-provider",name:"Provider"});results.push({proposal:panel?.querySelector("[data-chat-price-propose]")?.textContent||null,booking:panel?.querySelector('[data-price-action="book"]')?.textContent||null,price:panel?.querySelector(".chat-negotiation-listed-price")?.textContent||null})}connectedServices=original.services;appUser=original.user;priceNegotiations=original.negotiations;return results})()`);
      assert.deepEqual(chatTools, [{proposal:"Propose Price",booking:null,price:"GH₵ 50 listed"},{proposal:"Propose Price",booking:null,price:"GH₵ 50 listed"},{proposal:"Propose Price",booking:null,price:"GH₵ 50 listed"},{proposal:"Propose Price",booking:null,price:"GH₵ 50 listed"},{proposal:null,booking:"Continue to Booking",price:"Fixed price · GH₵ 50"},{proposal:null,booking:null,price:"Fixed price · GH₵ 50"}], "Fixed services show booking only to customers; Negotiable and Hybrid keep proposal actions for both participants");
      const serviceSwitching = await evaluate(`(()=>{const original={services:connectedServices,user:appUser,negotiations:priceNegotiations};connectedServices=[{id:"test-service-one",providerId:"test-provider",title:"First service",active:true,negotiationMode:"negotiation",price:50},{id:"test-service-two",providerId:"test-provider",title:"Second service",active:true,negotiationMode:"hybrid",price:80},{id:"test-service-three",providerId:"test-provider",title:"Fixed service",active:true,negotiationMode:"fixed",price:100}];appUser={id:"test-customer"};priceNegotiations=[];chatNegotiationServiceSelection.set("test-conversation","test-service-two");const panel=createPriceNegotiationPanel({id:"test-conversation",providerId:"test-provider",name:"Provider"});const negotiable={count:panel.querySelectorAll("option").length,selected:panel.querySelector("select").value,serviceId:panel.querySelector("[data-chat-price-propose]").dataset.serviceId,listed:panel.querySelector(".chat-negotiation-listed-price").textContent};chatNegotiationServiceSelection.set("test-conversation","test-service-three");const fixedPanel=createPriceNegotiationPanel({id:"test-conversation",providerId:"test-provider",name:"Provider"});const fixed={selected:fixedPanel.querySelector("select").value,price:fixedPanel.querySelector(".chat-negotiation-listed-price").textContent,proposal:fixedPanel.querySelector("[data-chat-price-propose]")?.textContent||null,booking:fixedPanel.querySelector('[data-price-action="book"]')?.textContent||null};connectedServices=original.services;appUser=original.user;priceNegotiations=original.negotiations;chatNegotiationServiceSelection.delete("test-conversation");return{negotiable,fixed}})()`);
      assert.deepEqual(serviceSwitching, { negotiable: { count: 3, selected: "test-service-two", serviceId: "test-service-two", listed: "GH₵ 80 listed" }, fixed: { selected: "test-service-three", price: "Fixed price · GH₵ 100", proposal: null, booking: "Continue to Booking" } }, "Switching a service updates its price label and actions");
      const inactiveProposalStates = await evaluate(`(()=>{const original={services:connectedServices,user:appUser,negotiations:priceNegotiations};const service={id:"inactive-service",providerId:"test-provider",title:"Negotiable service",active:true,negotiationMode:"negotiation",price:50};appUser={id:"test-customer"};connectedServices=[service];const chat={id:"inactive-chat",providerId:"test-provider",name:"Provider"};priceNegotiations=[];const noNegotiationPanel=createPriceNegotiationPanel(chat);const noNegotiation=noNegotiationPanel.querySelector("[data-chat-price-propose]");priceNegotiations=[{id:"open-negotiation",serviceId:service.id,providerId:service.providerId,customerId:appUser.id,conversationId:chat.id,state:"open",offers:[]}];const openPanel=createPriceNegotiationPanel(chat);const openNoProposal=openPanel.querySelector("[data-chat-price-propose]");priceNegotiations=[{id:"pending-negotiation",serviceId:service.id,providerId:service.providerId,customerId:appUser.id,conversationId:chat.id,state:"open",offers:[{id:"pending-offer",status:"pending"}]}];const pending=createPriceNegotiationPanel(chat).querySelector("[data-chat-price-propose]");priceNegotiations=[{id:"agreed-negotiation",serviceId:service.id,providerId:service.providerId,customerId:appUser.id,conversationId:chat.id,state:"agreed",offers:[]}];const agreed=createPriceNegotiationPanel(chat).querySelector("[data-chat-price-propose]");connectedServices=original.services;appUser=original.user;priceNegotiations=original.negotiations;return{noNegotiation:{disabled:noNegotiation.disabled,inactive:noNegotiation.classList.contains("chat-propose-inactive"),status:noNegotiationPanel.querySelector(".chat-negotiation-state").textContent},openNoProposal:{disabled:openNoProposal.disabled,inactive:openNoProposal.classList.contains("chat-propose-inactive"),status:openPanel.querySelector(".chat-negotiation-state").textContent},pending:{disabled:pending.disabled,inactive:pending.classList.contains("chat-propose-inactive"),title:pending.title},agreed:{disabled:agreed.disabled,inactive:agreed.classList.contains("chat-propose-inactive")}}})()`);
      assert.deepEqual(inactiveProposalStates, { noNegotiation: { disabled: true, inactive: true, status: "No negotiation" }, openNoProposal: { disabled: false, inactive: false, status: "Negotiation open" }, pending: { disabled: true, inactive: true, title: "A proposal for this service is waiting for a response." }, agreed: { disabled: true, inactive: true } }, "No negotiation dims and disables Propose Price; an open negotiation enables it, while pending or agreed terms disable it");
      const offerActions = await evaluate(`(()=>{const original={services:connectedServices,user:appUser,negotiations:priceNegotiations};const results={};for(const mode of ["negotiation","hybrid"]){const service={id:"test-service",providerId:"test-provider",title:"Test service",active:true,negotiationMode:mode,price:50};const offer={id:"test-offer",proposerId:"test-customer",amount:40,status:"pending",message:"A test note",createdAt:"2026-01-02T10:00:00Z"};const negotiation={id:"test-negotiation",serviceId:"test-service",providerId:"test-provider",customerId:"test-customer",conversationId:"test-conversation",state:"open",offers:[offer]};appUser={id:"test-provider"};const card=createChatPriceOfferCard(offer,negotiation,service,{name:"Customer"});results[mode]={actions:Array.from(card.querySelectorAll("[data-price-action]"),button=>button.textContent),status:card.querySelector(".chat-proposal-status").textContent,message:card.querySelector(".chat-proposal-message").textContent}}connectedServices=original.services;appUser=original.user;priceNegotiations=original.negotiations;return results})()`);
      assert.deepEqual(offerActions, { negotiation: { actions: ["Accept", "Reject", "Counter"], status: "Pending", message: "A test note" }, hybrid: { actions: ["Accept", "Reject", "Counter"], status: "Pending", message: "A test note" } }, "Conversation proposal cards retain statuses, notes and all existing response actions");
      const fixedOfferActions = await evaluate(`(()=>{const service={id:"test-service",providerId:"test-provider",title:"Test service",active:true,negotiationMode:"fixed",price:50};const offer={id:"test-offer",proposerId:"test-customer",amount:40,status:"pending",message:""};const negotiation={id:"test-negotiation",serviceId:"test-service",providerId:"test-provider",state:"open"};const card=createChatPriceOfferCard(offer,negotiation,service,{name:"Customer"});return Array.from(card.querySelectorAll("[data-price-action]"),button=>button.textContent)})()`);
      assert.deepEqual(fixedOfferActions, [], "Fixed Price does not expose actions for existing offers");
      const offerStatuses = await evaluate(`(()=>{const service={id:"test-service",providerId:"test-provider",title:"Test service",active:true,negotiationMode:"negotiation",price:50};const negotiation={id:"test-negotiation",serviceId:"test-service",providerId:"test-provider",state:"open"};return["pending","accepted","rejected","countered"].map(status=>createChatPriceOfferCard({id:"offer-"+status,proposerId:"test-customer",amount:40,status,message:""},negotiation,service,{name:"Customer"}).querySelector(".chat-proposal-status").textContent)})()`);
      assert.deepEqual(offerStatuses, ["Pending", "Accepted", "Rejected", "Countered"], "Every proposal result has a readable status");
      const agreedBooking = await evaluate(`(()=>{const original={services:connectedServices,user:appUser,negotiations:priceNegotiations};connectedServices=[{id:"agreed-service",providerId:"test-provider",title:"Agreed service",active:true,negotiationMode:"hybrid",price:50}];appUser={id:"test-customer"};priceNegotiations=[{id:"agreed-negotiation",serviceId:"agreed-service",providerId:"test-provider",customerId:"test-customer",conversationId:"test-conversation",listedPrice:50,state:"agreed",agreedPrice:45,agreedScope:"As agreed",offers:[]}];const panel=createPriceNegotiationPanel({id:"test-conversation",providerId:"test-provider",name:"Provider"});const result={status:panel.querySelector(".chat-negotiation-state").textContent,listed:panel.querySelector(".chat-negotiation-listed-price").textContent,statusLabel:panel.querySelector(".chat-negotiation-state").getAttribute("aria-label"),booking:panel.querySelector('[data-price-action="book"]')?.textContent,proposalDisabled:panel.querySelector("[data-chat-price-propose]").disabled};connectedServices=original.services;appUser=original.user;priceNegotiations=original.negotiations;return result})()`);
      assert.deepEqual(agreedBooking, { status: "Agreed", listed: "GH₵ 50 → GH₵ 45", statusLabel: "Agreed price GH₵ 45", booking: "Continue to Booking", proposalDisabled: true }, "Agreements keep booking available and disable further proposals");
      await evaluate(`(()=>{const chat=state.messages[0];window.__narrowChatOriginal={services:connectedServices,user:appUser,negotiations:priceNegotiations,active:activeConversationId,page:state.activePage};connectedServices=[{id:"narrow-one",providerId:chat.providerId,title:"First",active:true,negotiationMode:"negotiation",price:50},{id:"narrow-two",providerId:chat.providerId,title:"Second",active:true,negotiationMode:"hybrid",price:80},{id:"narrow-fixed",providerId:chat.providerId,title:"Fixed service",active:true,negotiationMode:"fixed",price:120}];appUser={id:"narrow-customer"};priceNegotiations=[];showPage("messages");activeConversationId=chat.id;renderConversations()})()`);
      await checkWidth("320:compact-chat");
      await evaluate(`(()=>{const original=window.__narrowChatOriginal;connectedServices=original.services;appUser=original.user;priceNegotiations=original.negotiations;activeConversationId=original.active;showPage(original.page);delete window.__narrowChatOriginal})()`);
    }
    assert.equal(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card [data-profile]").length'), 18, "Covers, titles and avatars all open the existing details");
    assert.equal(await evaluate('document.querySelector("#marketplace-grid .provider-card .listing-cover-button").tagName'), "BUTTON", "The service image opens the existing service details");
    assert.equal(await evaluate('document.querySelector("#marketplace-grid .provider-card h3 button") === null'), false, "The service title is an accessible details control");
    if (width === 320) {
      await evaluate('document.querySelector("#marketplace-grid .provider-card .listing-cover-button").click()');
      assert.equal(await evaluate('document.querySelector("#provider-detail-modal").open'), true, "Clicking the service image opens existing details");
      await evaluate('document.querySelector("#provider-detail-modal").close();document.querySelector("#marketplace-grid .provider-card .provider-profile-trigger").click()');
      await wait(250);
      assert.equal(await evaluate('document.querySelector("#provider-detail-modal").open'), true, "Clicking the provider avatar opens their profile");
      await evaluate('document.querySelector("#provider-detail-modal").close()');
    }
    await checkWidth(`${width}:discover`);
    if (width === 390 || width === 1440) await screenshot(`discover-${width}`);
    for (const page of ["bookings", "messages", "profile-settings", "provider", "earnings", "saved", "help-support", "activity"]) {
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
      const liveChatNegotiation = await evaluate(`(()=>{const original={services:connectedServices,user:appUser,negotiations:priceNegotiations,selection:chatNegotiationServiceSelection.get(activeConversationId)};const chat=state.messages.find(item=>item.id===activeConversationId);try{connectedServices=[{id:"smoke-service-one",providerId:chat.providerId,title:"First service",active:true,negotiationMode:"fixed",price:50},{id:"smoke-service-two",providerId:chat.providerId,title:"Second service",active:true,negotiationMode:"hybrid",price:80}];appUser={id:"smoke-customer"};priceNegotiations=[];chatNegotiationServiceSelection.delete(chat.id);renderChat();const selector=document.querySelector("#chat-service-select");const initialFixed={listed:document.querySelector(".chat-negotiation-listed-price").textContent,proposal:document.querySelector("[data-chat-price-propose]")?.textContent||null,booking:document.querySelector('[data-price-action="book"]')?.textContent||null};selector.value="smoke-service-two";selector.dispatchEvent(new Event("change",{bubbles:true}));priceNegotiations=[{id:"smoke-negotiation",serviceId:"smoke-service-two",providerId:chat.providerId,customerId:"smoke-customer",conversationId:chat.id,listedPrice:80,state:"open",offers:[{id:"smoke-offer",proposerId:chat.providerId,amount:65,status:"pending",message:"Can we agree on this?",createdAt:new Date().toISOString()}]}];renderChat({preserveChatState:true});const messages=document.querySelector("#chat-messages");const bar=document.querySelector(".chat-negotiations");const negotiable={selected:document.querySelector("#chat-service-select").value,serviceId:bar.querySelector("[data-chat-price-propose]").dataset.serviceId,listed:bar.querySelector(".chat-negotiation-listed-price").textContent,proposalInsideMessages:!!messages.querySelector(".chat-proposal-card"),status:messages.querySelector(".chat-proposal-status").textContent,actions:Array.from(messages.querySelectorAll(".chat-proposal-card [data-price-action]"),button=>button.textContent)};document.querySelector("#chat-service-select").value="smoke-service-one";document.querySelector("#chat-service-select").dispatchEvent(new Event("change",{bubbles:true}));const fixed={selected:document.querySelector("#chat-service-select").value,listed:document.querySelector(".chat-negotiation-listed-price").textContent,proposal:document.querySelector("[data-chat-price-propose]")?.textContent||null,booking:document.querySelector('[data-price-action="book"]')?.textContent||null};return{initialFixed,negotiable,fixed,scroll:getComputedStyle(messages).overflowY,barScroll:getComputedStyle(document.querySelector(".chat-negotiations")).overflowY,composerAfterMessages:messages.nextElementSibling.id==="chat-compose",composerBottom:document.querySelector(".chat-compose").getBoundingClientRect().bottom};}finally{connectedServices=original.services;appUser=original.user;priceNegotiations=original.negotiations;if(original.selection===undefined)chatNegotiationServiceSelection.delete(activeConversationId);else chatNegotiationServiceSelection.set(activeConversationId,original.selection);renderChat({preserveChatState:true})}})()`);
      assert.deepEqual(liveChatNegotiation, { initialFixed: { listed: "Fixed price · GH₵ 50", proposal: null, booking: "Continue to Booking" }, negotiable: { selected: "smoke-service-two", serviceId: "smoke-service-two", listed: "GH₵ 80 listed", proposalInsideMessages: true, status: "Pending", actions: ["Accept", "Reject", "Counter"] }, fixed: { selected: "smoke-service-one", listed: "Fixed price · GH₵ 50", proposal: null, booking: "Continue to Booking" }, scroll: "auto", barScroll: "visible", composerAfterMessages: true, composerBottom: 900 }, "Switching service types updates the fixed or negotiable action, proposals stay in the conversation scroll area, and the composer remains at the bottom");
      await evaluate("window.__testDisableRealtime=true");
      const proposalActions = await evaluate(`(async()=>{const chat=state.messages.find(item=>item.id===activeConversationId);const original={services:connectedServices,user:appUser,negotiations:priceNegotiations,selection:chatNegotiationServiceSelection.get(chat.id),supabase:appSupabase,refresh:refreshSupabaseState};const calls=[];try{connectedServices=[{id:"flow-service",providerId:chat.providerId,title:"Flow service",active:true,negotiationMode:"hybrid",price:90}];appUser={id:"flow-customer"};chatNegotiationServiceSelection.set(chat.id,"flow-service");priceNegotiations=[{id:"flow-negotiation",serviceId:"flow-service",providerId:chat.providerId,customerId:"flow-customer",conversationId:chat.id,listedPrice:90,state:"open",offers:[]}];appSupabase={rpc:async(name,args)=>{calls.push({name,args});return{data:null,error:null}}};refreshSupabaseState=async()=>{};renderChat();document.querySelector("[data-chat-price-propose]").click();const modal=document.querySelector("#price-offer-modal");const sheet={open:modal.open,service:document.querySelector("#price-offer-service-name").textContent,listed:document.querySelector("#price-offer-listed-price").textContent,button:document.querySelector("#price-offer-submit").textContent,messageVisible:!document.querySelector("#price-offer-message").closest("label").hidden};document.querySelector("#price-offer-amount").value="75";document.querySelector("#price-offer-message").value="Can we agree on this price?";document.querySelector("#price-offer-form").requestSubmit();await new Promise(resolve=>setTimeout(resolve,30));const send=calls[0];for(const action of ["accept","reject","counter"]){const offer={id:"flow-"+action,proposerId:chat.providerId,amount:70,status:"pending",message:"",createdAt:new Date().toISOString()};priceNegotiations=[{id:"flow-negotiation",serviceId:"flow-service",providerId:chat.providerId,customerId:"flow-customer",conversationId:chat.id,listedPrice:90,state:"open",offers:[offer]}];renderChat();document.querySelector('[data-price-action="'+action+'"]').click();if(action==="counter"){document.querySelector("#price-offer-amount").value="78";document.querySelector("#price-offer-message").value="A small adjustment";document.querySelector("#price-offer-form").requestSubmit()}await new Promise(resolve=>setTimeout(resolve,30))}return{sheet,send,decisions:calls.slice(1).map(call=>({name:call.name,offerId:call.args.p_offer_id,action:call.args.p_action,counterAmount:call.args.p_counter_amount,message:call.args.p_message}))};}finally{connectedServices=original.services;appUser=original.user;priceNegotiations=original.negotiations;if(original.selection===undefined)chatNegotiationServiceSelection.delete(chat.id);else chatNegotiationServiceSelection.set(chat.id,original.selection);appSupabase=original.supabase;refreshSupabaseState=original.refresh;renderChat({preserveChatState:true})}})()`);
      assert.deepEqual(proposalActions, { sheet: { open: true, service: "Flow service", listed: "GH₵ 90", button: "Send Proposal", messageVisible: true }, send: { name: "create_price_negotiation", args: { p_service_id: "flow-service", p_conversation_id: await evaluate("activeConversationId"), p_initial_amount: 75, p_message: "Can we agree on this price?" } }, decisions: [{ name: "decide_price_offer", offerId: "flow-accept", action: "accept", counterAmount: null, message: "" }, { name: "decide_price_offer", offerId: "flow-reject", action: "reject", counterAmount: null, message: "" }, { name: "decide_price_offer", offerId: "flow-counter", action: "counter", counterAmount: 78, message: "A small adjustment" }] }, `Sending and responding to proposals should call existing RPCs: ${JSON.stringify(proposalActions)}`);
      const fastDiscussion = await evaluate(`(async()=>{const providerId=state.messages[0].providerId;const provider=getProvider(providerId);const original={supabase:appSupabase,user:appUser,services:connectedServices,messages:state.messages,blocked:state.blocked,negotiations:priceNegotiations,active:activeConversationId,page:state.activePage,refresh:refreshSupabaseState,live:refreshLiveActivity,loadMessages:loadConversationMessages,markRead:markConversationMessagesRead};let releaseCreate;let refreshCalls=0;try{appUser={id:"flow-customer"};connectedServices=[{id:"flow-service",providerId,title:"Flow service",active:true,negotiationMode:"hybrid",price:90}];state.messages=original.messages.slice();state.blocked=[];priceNegotiations=[];refreshSupabaseState=async()=>{refreshCalls++;throw new Error("Full refresh must not run")};refreshLiveActivity=async()=>{};loadConversationMessages=async()=>[];markConversationMessagesRead=async()=>{};appSupabase={rpc:(name)=>name==="start_conversation"?Promise.resolve({data:"flow-fast-chat",error:null}):new Promise(resolve=>{releaseCreate=()=>resolve({data:"flow-fast-negotiation",error:null})}),from:(table)=>({select(){return this},eq(){return this},single(){return Promise.resolve({data:{id:"flow-fast-negotiation",service_id:"flow-service",provider_id:providerId,customer_id:"flow-customer",conversation_id:"flow-fast-chat",listed_price:90,state:"open",agreed_price:null,agreed_scope_snapshot:"",accepted_offer_id:null},error:null})},order(){return Promise.resolve({data:[],error:null})}})};const trigger=document.querySelector("#booking-negotiate");trigger.disabled=false;const opening=openServiceDiscussion(providerId,"flow-service",trigger);await new Promise(resolve=>setTimeout(resolve,30));const immediate={page:state.activePage,chat:activeConversationId,loading:!!document.querySelector(".chat-opening-spinner"),buttonBusy:trigger.getAttribute("aria-busy"),refreshCalls};releaseCreate();await opening;const finished={loading:!!document.querySelector(".chat-opening-spinner"),negotiation:priceNegotiations.some(item=>item.id==="flow-fast-negotiation"),refreshCalls};return{immediate,finished}}finally{conversationsOpeningNegotiation.clear();appSupabase=original.supabase;appUser=original.user;connectedServices=original.services;state.messages=original.messages;state.blocked=original.blocked;priceNegotiations=original.negotiations;refreshSupabaseState=original.refresh;refreshLiveActivity=original.live;loadConversationMessages=original.loadMessages;markConversationMessagesRead=original.markRead;activeConversationId=original.active;state.activePage=original.page;chatNegotiationServiceSelection.delete("flow-fast-chat");renderConversations()}})()`);
      assert.deepEqual(fastDiscussion, { immediate: { page: "messages", chat: "flow-fast-chat", loading: true, buttonBusy: "true", refreshCalls: 0 }, finished: { loading: false, negotiation: true, refreshCalls: 0 } }, "Price discussion navigates with immediate loading feedback and only fetches this conversation's data");
      await evaluate("window.__testDisableRealtime=false");
      await checkWidth("390:open-chat"); await screenshot("chat-390");
      await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 430, deviceScaleFactor: 1, mobile: true });
      await wait(100);
      assert.ok(await evaluate('document.querySelector(".chat-compose").getBoundingClientRect().bottom <= innerHeight + 1'), "Chat input stays above the viewport edge when the available height shrinks");
      await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
      await evaluate('document.querySelector("[data-chat-back]").click()');
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".marketplace-header")).display'), "flex");
    }
    console.log(`PASS layouts: ${width}px`);
  }
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate("index.html");
  await evaluate('showPage("home");window.scrollTo(0,320)');
  await wait(140);
  const savedDiscoverScroll = await evaluate("window.scrollY");
  assert.ok(savedDiscoverScroll > 0, "The discovery page can be scrolled before navigating away");
  await evaluate('document.querySelector("#menu-toggle").click();document.querySelector(".side-nav [data-page=bookings]").click()');
  assert.equal(await evaluate("location.hash"), "#bookings", "Selecting a mobile navigation item updates the route");
  assert.equal(await evaluate("document.title"), "My bookings | Skillmate", "The page title follows the selected section");
  await evaluate("window.history.back()");
  await wait(400);
  assert.equal(await evaluate("location.hash"), "#home", "Browser Back returns to the previous section");
  assert.ok(Math.abs(await evaluate("window.scrollY") - savedDiscoverScroll) <= 3, "Browser Back restores the previous section's scroll position");
  assert.equal(await evaluate("document.title"), "Discover | Skillmate", "Restored sections retain a matching page title");
  await evaluate('showPage("profile-settings")');
  await evaluate('showPage("home");renderAll()');
  assert.equal(await evaluate('document.querySelector("#verification-cta").hidden'), false, "Unverified students see the campus verification prompt");
  await evaluate('document.querySelector("#verification-cta").click()');
  assert.equal(await evaluate('document.querySelector("#verification-modal").open'), true, "The campus prompt opens the student ID verification form");
  await evaluate('document.querySelector("#verification-modal").close();state.profile.verified=true;renderAll()');
  assert.equal(await evaluate('document.querySelector("#verification-cta").hidden'), true, "Verified students no longer see the verification prompt");
  await evaluate('state.profile.verified=false;renderAll();showPage("profile-settings")');
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
  assert.equal(await evaluate('document.querySelector("#review-modal").open'), false, "An outstanding review never interrupts another booking");
  assert.equal(await evaluate('document.querySelector("#booking-modal").open'), true, "Students can book while a review is outstanding");
  assert.equal(await evaluate('document.querySelector("#booking-price").textContent'), "GH₵ 120");
  assert.equal(await evaluate('document.querySelector("#booking-time").type'), "time");
  assert.equal(await evaluate('document.querySelector("#booking-service-switch").hidden'), true, "A single-service provider has no unnecessary service switch");
  await checkWidth("390:booking-dialog"); await screenshot("booking-request-390");
  await evaluate('document.querySelector("#booking-location-type").value="online";document.querySelector("#booking-location-type").dispatchEvent(new Event("change"));document.querySelector("#booking-time").value="13:15";document.querySelector("#booking-form").requestSubmit()');
  assert.equal(await evaluate('state.bookings[0].status'), "Pending");
  assert.equal(await evaluate('state.bookings[0].requestedLocation'), "Online", "Location choice is included in the booking request");
  assert.equal(await evaluate('state.activePage'), "bookings");
  await evaluate('showPage("profile-settings");document.documentElement.dataset.theme="light";document.querySelector("[data-theme-toggle]").click();showPage("home")');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), "dark");
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".marketplace-header")).display'), "flex");
  assert.ok(await evaluate('document.querySelector(".marketplace-header").getBoundingClientRect().bottom <= innerHeight + 1'), "Navigation stays on screen after switching theme");
  assert.ok(await evaluate('!!document.elementFromPoint(45,25).closest(".marketplace-header")'), "Toasts must not cover the navigation");
  await screenshot("discover-dark-390");
  await evaluate('globalSearch.value="";renderMarketplace();openProviderProfile("akosua")');
  await checkWidth("390:provider-details");
  await evaluate('document.querySelector("[data-group-provider=akosua]").click()');
  assert.equal(await evaluate('document.querySelector("#groups-modal").open'), true);
  assert.ok(await evaluate('Array.from(document.querySelectorAll("#group-grid .group-card h3")).every(e=>e.textContent.includes("Braids"))'));
  await evaluate('showPage("messages")');
  assert.equal(await evaluate('document.querySelectorAll("dialog[open]").length'), 0, "Changing pages closes stacked group dialogs");
  await evaluate('showPage("home");globalSearch.value="";selectedCategory="All";window.__originalProviderServices=providerServices;window.__testServices=[{id:"audit-tech",providerId:"daniel",title:"Audit laptop repair",category:"Tech help",description:"Laptop repair",price:50,active:true,negotiationMode:"fixed",deliveryMethod:"in_person"},{id:"audit-math",providerId:"daniel",title:"Audit calculus tutoring",category:"Tutoring",description:"Calculus help",price:40,active:true,negotiationMode:"hybrid",deliveryMethod:"both"}];providerServices=id=>id==="daniel"?window.__testServices:window.__originalProviderServices(id);renderMarketplace("marketplace-grid",window.skillmateMarketplace.expandListings([seedProviders[0]],window.__testServices))');
  assert.equal(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length'), 2);
  await evaluate('document.querySelector("#marketplace-grid [data-book=daniel][data-service=audit-math]").click()');
  assert.equal(await evaluate('document.querySelector("#booking-service").value'), "audit-math", "Book the selected service rather than the provider's first service");
  assert.ok(await evaluate('document.querySelector("#booking-price").textContent.includes("40")'));
  assert.equal(await evaluate('document.querySelector("#booking-summary-service").textContent'), "Audit calculus tutoring");
  assert.equal(await evaluate('document.querySelector("#booking-provider-name").textContent'), "Daniel Owusu");
  assert.equal(await evaluate('document.querySelector("#booking-negotiation-option").hidden'), false, "Negotiable services expose the chat option");
  assert.equal(await evaluate('document.querySelector("#booking-negotiable-badge").textContent'), "Negotiable");
  assert.equal(await evaluate('document.querySelector("#booking-service-switch").hidden'), false, "Multiple services can be switched in the booking flow");
  await call("Emulation.setDeviceMetricsOverride", { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
  await checkWidth("320:negotiable-booking");
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".booking-date-time")).gridTemplateColumns.split(" ").length'), 2, "Date and time stay side by side at 320px");
  assert.equal(await evaluate('document.querySelector("#booking-submit").getBoundingClientRect().bottom <= innerHeight + 1'), true, "The submit action stays visible on narrow phones");
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await checkWidth("390:negotiable-booking");
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await checkWidth("1440:negotiable-booking");
  assert.ok(await evaluate('document.querySelector("#booking-modal").getBoundingClientRect().width <= 520'), "Desktop booking modal remains compact");
  assert.equal(await evaluate('document.querySelector("#booking-submit").getBoundingClientRect().bottom <= innerHeight + 1'), true, "Desktop primary action remains visible");
  await screenshot("booking-request-1440");
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.querySelector("#booking-submit").getBoundingClientRect().bottom <= innerHeight + 1'), true, "Primary action remains visible without scrolling");
  await evaluate('document.querySelector("#booking-date").value="2035-05-10";document.querySelector("#booking-time").value="13:15";document.querySelector("#booking-note").value="Please bring practice questions";document.querySelector("#booking-instructions").open=true;document.querySelector("#booking-location-type").value="other";document.querySelector("#booking-location-type").dispatchEvent(new Event("change"));document.querySelector("#booking-location").value="Library entrance";document.querySelector("#booking-negotiate").click()');
  assert.equal(await evaluate('document.querySelector("#booking-modal").open'), true, "Failed/unavailable chat navigation leaves the booking form intact");
  await evaluate('document.querySelector("#booking-modal").close();openBooking("daniel","audit-math")');
  assert.equal(await evaluate('document.querySelector("#booking-date").value'), "2035-05-10", "Booking draft date is restored after reopening");
  assert.equal(await evaluate('document.querySelector("#booking-time").value'), "13:15");
  assert.equal(await evaluate('document.querySelector("#booking-note").value'), "Please bring practice questions");
  assert.equal(await evaluate('document.querySelector("#booking-instructions").open'), true, "Optional instructions are restored and expanded when populated");
  assert.equal(await evaluate('document.querySelector("#booking-location-type").value'), "other");
  assert.equal(await evaluate('document.querySelector("#booking-location-details").hidden'), false);
  assert.equal(await evaluate('document.querySelector("#booking-location").value'), "Library entrance");
  await evaluate('window.__bookingCountBeforeChat=state.bookings.length;window.__oldBookingSupabase=appSupabase;window.__oldBookingRefresh=refreshSupabaseState;window.__oldBookingSync=syncMessageChannels;appSupabase={rpc:async(name)=>({data:name==="start_conversation"?"booking-chat":"booking-negotiation",error:null})};refreshSupabaseState=async()=>{state.messages=[{id:"booking-chat",providerId:"daniel",name:"Daniel",messages:[]}];};syncMessageChannels=()=>{};openServiceDiscussion("daniel","audit-math")');
  await wait(100);
  assert.equal(await evaluate('state.activePage'), "messages", "Price discussion opens Messages");
  assert.equal(await evaluate('chatNegotiationServiceSelection.get("booking-chat")'), "audit-math", "Chat opens with the selected service");
  assert.equal(await evaluate('document.querySelector("#booking-modal").open'), false);
  assert.equal(await evaluate('state.bookings.length'), await evaluate('window.__bookingCountBeforeChat'), "Opening chat does not create a booking");
  await evaluate('openBooking("daniel","audit-math")');
  assert.equal(await evaluate('document.querySelector("#booking-note").value'), "Please bring practice questions", "Chat detour keeps the booking draft");
  await evaluate('document.querySelector("#booking-modal").close();appSupabase=window.__oldBookingSupabase;refreshSupabaseState=window.__oldBookingRefresh;syncMessageChannels=window.__oldBookingSync;showPage("home")');
  await evaluate('document.querySelector("#booking-service").value="audit-tech";document.querySelector("#booking-service").dispatchEvent(new Event("change"))');
  assert.equal(await evaluate('document.querySelector("#booking-negotiation-option").hidden'), true, "Fixed-price services hide the negotiation option");
  assert.equal(await evaluate('document.querySelector("#booking-negotiable-badge").textContent'), "Fixed price");
  assert.equal(await evaluate('document.querySelector("#booking-summary-service").textContent'), "Audit laptop repair", "Switching services updates the summary");
  assert.ok(await evaluate('document.querySelector("#booking-price").textContent.includes("50")'));
  assert.equal(await evaluate('Array.from(document.querySelector("#booking-location-type").options).some(option=>option.value==="campus")'), true, "In-person services offer an appropriate location choice");
  assert.equal(await evaluate('document.querySelector("#booking-location-type").value'), "other", "A compatible location choice is preserved when switching services");
  assert.equal(await evaluate('document.querySelector("#booking-location-details").hidden'), false);
  assert.equal(await evaluate('document.querySelector("#booking-location").required'), true, "A custom location requires details");
  await evaluate('window.__bookingCountBeforeValidation=state.bookings.length;document.querySelector("#booking-location").value="";document.querySelector("#booking-form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');
  assert.ok(await evaluate('document.querySelector("#toast").textContent.includes("Add a location")'), "Custom locations cannot be submitted without details");
  assert.equal(await evaluate('state.bookings.length'), await evaluate('window.__bookingCountBeforeValidation'));
  await evaluate('document.querySelector("#booking-location").value="North campus library";document.querySelector("#booking-date").value="2000-01-01";document.querySelector("#booking-form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');
  assert.ok(await evaluate('document.querySelector("#toast").textContent.includes("future appointment")'), "Past appointment times are rejected");
  assert.equal(await evaluate('state.bookings.length'), await evaluate('window.__bookingCountBeforeValidation'));
  await evaluate('document.querySelector("#booking-date").value="2035-05-10";document.querySelector("#booking-form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');
  assert.equal(await evaluate('state.bookings[0].service'), "Audit laptop repair", "Fixed-price services remain bookable at the listed price");
  assert.equal(await evaluate('state.bookings[0].price'), 50);
  assert.equal(await evaluate('state.bookings[0].requestedLocation'), "Other: North campus library");
  await evaluate('window.__bookingPreviousUser=appUser;window.__bookingPreviousSupabase=appSupabase;window.__bookingPreviousConnectedServices=connectedServices;window.__bookingPreviousRefresh=refreshSupabaseState;window.__bookingPreviousActivityRefresh=refreshLiveActivity;window.__bookingBeforePending=state.bookings.slice();window.__bookingWriteCount=0;window.__bookingWritePromise=new Promise(resolve=>window.__resolveBookingWrite=resolve);appUser={id:"booking-duplicate-test"};connectedServices=window.__testServices;appSupabase={from:()=>({insert:()=>{window.__bookingWriteCount++;return window.__bookingWritePromise;}})};refreshSupabaseState=async()=>{};refreshLiveActivity=async()=>{};openBooking("daniel","audit-tech");document.querySelector("#booking-form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));document.querySelector("#booking-form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');
  assert.equal(await evaluate('window.__bookingWriteCount'), 1, "Two rapid submissions issue only one backend insert");
  assert.equal(await evaluate('bookingSubmissionPending'), true, "The form remains locked while the booking request is pending");
  await evaluate('window.__resolveBookingWrite({error:null})');
  await wait(100);
  assert.equal(await evaluate('bookingSubmissionPending'), false, "The submit guard clears after the request finishes");
  await evaluate('appUser=window.__bookingPreviousUser;appSupabase=window.__bookingPreviousSupabase;connectedServices=window.__bookingPreviousConnectedServices;refreshSupabaseState=window.__bookingPreviousRefresh;refreshLiveActivity=window.__bookingPreviousActivityRefresh;state.bookings=window.__bookingBeforePending;renderAll()');
  await evaluate('providerServices=window.__originalProviderServices');
  await evaluate('window.__previousAppUser=appUser;window.__previousNegotiations=priceNegotiations;appUser={id:"test-customer"};priceNegotiations=[{id:"test-agreement",serviceId:"akosua-service",providerId:"akosua",customerId:"test-customer",state:"agreed",agreedPrice:95,listedPrice:120,agreedScope:"Two-hour tutoring session with practice questions."}];openBooking("akosua","akosua-service","test-agreement")');
  assert.equal(await evaluate('document.querySelector("#booking-agreement-review").hidden'), false, "Negotiated bookings display the agreed terms");
  assert.equal(await evaluate('document.querySelector("#booking-service").disabled'), true, "The agreed service cannot be switched to another listing");
  assert.ok(await evaluate('document.querySelector("#booking-agreed-price").textContent.includes("95")'));
  assert.ok(await evaluate('document.querySelector("#booking-original-price").textContent.includes("120")'));
  assert.equal(await evaluate('document.querySelector("#booking-confirm-details").required'), true, "The customer must explicitly confirm agreed booking details");
  await evaluate('document.querySelector("#booking-form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');
  assert.ok(await evaluate('document.querySelector("#toast").textContent.includes("Review the booking details")'), "The request is blocked until the customer checks the review box");
  await evaluate('document.querySelector("#booking-modal").close();appUser=window.__previousAppUser;priceNegotiations=window.__previousNegotiations');
  await navigate("index.html?new=1");
  assert.equal(await evaluate('document.querySelector(".side-nav [data-page=provider]").hidden'), false);
  await evaluate('showPage("profile-settings");document.querySelector("#mode-switch").click()');
  assert.equal(await evaluate('document.querySelector("#service-modal").open'), true);
  await checkWidth("390:create-service"); await screenshot("add-service-390");
  await evaluate('document.querySelector("#service-title").value="Campus design help";document.querySelector("#service-description").value="A custom poster with two revisions included.";document.querySelector("#service-price").value="50";document.querySelector("#service-minimum-price").value="25";document.querySelector("#service-delivery").value="online";document.querySelector("#service-form").requestSubmit()');
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
  assert.equal(await evaluate('new URL(window.__authCalls[0].options.redirectTo).pathname.endsWith("/login.html")'), true, "Google returns to the verification page before entering the app");
  await evaluate('redirectForSession({access_token:"google-access",refresh_token:"google-refresh",expires_in:3600})');
  await wait(100);
  assert.equal(await evaluate('window.__googleOtpCalls.length'), 1, "Google callback starts server-side email verification");
  assert.equal(await evaluate('window.__googleOtpCalls[0].authorization'), "Bearer google-access");
  assert.equal(await evaluate('document.querySelector("#auth-otp").hidden'), false, "Google users see the six-digit verification screen");
  await navigate("onboarding.html"); await checkWidth("390:onboarding");
  assert.equal(await evaluate('document.querySelector("#onboarding-name").value'), "Test Student");
  assert.equal(await evaluate('document.querySelector(".onboarding-extras").open'), false);
  await screenshot("onboarding-390");
  await evaluate('document.querySelector("#onboarding-campus").value="University of Ghana";document.querySelector("#onboarding-form").requestSubmit()');
  await wait(150);
  assert.equal(await evaluate('JSON.parse(sessionStorage.getItem("onboarding-fixture")).onboarding_completed'), true);
  assert.equal(await evaluate('JSON.parse(sessionStorage.getItem("onboarding-fixture")).university'), "University of Ghana");
  await verifyMobileTouch();
  await verifyMarketplaceRedesign();
  await verifyPasswordRecoveryFlow();
  await verifyGrowthFlow();
  await verifyRequestPostingRetry();
  assert.deepEqual(errors, [], "Uncaught browser errors");
  console.log("PASS interactions: profile editing, student details, mobile seller label, search refocus, service selection, categories, booking, chat, theme, first listing and Google OTP gate");
  console.log(`Screenshots: ${output}`);
  await call("Browser.close").catch(() => {});
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  socket?.close(); chrome?.kill(); server.close();
});
