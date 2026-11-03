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
  if (name === "user.js") {
    content = content.replace("const appSupabase = window.skillmateSupabase;", "let appSupabase = window.skillmateSupabase;");
    content = content.replace("function syncMessageChannels() {", "function syncMessageChannels() { if (window.__testDisableRealtime) return;");
    content = content.replace("bootstrapStudentApp().catch((error) => {", `Promise.resolve().then(() => {
    state.profile.university = "University of Ghana";
    if (new URLSearchParams(location.search).has("new")) state.services = [];
    initializeDashboard(); loadAccountSettings(); showConnectedApp();
  }).catch((error) => {`);
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
  const verifyGoogleOtpFlow = async () => {
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
    await wait(100);
    assert.deepEqual(await evaluate('window.__verifyCalls.map(call=>call.code)'), ["246810"]);
    assert.equal(await evaluate('window.__serverSessionSyncCalls'), 1, "Successful OTP reuses and syncs the preserved Google session");
    assert.equal(await evaluate('window.__setSessionCalls'), 1, "Missing local auth state is restored from the server-verified session");
    assert.equal(await evaluate('window.__googleSignOutCalls'), 0, "Google session is not cleared before the OTP is verified");
    assert.equal(await evaluate('sessionStorage.getItem("skillmate-google-otp-active")'), null);
    await wait(600);
    assert.equal(await evaluate('location.pathname.endsWith("/index.html")'), true, "Verified Google user enters the app");
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
  if (process.argv.includes("--google-only")) {
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await verifyGoogleOtpFlow();
    await verifyMissingGoogleSessionFeedback();
    console.log("PASS Google sign-in: OAuth, six-digit verification and preserved-session app entry");
    return;
  }
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width <= 768 });
    await navigate("index.html");
    assert.equal(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card").length'), 6);
    if (width === 320) {
      const mobileNav = await evaluate(`(()=>{const nav=document.querySelector(".mobile-nav");const box=nav.getBoundingClientRect();const probe=document.createElement("i");probe.style.color="var(--main)";nav.append(probe);const themeBlue=getComputedStyle(probe).color;probe.remove();return{display:getComputedStyle(nav).display,position:getComputedStyle(nav).position,width:box.width,rightGap:innerWidth-box.right,bottomGap:innerHeight-box.bottom,radius:getComputedStyle(nav).borderRadius,linkCount:nav.querySelectorAll("[data-page-link]").length,activeColor:getComputedStyle(nav.querySelector('[aria-current="page"]')).color,themeBlue,contentPadding:getComputedStyle(document.querySelector(".main-content")).paddingBottom};})()`);
      assert.equal(mobileNav.display, "grid", "Mobile retains the four-destination navigation");
      assert.equal(mobileNav.position, "fixed", "Mobile navigation stays fixed while browsing");
      assert.ok(mobileNav.width <= width && mobileNav.rightGap >= 12 && mobileNav.bottomGap >= 8, `Floating navigation fits within the mobile safe area: ${JSON.stringify(mobileNav)}`);
      assert.ok(parseFloat(mobileNav.radius) >= 100, "The mobile navigation uses a pill-shaped container");
      assert.equal(mobileNav.linkCount, 4, "All four existing navigation destinations remain available");
      assert.equal(mobileNav.activeColor, mobileNav.themeBlue, "The active destination uses the existing blue theme color");
      assert.ok(parseFloat(mobileNav.contentPadding) >= 90, "Page content reserves space below the floating navigation");
      const viewportOffset = await evaluate(`(()=>{const descriptor=Object.getOwnPropertyDescriptor(window,"visualViewport");try{Object.defineProperty(window,"visualViewport",{configurable:true,value:{height:innerHeight-80,offsetTop:10,addEventListener(){}}});syncChatVisualViewport();return getComputedStyle(document.documentElement).getPropertyValue("--mobile-nav-viewport-bottom").trim();}finally{if(descriptor)Object.defineProperty(window,"visualViewport",descriptor);else delete window.visualViewport;syncChatVisualViewport();}})()`);
      assert.equal(viewportOffset, "70px", "The floating navigation follows changes to the visible mobile viewport");
      await evaluate('document.body.classList.add("mobile-keyboard-open")');
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".mobile-nav")).display'), "none", "The floating navigation hides while a mobile keyboard is open");
      await evaluate('document.body.classList.remove("mobile-keyboard-open")');
    }
    if (width === 1440) {
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".mobile-nav")).display'), "none", "The floating mobile navigation remains hidden on desktop");
    }
    if (width === 320 || width === 1440) {
      const skeleton = await evaluate(`(()=>{const screen=document.querySelector("#app-auth-status");const app=document.querySelector("#app-shell");screen.hidden=false;screen.classList.remove("is-exiting");document.body.classList.add("app-auth-pending");const shell=document.querySelector("#dashboard-loading-skeleton");const sidebar=document.querySelector(".dashboard-skeleton-sidebar");const nav=document.querySelector(".dashboard-skeleton-mobile-nav");const content=document.querySelector(".dashboard-skeleton-content");return{width:innerWidth,columns:getComputedStyle(shell).gridTemplateColumns,sidebarDisplay:getComputedStyle(sidebar).display,navDisplay:getComputedStyle(nav).display,shellWidth:shell.getBoundingClientRect().width,contentWidth:content.getBoundingClientRect().width,coverCount:document.querySelectorAll(".dashboard-skeleton-card").length};})()`);
      assert.equal(skeleton.shellWidth <= width + 1, true, `${width}: loading skeleton fits the viewport`);
      assert.equal(skeleton.contentWidth <= width + 1, true, `${width}: skeleton content has no horizontal overflow`);
      assert.equal(skeleton.coverCount, 2);
      if (width === 320) {
        assert.equal(skeleton.sidebarDisplay, "none", "Phone skeleton omits desktop sidebar");
        assert.notEqual(skeleton.navDisplay, "none", "Phone skeleton includes the bottom navigation");
      } else {
        assert.notEqual(skeleton.sidebarDisplay, "none", "Desktop skeleton mirrors the application sidebar");
        assert.equal(skeleton.navDisplay, "none", "Desktop skeleton omits mobile navigation");
      }
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
    assert.equal(await evaluate('document.querySelectorAll("#marketplace-grid .provider-card [data-profile]").length'), 6, "Only provider avatar controls carry profile navigation");
    assert.equal(await evaluate('document.querySelector("#marketplace-grid .provider-card .listing-cover-button").tagName'), "DIV", "The service image is not a profile navigation control");
    assert.equal(await evaluate('document.querySelector("#marketplace-grid .provider-card h3 button") === null'), true, "The service title is not a profile navigation control");
    if (width === 320) {
      await evaluate('document.querySelector("#marketplace-grid .provider-card .listing-cover-button").click()');
      assert.equal(await evaluate('document.querySelector("#provider-detail-modal").open'), false, "Clicking the service image does not open provider details");
      await evaluate('document.querySelector("#marketplace-grid .provider-card .provider-profile-trigger").click()');
      await wait(250);
      assert.equal(await evaluate('document.querySelector("#provider-detail-modal").open'), true, "Clicking the provider avatar opens their profile");
      await evaluate('document.querySelector("#provider-detail-modal").close()');
    }
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
      const liveChatNegotiation = await evaluate(`(()=>{const original={services:connectedServices,user:appUser,negotiations:priceNegotiations,selection:chatNegotiationServiceSelection.get(activeConversationId)};const chat=state.messages.find(item=>item.id===activeConversationId);try{connectedServices=[{id:"smoke-service-one",providerId:chat.providerId,title:"First service",active:true,negotiationMode:"fixed",price:50},{id:"smoke-service-two",providerId:chat.providerId,title:"Second service",active:true,negotiationMode:"hybrid",price:80}];appUser={id:"smoke-customer"};priceNegotiations=[];chatNegotiationServiceSelection.delete(chat.id);renderChat();const selector=document.querySelector("#chat-service-select");const initialFixed={listed:document.querySelector(".chat-negotiation-listed-price").textContent,proposal:document.querySelector("[data-chat-price-propose]")?.textContent||null,booking:document.querySelector('[data-price-action="book"]')?.textContent||null};selector.value="smoke-service-two";selector.dispatchEvent(new Event("change",{bubbles:true}));priceNegotiations=[{id:"smoke-negotiation",serviceId:"smoke-service-two",providerId:chat.providerId,customerId:"smoke-customer",conversationId:chat.id,listedPrice:80,state:"open",offers:[{id:"smoke-offer",proposerId:chat.providerId,amount:65,status:"pending",message:"Can we agree on this?",createdAt:new Date().toISOString()}]}];renderChat({preserveChatState:true});const messages=document.querySelector("#chat-messages");const bar=document.querySelector(".chat-negotiations");const negotiable={selected:document.querySelector("#chat-service-select").value,serviceId:bar.querySelector("[data-chat-price-propose]").dataset.serviceId,listed:bar.querySelector(".chat-negotiation-listed-price").textContent,proposalInsideMessages:!!messages.querySelector(".chat-proposal-card"),status:messages.querySelector(".chat-proposal-status").textContent,actions:Array.from(messages.querySelectorAll(".chat-proposal-card [data-price-action]"),button=>button.textContent)};document.querySelector("#chat-service-select").value="smoke-service-one";document.querySelector("#chat-service-select").dispatchEvent(new Event("change",{bubbles:true}));const fixed={selected:document.querySelector("#chat-service-select").value,listed:document.querySelector(".chat-negotiation-listed-price").textContent,proposal:document.querySelector("[data-chat-price-propose]")?.textContent||null,booking:document.querySelector('[data-price-action="book"]')?.textContent||null};return{initialFixed,negotiable,fixed,scroll:getComputedStyle(messages).overflowY,barScroll:getComputedStyle(document.querySelector(".chat-negotiations")).overflowY,composerAfterMessages:messages.nextElementSibling.id==="chat-compose",composerBottom:document.querySelector(".chat-compose").getBoundingClientRect().bottom};}finally{connectedServices=original.services;appUser=original.user;priceNegotiations=original.negotiations;if(original.selection===undefined)chatNegotiationServiceSelection.delete(activeConversationId);else chatNegotiationServiceSelection.set(activeConversationId,original.selection);renderChat({preserveChatState:true})}})()`);
      assert.deepEqual(liveChatNegotiation, { initialFixed: { listed: "Fixed price · GH₵ 50", proposal: null, booking: "Continue to Booking" }, negotiable: { selected: "smoke-service-two", serviceId: "smoke-service-two", listed: "GH₵ 80 listed", proposalInsideMessages: true, status: "Pending", actions: ["Accept", "Reject", "Counter"] }, fixed: { selected: "smoke-service-one", listed: "Fixed price · GH₵ 50", proposal: null, booking: "Continue to Booking" }, scroll: "auto", barScroll: "visible", composerAfterMessages: true, composerBottom: 900 }, "Switching service types updates the fixed or negotiable action, proposals stay in the conversation scroll area, and the composer remains at the bottom");
      await evaluate("window.__testDisableRealtime=true");
      const proposalActions = await evaluate(`(async()=>{const chat=state.messages.find(item=>item.id===activeConversationId);const original={services:connectedServices,user:appUser,negotiations:priceNegotiations,selection:chatNegotiationServiceSelection.get(chat.id),supabase:appSupabase,refresh:refreshSupabaseState};const calls=[];try{connectedServices=[{id:"flow-service",providerId:chat.providerId,title:"Flow service",active:true,negotiationMode:"hybrid",price:90}];appUser={id:"flow-customer"};chatNegotiationServiceSelection.set(chat.id,"flow-service");priceNegotiations=[{id:"flow-negotiation",serviceId:"flow-service",providerId:chat.providerId,customerId:"flow-customer",conversationId:chat.id,listedPrice:90,state:"open",offers:[]}];appSupabase={rpc:async(name,args)=>{calls.push({name,args});return{data:null,error:null}}};refreshSupabaseState=async()=>{};renderChat();document.querySelector("[data-chat-price-propose]").click();const modal=document.querySelector("#price-offer-modal");const sheet={open:modal.open,service:document.querySelector("#price-offer-service-name").textContent,listed:document.querySelector("#price-offer-listed-price").textContent,button:document.querySelector("#price-offer-submit").textContent,messageVisible:!document.querySelector("#price-offer-message").closest("label").hidden};document.querySelector("#price-offer-amount").value="75";document.querySelector("#price-offer-message").value="Can we agree on this price?";document.querySelector("#price-offer-form").requestSubmit();await new Promise(resolve=>setTimeout(resolve,30));const send=calls[0];for(const action of ["accept","reject","counter"]){const offer={id:"flow-"+action,proposerId:chat.providerId,amount:70,status:"pending",message:"",createdAt:new Date().toISOString()};priceNegotiations=[{id:"flow-negotiation",serviceId:"flow-service",providerId:chat.providerId,customerId:"flow-customer",conversationId:chat.id,listedPrice:90,state:"open",offers:[offer]}];renderChat();document.querySelector('[data-price-action="'+action+'"]').click();if(action==="counter"){document.querySelector("#price-offer-amount").value="78";document.querySelector("#price-offer-message").value="A small adjustment";document.querySelector("#price-offer-form").requestSubmit()}await new Promise(resolve=>setTimeout(resolve,30))}return{sheet,send,decisions:calls.slice(1).map(call=>({name:call.name,offerId:call.args.p_offer_id,action:call.args.p_action,counterAmount:call.args.p_counter_amount,message:call.args.p_message}))};}finally{connectedServices=original.services;appUser=original.user;priceNegotiations=original.negotiations;if(original.selection===undefined)chatNegotiationServiceSelection.delete(chat.id);else chatNegotiationServiceSelection.set(chat.id,original.selection);appSupabase=original.supabase;refreshSupabaseState=original.refresh;renderChat({preserveChatState:true})}})()`);
      assert.deepEqual(proposalActions, { sheet: { open: true, service: "Flow service", listed: "GH₵ 90", button: "Send Proposal", messageVisible: true }, send: { name: "create_price_negotiation", args: { p_service_id: "flow-service", p_conversation_id: await evaluate("activeConversationId"), p_initial_amount: 75, p_message: "Can we agree on this price?" } }, decisions: [{ name: "decide_price_offer", offerId: "flow-accept", action: "accept", counterAmount: null, message: "" }, { name: "decide_price_offer", offerId: "flow-reject", action: "reject", counterAmount: null, message: "" }, { name: "decide_price_offer", offerId: "flow-counter", action: "counter", counterAmount: 78, message: "A small adjustment" }] }, `Sending and responding to proposals should call existing RPCs: ${JSON.stringify(proposalActions)}`);
      await evaluate("window.__testDisableRealtime=false");
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
  await evaluate('showPage("home");window.scrollTo(0,320)');
  await wait(140);
  const savedDiscoverScroll = await evaluate("window.scrollY");
  assert.ok(savedDiscoverScroll > 0, "The discovery page can be scrolled before navigating away");
  await evaluate('document.querySelector(".mobile-nav [data-page-link=\\"bookings\\"]").click()');
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
  assert.equal(await evaluate('document.querySelector("#review-modal").open'), true, "An unrated completed booking requires a customer review before another booking");
  assert.equal(await evaluate('document.querySelector("#booking-modal").open'), false, "The next booking stays blocked until the review is posted");
  await evaluate('document.querySelector("#review-text").value="The service was helpful and completed as agreed.";document.querySelector("#review-form").requestSubmit()');
  assert.equal(await evaluate('state.bookings.find(b=>b.status==="Completed"&&!isOwnBooking(b)).reviewed'), true);
  await evaluate('document.querySelector("#marketplace-grid [data-book=akosua]").click()');
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
  assert.equal(await evaluate('document.querySelector(".side-nav [data-page=provider]").hidden'), true);
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
  await verifyPasswordRecoveryFlow();
  assert.deepEqual(errors, [], "Uncaught browser errors");
  console.log("PASS interactions: profile editing, student details, mobile seller label, search refocus, service selection, categories, booking, chat, theme, first listing and Google OTP gate");
  console.log(`Screenshots: ${output}`);
  await call("Browser.close").catch(() => {});
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  socket?.close(); chrome?.kill(); server.close();
});
