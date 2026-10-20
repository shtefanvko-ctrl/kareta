const assert=require('assert');
const {chromium}=require('/home/karetadmin/kareta-test-tools/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/home/karetadmin/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('about:blank');
 await page.evaluate(()=>{
   const catalog=[
     {id:'engine_oil',name:'Замена моторного масла',category:'maintenance',shortDesc:'ТО',basePrice:8000,avgTime:'30 мин'},
     {id:'pro_electrical_short_circuit',name:'Поиск короткого замыкания',category:'electrical',shortDesc:'Проверка проводки',basePrice:0,avgTime:''}
   ];
   window.__saved=[];
   window.__snapshot={status:'ready',context:{ownerUserId:1,ownerEntityId:'master-1',city:'Усть-Каменогорск'},catalog,offers:[]};
   window.KaretaPageUI={escHtml:x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),pageShell:(_ctx,_title,_subtitle,html)=>'<main data-page="service-management">'+html+'</main>'};
   window.KaretaServiceOffersState={
     getSnapshot:()=>window.__snapshot,subscribe:fn=>(fn(window.__snapshot),()=>{}),
     load:async()=>window.__snapshot,cancel:()=>{},
   };
   window.KaretaServiceOffersApi={
     save:async offer=>{window.__saved.push(offer);return offer;},
     remove:async()=>{}
   };
   window.KaretaRoleAccess={currentRole:()=> 'master'};
   window.KaretaApiClient={request:async url=>{
     if(url.includes('action=professions'))return {ok:true,payload:{data:{selection:['auto_electrician']}}};
     if(url.includes('professional_service_matrix.php'))return {ok:true,payload:{data:{serviceIds:['pro_electrical_short_circuit'],suggestionsOnly:true}}};
     return {ok:false,payload:{}};
   }};
   window.KaretaUIIcons={svg:()=>''};
   window.KaretaMasterSetupPicker={mount:()=>{}};
   window.KaretaMasterProfessionPicker={mount:()=>{}};
   window.KaretaToast={success:()=>{},error:()=>{}};
 });
 await page.addScriptTag({path:'/home/karetadmin/kareta-workspace/staging-site/kareta/js/next/pages/service_management.js'});
 await page.evaluate(()=>{
   document.body.innerHTML=window.KaretaServiceManagementPages.renderServiceManagement({role:'master'});
   window.KaretaServiceManagementPages.mountServiceManagement({lifecycle:{signal:new AbortController().signal,addCleanup:()=>{}}});
 });
 await page.waitForFunction(()=>document.querySelector('[data-master-professional-filter]')?.disabled===false,{timeout:3000});
 let v=await page.evaluate(()=>({
   all:document.querySelectorAll('[data-master-service-row]').length,
   button:document.querySelector('[data-master-professional-filter]')?.textContent
 }));
 assert.strictEqual(v.all,2,'Original full catalog must remain visible');
 await page.locator('.k-master-service-editor summary').click();
 await page.locator('[data-master-professional-filter]').click();
 v=await page.evaluate(()=>({
   rows:[...document.querySelectorAll('[data-master-service-row]')].map(e=>e.dataset.masterServiceRow),
   pressed:document.querySelector('[data-master-professional-filter]').getAttribute('aria-pressed')
 }));
 assert.deepStrictEqual(v.rows,['pro_electrical_short_circuit'],'Profession filter should show relevant service only');
 assert.strictEqual(v.pressed,'true');
 await page.locator('[data-master-service-enabled="pro_electrical_short_circuit"]').check();
 await page.locator('[data-master-services-save]').click();
 let result=await page.evaluate(()=>({saved:window.__saved.length,status:document.querySelector('[data-service-offers-status]')?.textContent}));
 assert.strictEqual(result.saved,0,'Cannot publish unknown duration');
 assert.ok(result.status.includes('Укажите время'),'Validation should request real duration');
 await page.locator('[data-master-service-duration="pro_electrical_short_circuit"]').fill('45');
 await page.locator('[data-master-services-save]').click();
 result=await page.evaluate(()=>({saved:window.__saved,errors:[]}));
 assert.strictEqual(result.saved.length,1,'One service offer is expected');
 assert.strictEqual(result.saved[0].priceType,'agreement','No fabricated zero fixed price');
 assert.strictEqual(result.saved[0].durationMin,45,'Confirmed time must be preserved');
 await browser.close();
 assert.strictEqual(errors.length,0,'Browser runtime errors: '+errors.join('; '));
 console.log('PASS: full catalog preserved, optional profession recommendations, duration required, price agreement, no page errors');
})().catch(e=>{console.error('FAIL',e.stack||e);process.exit(1);});
