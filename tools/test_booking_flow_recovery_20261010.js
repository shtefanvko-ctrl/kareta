'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..');
const src=p=>fs.readFileSync(path.join(root,p),'utf8');

function memoryStorage(){
  const data=new Map();
  return {
    getItem:key=>data.has(key)?data.get(key):null,
    setItem:(key,val)=>data.set(key,String(val)),
    removeItem:key=>data.delete(key)
  };
}
function buildClient(){
  const storage=memoryStorage();
  const win={
    KaretaRuntimeDependencies:{missing:()=>[]},
    KaretaApiClient:{},
    KaretaClientCabinetApi:{},
    KaretaPageUI:{escHtml:s=>String(s)},
    KaretaNavigationCore:{interfaceRole:()=> 'client',contextKind:()=> 'personal'}
  };
  const context={window:win,document:{currentScript:{src:'test'}},sessionStorage:storage,Date,Intl,console,URLSearchParams};
  vm.createContext(context);
  vm.runInContext(src('js/next/pages/client_request_final.js'),context);
  return {window:win,storage,context};
}
async function run(){
  const app=buildClient();
  const key='kareta.request.prefill',draftKey='kareta.request.final.v6';
  const booking={bookingContextId:'booking-1',source:'master_booking',providerType:'master',
    masterId:'real-master-101',masterName:'Test Master',serviceId:'svc-101',
    serviceName:'Brake service',date:'2026-10-12',time:'14:30',timeMode:'exact',
    city:'Усть-Каменогорск',offerId:42};
  app.storage.setItem(key,JSON.stringify(booking));
  let d=app.window.KaretaClientRequestFinalPages.readDraft();
  assert.strictEqual(d.masterId,booking.masterId);
  assert.strictEqual(d.offerMode,'direct');
  assert.strictEqual(d.services[0].id,booking.serviceId);
  assert.strictEqual(d.services[0].name,booking.serviceName);
  assert.strictEqual(d.serviceDate,booking.date);
  assert.strictEqual(d.time.from,booking.time);
  assert.strictEqual(d.time.mode,'exact');
  assert.strictEqual(d.offerId,'42');
  assert.strictEqual(d.source,'master_booking');
  assert.strictEqual(d.city,booking.city);

  d.problem='Retained user edit';
  app.storage.setItem(draftKey,JSON.stringify(d));
  const same=app.window.KaretaClientRequestFinalPages.readDraft();
  assert.strictEqual(same.problem,'Retained user edit','reopen must preserve edits');
  assert.strictEqual(same.idempotencyKey,d.idempotencyKey,'render must not regenerate idempotency');
  const html=app.window.KaretaClientRequestFinalPages.renderClientRequest({windowMode:true});
  assert(html.includes('Brake service')&&html.includes('Test Master'),'booking labels rendered');

  const next={...booking,bookingContextId:'booking-2',masterId:'real-master-202',masterName:'New Master',
    serviceId:'svc-202',serviceName:'New service',date:'2026-10-13',time:'09:30'};
  app.storage.setItem(key,JSON.stringify(next));
  const changed=app.window.KaretaClientRequestFinalPages.readDraft();
  assert.strictEqual(changed.masterId,next.masterId,'new selection must win old draft');
  assert.strictEqual(changed.services[0].id,next.serviceId);
  assert.strictEqual(changed.serviceDate,next.date);
  assert.strictEqual(changed.time.from,next.time);
  assert.notStrictEqual(changed.idempotencyKey,d.idempotencyKey,'new booking gets new key');
  assert.strictEqual(changed.problem,'Retained user edit','user description should survive');

  app.window.KaretaPageUI.pageShell=(context,title,desc,content)=>content;
  vm.runInContext(src('js/next/pages/request.js'),app.context);
  assert(app.window.KaretaRequestPages.renderRequest({}).includes('k-client-request-final'),'page routes to new client');
  assert(app.window.KaretaRequestPages.renderRequestWindow({}).includes('k-client-request-final'),'modal routes to new client');
  app.window.KaretaNavigationCore.contextKind=()=> 'master';
  assert(app.window.KaretaRequestPages.renderRequest({}).includes('data-request-form'),'master legacy remains');

  const slotStorage=memoryStorage();
  let handler,slotCalls=0,windowCalls=0;
  const timeBox={innerHTML:''},btn={disabled:true};
  const domRoot={
    innerHTML:'',
    querySelector:sel=>sel==='[data-book-time]'?timeBox:sel==='[data-book-continue]'?btn:null,
    querySelectorAll:()=>[],
    addEventListener:(name,cb)=>{if(name==='click')handler=cb;}
  };
  const api={
    getProviderDetail:async()=>({ok:true,payload:{data:{provider:{name:'Provider 101',city:'Усть-Каменогорск'},
      offers:[{id:48,service_id:'svc-101',service_name:'Brake service',price:10000}]}}}),
    getBookingSlots:async()=>{slotCalls++;return {ok:true,payload:{data:{slots:[{value:'14:30',label:'14:30'}]}}};}
  };
  const detailWindow={KaretaApiClient:api,KaretaRequestWindow:{open:()=>{windowCalls++;return true;}}};
  const detailContext={
    window:detailWindow,
    document:{querySelector:()=>domRoot},
    location:{hash:'#/masters/book/master/real-master-101'},
    sessionStorage:slotStorage,Intl,Date,console,URLSearchParams
  };
  vm.createContext(detailContext);
  vm.runInContext(src('js/next/pages/details.js'),detailContext);
  await detailWindow.KaretaDetailPages.mountProviderBooking({lifecycle:{signal:new AbortController().signal}});
  assert(domRoot.innerHTML.includes('data-book-service-option'),'booking has explicit service selector');
  assert.strictEqual(slotCalls,0,'slot fetch waits for selected service');
  assert(btn.disabled,'booking cannot continue without service');
  const click=async (selector,dataset={})=>handler({target:{closest:q=>q===selector?{dataset}:null}});
  await click('[data-book-service-option]',{bookServiceOption:'svc-101'});
  assert.strictEqual(slotCalls,1);
  await click('[data-book-slot]',{bookSlot:'14:30'});
  await click('[data-book-continue]');
  assert.strictEqual(slotCalls,2,'recheck slots at confirmation');
  assert.strictEqual(windowCalls,1);
  const saved=JSON.parse(slotStorage.getItem('kareta.request.prefill'));
  assert.strictEqual(saved.masterId,'real-master-101');
  assert.strictEqual(saved.serviceId,'svc-101');
  assert.strictEqual(saved.time,'14:30');
  assert.strictEqual(saved.offerId,48);

  // Mount the new client flow and send a mocked order, asserting actual API payload.
  const formApp=buildClient(), fStorage=formApp.storage;
  fStorage.setItem(key,JSON.stringify(booking));
  const handlers={},nodes=new Map();
  const mkNode=()=>({innerHTML:'',textContent:'',disabled:false,hidden:false,addEventListener:()=>{},
    querySelector:()=>null});
  const BaseElement=class {};
  const formRoot=new BaseElement();
  formRoot.querySelector=sel=>{if(sel==='[data-client-request-final]')return formRoot;if(!nodes.has(sel))nodes.set(sel,mkNode());return nodes.get(sel);};
  formRoot.addEventListener=(name,cb)=>{handlers[name]=cb;};
  formRoot.removeEventListener=()=>{};
  formApp.context.Element=BaseElement;
  const sent=[];
  Object.assign(formApp.window.KaretaApiClient,{
    getServicesCatalog:async()=>({payload:{data:{services:[{id:'svc-101',name:'Brake service'}]}}}),
    getMastersCatalog:async()=>({payload:{data:{masters:[{id:'real-master-101',name:'Test Master'}]}}}),
    createOrder:async(order,opts)=>{sent.push({order,opts});return {ok:true,payload:{order:{id:'ORDER-MOCK'}}};}
  });
  formApp.window.KaretaClientCabinetApi.get=async()=>({payload:{data:{vehicles:[{id:'vehicle-1',title:'Test car',is_default:1}]}}});
  const mounted=await formApp.window.KaretaClientRequestFinalPages.mountClientRequest({
    root:formRoot,lifecycle:{signal:new AbortController().signal}
  });
  const nextClick=()=>handlers.click({target:{closest:sel=>sel==='[data-cr-next]'?{}:null}});
  await nextClick(); // Direct provider -> city/time.
  await nextClick(); // City/time -> confirmation.
  handlers.input({target:{matches:sel=>sel==='[data-client-request-consent]',checked:true}});
  await nextClick();
  assert.strictEqual(sent.length,1);
  assert.strictEqual(sent[0].order.masterId,'real-master-101');
  assert.strictEqual(sent[0].order.serviceIds[0],'svc-101');
  assert.strictEqual(sent[0].order.date,'2026-10-12');
  assert.strictEqual(sent[0].order.time,'14:30');
  assert.strictEqual(sent[0].order.timeMode,'exact');
  assert.strictEqual(sent[0].order.offerId,'42');
  assert.strictEqual(sent[0].order.bookingRequired,true);
  assert.strictEqual(fStorage.getItem(key),null,'prefill must clear after success');
  mounted();
  const reg=src('inc/asset_registry.php'),server=src('api/db.php');
  assert(reg.includes("'js/next/pages/client_request_final.js', 'js/next/pages/request.js'"));
  assert(server.includes("booking_slot_conflict")&&server.includes("FOR UPDATE"),'server must serialize booking writes');
  console.log('BOOKING FLOW: prefill, re-entry, exact slot, explicit service, modal/page, non-client, backend gate PASS');
}
run().catch(e=>{console.error(e);process.exitCode=1});
