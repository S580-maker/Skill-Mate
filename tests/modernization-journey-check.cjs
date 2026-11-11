// Real browser and application code; all writes use the local fixture transport.
const assert = require("node:assert/strict");
const path = require("node:path");
const { start } = require("./support/loading-harness.cjs");
const baseline = process.argv.includes("--baseline");

(async () => {
  const h = await start();
  const run = source => h.evaluate(`(async()=>{${source}})()`);
  const ready = async () => {
    await h.open("index.html#home");
    await h.waitFor('!document.body.classList.contains("app-auth-pending")');
  };
  async function check(name, assertion) {
    try { await assertion(); console.log(`PASS ${name}`); }
    catch (error) { if (!baseline) throw error; console.log(`CONFIRMED ${name}: ${error.message}`); }
  }
  try {
    await h.viewport(375);
    await ready();
    await run(`window.__offers=[];const rpc=appSupabase.rpc;
      appSupabase.rpc=(name,args)=>name==='start_conversation'?Promise.resolve({data:'c1',error:null}):name==='create_price_negotiation'?(window.__offers.push(args),Promise.resolve({data:'n1',error:null})):rpc(name,args);
      connectedServices.find(service=>service.id==='s1').negotiationMode='negotiation';
      openPriceOfferForm({providerId:'p1',serviceId:'s1'});
      document.querySelector('#price-offer-amount').value='19.99';
      document.querySelector('#price-offer-form').requestSubmit();`);
    await h.wait(200);
    await check("a valid GHS 19.99 offer reaches the API", async () => assert.equal(await h.evaluate('window.__offers.length'), 1));
    if (baseline) await h.screenshot(path.resolve("docs/modernization/screenshots/journey-price-before-375.png"));

    await ready();
    await run(`window.__bookingFrom=appSupabase.from;
      appSupabase.from=table=>table==='bookings'?{insert:()=>new Promise(resolve=>{window.__finishBooking=resolve})}:window.__bookingFrom(table);
      openBooking('p1','s1');document.querySelector('#booking-location-type').value='campus';
      document.querySelector('#booking-form').requestSubmit();openBooking('p2','s2');
      document.querySelector('#booking-note').value='Details for the second provider';
      document.querySelector('#booking-note').dispatchEvent(new Event('input',{bubbles:true}));
      window.__finishBooking({error:{message:'Connection interrupted'}});`);
    await h.waitFor('!bookingSubmissionPending');
    await check("an earlier failure does not add retry feedback to another provider's draft", async () => {
      assert.equal(await h.evaluate('document.querySelector("#booking-provider-id").value'), "p2");
      assert.equal(await h.evaluate('Boolean(document.querySelector("#booking-save-status button"))'), false);
    });
    if (baseline) await h.screenshot(path.resolve("docs/modernization/screenshots/journey-booking-before-375.png"));

    await ready();
    await run(`window.__bookingFrom=appSupabase.from;window.__reconcile=reconcileSavedChange;reconcileSavedChange=async()=>{};
      appSupabase.from=table=>table==='bookings'?{insert:()=>new Promise(resolve=>{window.__finishBooking=resolve})}:window.__bookingFrom(table);
      openBooking('p1','s1');document.querySelector('#booking-location-type').value='campus';
      document.querySelector('#booking-note').value='Sent instructions';document.querySelector('#booking-form').requestSubmit();
      openBooking('p1','s1');document.querySelector('#booking-note').value='A new request after the first';
      document.querySelector('#booking-note').dispatchEvent(new Event('input',{bubbles:true}));window.__finishBooking({error:null});`);
    await h.waitFor('!bookingSubmissionPending');
    await check("a confirmed request preserves a newer draft for the same service", async () => {
      assert.equal(await h.evaluate('skillmateJourney.bookingDraft("p1","s1")?.note'), "A new request after the first");
    });

    await ready();
    await run(`window.__firstInserts=[];window.__rpc=appSupabase.rpc;window.__from=appSupabase.from;
      appSupabase.rpc=(name,args)=>name==='start_conversation'?Promise.resolve({data:'c1',error:null}):window.__rpc(name,args);
      appSupabase.from=table=>{
        if(table!=='messages')return window.__from(table);
        let inserting=false;const builder={insert(payload){inserting=true;window.__firstInserts.push(payload);return this},select(){return this},single(){return this},eq(){return this},abortSignal(){return this},
          async maybeSingle(){return {data:{...window.__firstInserts[0],created_at:new Date().toISOString()},error:null}},
          then(resolve,reject){return Promise.resolve(inserting?{data:null,error:window.__firstInserts.length===1?{message:'Connection interrupted'}:{code:'23505'}}:{data:[],error:null}).then(resolve,reject)}};return builder;
      };openMessage('p1');document.querySelector('#message-first-text').value='Is Tuesday available?';
      document.querySelector('#message-form').requestSubmit();`);
    await h.wait(200);
    await check("failed initial messages remain in the same retryable chat outbox", async () => {
      assert.equal(await h.evaluate('document.querySelector("#message-modal").open'), false);
      assert.equal(await h.evaluate('pendingOutgoingMessages.size'), 1);
      assert.match(await h.evaluate('window.__firstInserts[0].id'), /^[0-9a-f-]{36}$/);
    });
    if (!baseline) {
      await run('retryPendingMessage(window.__firstInserts[0].id)');
      await h.waitFor('pendingOutgoingMessages.size===0');
      assert.equal(await h.evaluate('window.__firstInserts.length'), 2);
      assert.equal(await h.evaluate('window.__firstInserts[0].id'), await h.evaluate('window.__firstInserts[1].id'));
      assert.equal(await h.evaluate('state.messages.find(chat=>chat.id==="c1").messages.filter(message=>message.text==="Is Tuesday available?").length'), 1);
      console.log("PASS initial-message retry reconciles the existing ID without a duplicate");
    }

    await ready();
    await run(`window.__createdBlob=null;window.__createObjectURL=URL.createObjectURL;URL.createObjectURL=blob=>{window.__createdBlob=blob;return window.__createObjectURL(blob)};
      window.__anchorClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){};
      const booking=state.bookings.find(item=>item.id==='b3');booking.service='=HYPERLINK("https://example.invalid","Open")';booking.customer='  +1+1';
      document.querySelector('#earnings-export').click();HTMLAnchorElement.prototype.click=window.__anchorClick;`);
    await check("CSV export treats user-supplied formulas as text", async () => {
      const csv = await run('return await window.__createdBlob.text()');
      assert.ok(csv.includes('"\'=HYPERLINK('));
      assert.ok(csv.includes('"\'  +1+1"'));
    });

    if (!baseline) {
      await ready();
      await run(`showPage('activity');document.querySelector('[data-activity-count="bookings"]').closest('a').click();`);
      assert.equal(await h.evaluate('activeBookingFilter'), 'upcoming');
      assert.equal(await h.evaluate('document.activeElement.closest(".view")?.dataset.view'), 'bookings');
      assert.equal(await h.evaluate('document.querySelectorAll("#user-booking-list .booking-card").length'), 2);
      await run(`document.querySelector('.nav-link[data-page="saved"]').click()`);
      assert.equal(await h.evaluate('document.activeElement.closest(".view")?.dataset.view'), 'saved');
      await run(`document.querySelector('.skip-link').focus();document.querySelector('.skip-link').click()`);
      assert.equal(await h.evaluate('document.activeElement.id'), 'main-content');
      console.log('PASS upcoming activity filtering, destination focus and skip navigation');
      await ready();
      await run(`window.__quotes=[];window.__rpc=appSupabase.rpc;window.__from=appSupabase.from;
        appSupabase.rpc=(name,args)=>name==='start_conversation'?Promise.resolve({data:'c1',error:null}):window.__rpc(name,args);
        appSupabase.from=table=>table==='messages'?{insert(payload){window.__quotes.push(payload);return this},select(){return this},single(){return Promise.resolve({data:{...window.__quotes.at(-1),created_at:new Date().toISOString()},error:null})}}:window.__from(table);
        await openServiceDiscussion('p1','s1',null,'A two-hour revision session');`);
      assert.equal(await h.evaluate('window.__quotes.length'), 1);
      assert.equal(await h.evaluate('window.__quotes[0].body'), 'Custom quote request for Calculus and statistics tutoring: A two-hour revision session');
      assert.match(await h.evaluate('window.__quotes[0].id'), /^[0-9a-f-]{36}$/);
      console.log('PASS scoped quote requests retain their text through the retryable message queue');
      await ready();
      await run(`window.__startCalls=0;window.__rpc=appSupabase.rpc;appSupabase.rpc=(name,args)=>{if(name==='start_conversation')window.__startCalls++;return window.__rpc(name,args)};
        openMessage('p1');document.querySelector('#message-first-text').value='   ';document.querySelector('#message-form').requestSubmit();`);
      await h.wait(80);
      assert.equal(await h.evaluate('window.__startCalls'), 0);
      assert.equal(await h.evaluate('document.activeElement.id'), "message-first-text");
      await run('document.querySelector("#message-modal").close()');
      for (const theme of ["light", "dark"]) for (const width of [375, 768, 1280]) {
        await h.setTheme(theme); await h.viewport(width); await ready();
        await run(`showPage('messages',{openConversation:true});setActiveConversation('c1');renderConversations();`);
        assert.ok(await h.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
        await h.wait(400);
        await h.screenshot(path.resolve(`docs/modernization/screenshots/journey-messages-after-${theme}-${width}.png`));
        await run(`openBooking('p1','s1')`);
        assert.ok(await h.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
        await h.wait(400);
        await h.screenshot(path.resolve(`docs/modernization/screenshots/journey-booking-after-${theme}-${width}.png`));
      }
      assert.deepEqual(h.pageErrors, []);
      console.log("PASS blank initial-message input, responsive booking and message views, and no uncaught browser errors");
    }
  } finally { await h.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
