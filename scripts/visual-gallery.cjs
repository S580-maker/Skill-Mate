// Assemble real browser captures into review sheets and a navigable local gallery.
const fs = require('node:fs');
const path = require('node:path');
const { start } = require('../tests/support/loading-harness.cjs');
const folder = path.resolve(__dirname, '../docs/modernization');
const groups = [['landing','login','signup'],['onboarding','discover','activity'],['bookings','messages','saved'],['listings','earnings','settings'],['provider','booking-form','admin'],['recovery','reset','privacy'],['terms']];
(async () => {
 const h = await start();
 try {
  await h.call('Page.navigate',{url:'about:blank'});
  await h.viewport(1360,1595);
  for(const stage of ['before','after']) for(const theme of ['light','dark']) for(let i=0;i<groups.length;i++) {
   const rows=groups[i].map(name=>'<section>'+[375,768,1280].map(width=>{
    const file=`${stage}-${name}-${theme}-${width}.png`;
    const src=fs.readFileSync(path.join(folder,'screenshots',file)).toString('base64');
    return `<figure style="width:${width*.55}px"><figcaption>${name} · ${width}px · ${theme} · ${stage}</figcaption><img src="data:image/png;base64,${src}" width="${width*.55}" height="495"></figure>`;
   }).join('')+'</section>').join('');
   const html=`<html><head><style>*{box-sizing:border-box}body{margin:0;background:#ddd;font:12px system-ui}section{display:flex;gap:8px;margin-bottom:12px}figure{margin:0}figcaption{height:24px;padding:4px;background:#fff}img{display:block}</style></head><body>${rows}</body></html>`;
   const {frameTree}=await h.call('Page.getFrameTree');
   await h.call('Page.setDocumentContent',{frameId:frameTree.frame.id,html});
   await h.waitFor('[...document.images].every(img=>img.complete)');
   await h.evaluate('Promise.all([...document.images].map(img=>img.decode()))');
   await h.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
   await h.screenshot(path.join(folder,'screenshots',`sheet-${stage}-${theme}-${i+1}.png`));
  }
  const rows=groups.flat().map(name=>`<section><h2>${name}</h2>`+['light','dark'].map(theme=>`<h3>${theme}</h3>`+[375,768,1280].map(width=>`<details><summary>${width}px — before / after</summary><div class="pair">`+['before','after'].map(stage=>`<figure><figcaption>${stage}</figcaption><a href="screenshots/${stage}-${name}-${theme}-${width}.png"><img loading="lazy" src="screenshots/${stage}-${name}-${theme}-${width}.png"></a></figure>`).join('')+'</div></details>').join('')).join('')+'</section>').join('');
  fs.writeFileSync(path.join(folder,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Skillmate modernization review</title><style>body{font:16px system-ui;max-width:1440px;margin:24px auto;padding:16px;background:#f7f4ec;color:#172033}.pair{display:flex;gap:16px;align-items:start}.pair figure{width:50%;margin:0}.pair img{width:100%;height:auto}summary{cursor:pointer;padding:12px}section{border-bottom:1px solid #ccc;padding:16px 0}</style><h1>Skillmate — before and after</h1><p>Real Chromium screenshots, local fixture data. Three widths, both themes. Click an image to inspect the full resolution capture.</p>${rows}</html>`);
  console.log(`Wrote visual gallery and ${groups.length*4} review sheets.`);
 } finally { await h.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
