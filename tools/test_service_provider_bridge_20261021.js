const assert=require('assert');
const {chromium}=require('/home/karetadmin/kareta-test-tools/node_modules/playwright');
const root='/home/karetadmin/kareta-workspace/staging-site/kareta/';
const sampleId='pro_electrical_short_circuit';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/home/karetadmin/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://s.kareta.kz/manifest.json',{waitUntil:'domcontentloaded'});
 await page.setContent('<html><body></body></html>');
 await page.evaluate(()=>{
  window.KaretaRoleAccess={currentRole:()=> 'client'};
  window.KaretaUIIcons={icon:()=>'',svg:()=>''};
  window.__requests=[];window.__results=[];
  window.KaretaApiClient={
    getMastersCatalog:async q=>{window.__requests.push('legacy');return {ok:true,payload:{data:{masters:[{id:'m_legacy',name:'Обычный мастер',availability:'online'}],stations:[]}}};},
    request:async url=>{window.__requests.push(url);return{ok:true,payload:{data:{masters:window.__results,stations:[],metrics:{masters:window.__results.length,stations:0}}}};},
    getProviderDetail:async(_type,id)=>({ok:true,payload:{data:{provider:{id,name:'Тестовый мастер',spec:'Диагностика'},offers:window.__providerOffers||[]}}}),
    getBookingSlots:async params=>{window.__slotServiceId=params.serviceId;return{ok:true,payload:{data:{slots:[{value:'11:00',label:'11:00'}]}}};}
  };
  window.KaretaRequestWindow={open:()=>true};
  window.KaretaToast={error:()=>{},success:()=>{}};
 });
 await page.addScriptTag({path:root+'js/next/pages/masters.js'});
 await page.evaluate(()=>{location.hash='#/masters?serviceId=pro_electrical_short_circuit';document.body.innerHTML=window.KaretaMastersPages.renderMasters();window.KaretaMastersPages.mountMasters({lifecycle:{signal:new AbortController().signal}});});
 await page.waitForFunction(()=>document.querySelector('[data-masters-directory]')?.textContent?.includes('По этой услуге пока нет исполнителей'));
 let result=await page.evaluate(()=>({text:document.querySelector('[data-masters-directory]').textContent,requests:window.__requests.slice()}));
 assert(result.requests[0].includes('masters_by_service.php?'),'Filtered route must use strict provider endpoint');
 assert(!result.text.includes('Обычный мастер'),'No fallback to unrelated master');
 console.log('PASS: filtered empty service result is honest');
 await page.evaluate(()=>{
  window.__results=[{id:'m_test',name:'Проверенный мастер',spec:'Электрика',availability:'online',availabilityLabel:'График уточняется при записи',offerCount:1,minPrice:null}];
  document.body.innerHTML=window.KaretaMastersPages.renderMasters();
  window.KaretaMastersPages.mountMasters({lifecycle:{signal:new AbortController().signal}});
 });
 await page.waitForFunction(()=>document.querySelector('[data-master-card="m_test"]')!==null);
 result=await page.evaluate(()=>({href:document.querySelector('[data-master-card="m_test"] .k-master-reference-action-primary').getAttribute('href'),body:document.querySelector('[data-master-card="m_test"]').textContent}));
 assert(result.href.includes('serviceId='+sampleId),'Booking link must retain serviceId');
 assert(!result.body.includes('1 000 ₸'),'Must not invent price from missing offer price');
 console.log('PASS: verified provider card preserves selected serviceId');
 await page.evaluate(()=>{location.hash='#/masters';window.__requests=[];document.body.innerHTML=window.KaretaMastersPages.renderMasters();window.KaretaMastersPages.mountMasters({lifecycle:{signal:new AbortController().signal}});});
 await page.waitForFunction(()=>document.querySelector('[data-master-card="m_legacy"]')!==null);
 result=await page.evaluate(()=>({req:window.__requests[0],href:document.querySelector('[data-master-card="m_legacy"] .k-master-reference-action-primary').getAttribute('href')}));
 assert.strictEqual(result.req,'legacy','Normal catalog must be untouched');
 assert(!result.href.includes('serviceId='),'No phantom service selection');
 console.log('PASS: generic masters catalog remains unchanged');
 await page.addScriptTag({path:root+'js/next/pages/details.js'});
 await page.evaluate(()=>{
  location.hash='#/masters/book/master/m_test?serviceId=pro_electrical_short_circuit';
  window.__providerOffers=[{service_id:'another_service',service_name:'Другая работа'},{service_id:'pro_electrical_short_circuit',service_name:'Поиск короткого замыкания'}];
  document.body.innerHTML='<div id="k-page-outlet">'+window.KaretaDetailPages.renderProviderBooking()+'</div>';
 });
 await page.evaluate(()=>window.KaretaDetailPages.mountProviderBooking({lifecycle:{signal:new AbortController().signal}}));
 await page.waitForFunction(()=>window.__slotServiceId==='pro_electrical_short_circuit');
 result=await page.evaluate(()=>({label:document.querySelector('[data-book-service]').textContent,slotServiceId:window.__slotServiceId}));
 assert(result.label.includes('Поиск короткого замыкания'),'Selected service should be reflected in booking');
 assert.strictEqual(result.slotServiceId,sampleId,'Slots must check chosen service');
 console.log('PASS: booking uses exact selected service instead of first offer');
 await page.evaluate(()=>{
  location.hash='#/masters/book/master/m_test?serviceId=pro_electrical_short_circuit';
  window.__providerOffers=[{service_id:'another_service',service_name:'Другая работа'}];
  document.body.innerHTML='<div id="k-page-outlet">'+window.KaretaDetailPages.renderProviderBooking()+'</div>';
 });
 await page.evaluate(()=>window.KaretaDetailPages.mountProviderBooking({lifecycle:{signal:new AbortController().signal}}));
 await page.waitForFunction(()=>document.querySelector('#k-page-outlet')?.textContent?.includes('больше не оказывает выбранную услугу'));
 assert.strictEqual(errors.length,0,'Browser errors: '+errors.join(' | '));
 console.log('PASS: missing offer fails closed; no page errors');
 await browser.close();
})().catch(e=>{console.error('FAIL:',e.stack||e);process.exitCode=1;});
