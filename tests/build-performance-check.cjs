// A local comparative benchmark, not a field Core Web Vitals assessment.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { start } = require('./support/loading-harness.cjs');
const output = path.resolve(__dirname,'../docs/modernization/performance.json');
const root = path.resolve(__dirname,'..');
(async()=>{
 const samples=[];
 for (let round=0;round<3;round++) for(const mode of ['source','built']) {
  process.env.SKILLFLEX_TEST_ROOT=mode==='built'?path.join(root,'dist/public'):root;
  const h=await start();
  try {
   await h.viewport(375,900);
   await h.setTheme('light');
   await h.call('Network.enable');
   await h.call('Network.setCacheDisabled',{cacheDisabled:true});
   await h.call('Network.emulateNetworkConditions',{offline:false,latency:60,downloadThroughput:300000,uploadThroughput:125000});
   await h.call('Emulation.setCPUThrottlingRate',{rate:4});
   await h.call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__perf={lcp:0,cls:0};new PerformanceObserver(list=>list.getEntries().forEach(e=>window.__perf.lcp=e.startTime)).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(list=>list.getEntries().forEach(e=>{if(!e.hadRecentInput)window.__perf.cls+=e.value})).observe({type:'layout-shift',buffered:true});document.addEventListener('skillflex:workspace-ready',()=>window.__perf.ready=performance.now(),{once:true});`});
   await h.open('index.html#home');
   await h.waitFor('window.__perf.ready',30000);
   await h.evaluate('document.fonts.ready');await h.wait(1000);
   const metrics=await h.evaluate(`({...window.__perf,css:performance.getEntriesByType('resource').filter(r=>/\\.css(?:\\?|$)/.test(r.name)).map(r=>({file:new URL(r.name).pathname,bytes:r.decodedBodySize})),js:performance.getEntriesByType('resource').filter(r=>/\\.js(?:\\?|$)/.test(r.name)).reduce((sum,r)=>sum+r.decodedBodySize,0)})`);
   assert.deepEqual(h.pageErrors,[]);
   samples.push({mode,round,...metrics});
   console.log(`${mode} run${round+1}: ready ${Math.round(metrics.ready)}ms, LCP ${Math.round(metrics.lcp)}ms, CLS ${metrics.cls.toFixed(4)}, CSS ${metrics.css.length} requests`);
  } finally {await h.close();}
 }
 const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
 const summary=Object.fromEntries(['source','built'].map(mode=>{const rows=samples.filter(s=>s.mode===mode);return[mode,{readyMs:median(rows.map(s=>s.ready)),lcpMs:median(rows.map(s=>s.lcp)),cls:median(rows.map(s=>s.cls)),cssRequests:rows[0].css.length,cssBytes:rows[0].css.reduce((sum,r)=>sum+r.bytes,0),jsBytes:rows[0].js}]}));
 fs.writeFileSync(output,JSON.stringify({conditions:'Chromium,375x900,4x CPU throttle,60ms latency,300000 bytes/s download,cold browser/cache,local fake Supabase,3 alternating runs per mode. Source and built use identical current functionality. No HTTP compression; fixture replaces Supabase SDK/client. Not field CWV; no INP claim.',summary,samples},null,2));
 console.log(JSON.stringify(summary));
})().catch(error=>{console.error(error);process.exitCode=1});
