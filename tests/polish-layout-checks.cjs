// Isolated student fixtures only. This is NOT live authenticated page verification.
const assert = require("node:assert/strict");
module.exports = async ({ call, evaluate, navigate, wait, screenshot, checkWidth }) => {
  for (const width of [390, 768, 1366]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await navigate("index.html");
    assert.ok(await evaluate('marketplaceEntries(seedProviders).some(p=>p.id===ownProviderId())'), "Own listings remain in the marketplace");
    assert.ok(await evaluate('Array.from(document.querySelectorAll("#marketplace-grid [data-profile]")).some(e=>e.dataset.profile===ownProviderId())'), "Own listings are rendered, not silently filtered out");
    for (const theme of ["light", "dark"]) {
      await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
      for (const page of ["home", "bookings", "messages", "saved", "provider", "earnings", "profile-settings", "activity"]) {
        await evaluate(`showPage(${JSON.stringify(page)});scrollTo(0,0)`);
        await wait(300);
        await checkWidth(`fixture:${page}:${theme}:${width}`);
        assert.equal(await evaluate('document.querySelectorAll(".view.active-view").length'), 1);
        const missingNames = await evaluate(`Array.from(document.querySelectorAll('.active-view button,.active-view input:not([type=hidden]),.active-view select,.active-view textarea')).filter(e=>e.getClientRects().length&&!e.closest('[aria-hidden=true]')&&!e.textContent.trim()&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!e.title&&!e.labels?.length).map(e=>e.id||e.className)`);
        assert.deepEqual(missingNames, [], `Accessible control names: ${page}`);
        const contrast = await evaluate(`(()=>{
          const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
          const rgba=c=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=c;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v);};
          const blend=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
          const luminance=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
          const selectors='.active-view .provider-description,.active-view .view-heading p,.active-view .empty-card small,.active-view .settings-form label,.active-view .booking-note,.active-view .activity-explanation';
          return [...document.querySelectorAll(selectors)].filter(e=>e.getClientRects().length&&e.textContent.trim()).flatMap(e=>{
            let layers=[],node=e;while(node){const st=getComputedStyle(node);if(st.backgroundImage!=='none')return [];layers.unshift(rgba(st.backgroundColor));node=node.parentElement;}
            let bg=[255,255,255];for(const layer of layers)bg=blend(layer,bg);
            const fg=blend(rgba(getComputedStyle(e).color),bg),a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
            return ratio<4.5?[{text:e.textContent.trim().slice(0,55),ratio:Math.round(ratio*100)/100}]:[];
          });})()`);
        assert.deepEqual(contrast, [], `Normal text contrast >=4.5:1: ${page}:${theme}`);
        if (width !== 768 && (theme === "light" || ["home", "messages", "profile-settings"].includes(page))) await screenshot(`fixture-${page}-${theme}-${width}`);
      }
    }
    await navigate("onboarding.html");
    await checkWidth(`fixture:onboarding:${width}`);
    await screenshot(`fixture-onboarding-${width}`);
    console.log(`PASS isolated layout, control names, sampled contrast and own-listing checks: ${width}px`);
  }
};
