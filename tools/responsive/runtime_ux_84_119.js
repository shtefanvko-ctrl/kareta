'use strict';
const fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const out='C:/Temp/KARETA_RUNTIME_UX_84_119';
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const context={id:910000,key:'profile:master:910000',type:'profile',profileType:'master',label:'Мастер'};
const caps=['profile.master','work_orders.read','work_order.read','requests.read','requests.create','chat.use','calendar.read','calendar.manage_own','profile.edit_own'];
const identity={authenticated:true,mode:'identity',compatibilityRole:'master',account:{id:900000,name:'Responsive Master',status:'active'},session:{id:'fixture',contextRevision:1},contexts:[context],context,currentContext:context,capabilities:caps,deniedCapabilities:[],accountTypes:[{role:'master',status:'active'}],sessionContext:{contextRevision:1}};
const legacy={ok:true,authenticated:true,user:{id:900000,name:'Responsive Master',phone:'77000000000',role:'master',entry_role:'master',onboarded:1,onboarding_stage:'done',active:1,city:'Усть-Каменогорск',initials:'RM'},access:{role:'master',defaultRoute:'masterDashboard',routes:['masterDashboard','masterProfileOwner','masterSchedule','orders','requestNew','chats','serviceManagement','following','cabinetSettings','providerDetail'],capabilities:caps},dbReady:true,fixture:true};
const workplace={ok:true,data:{master:{id:'910000',name:'Responsive Master',availability:'online'},activeOrders:[],waitingOrders:[],todayOrders:[],timers:[],preferences:{windows:{status:true,attention:true,nextOrder:true,newAccepted:true,todayQueue:true,upcoming:true},params:{upcomingLimit:6,autoRefreshSec:0,compactCards:false}}}};
const ownerProfile={ok:true,data:{profile:{id:'910000',name:'Responsive Master',spec:'Автоэлектрик-диагност',city:'Усть-Каменогорск',district:'Центр',workMode:'shop',serviceAddress:'Тестовая мастерская',profileVisible:true,experienceLabel:'8 лет',description:'Диагностика и ремонт электрооборудования.',primaryServices:['Компьютерная диагностика','Автоэлектрика'],brands:['Toyota','Lexus'],equipment:['Launch X431'],skills:['CAN-диагностика'],certificates:[],languages:['Русский','Қазақша']},counts:{services:2,works:4,reviews:7},readiness:{percent:100,completed:5,total:5},publicUrl:'#/masters/profile/master/910000'}};
const provider={ok:true,data:{provider:{id:'910000',name:'Responsive Master',spec:'Автоэлектрик-диагност',city:'Усть-Каменогорск',district:'Центр',work_mode:'shop',service_address:'Тестовая мастерская',rating:4.9,reviews_count:7,availability:'online',description:'Диагностика и ремонт электрооборудования.',experience_label:'8 лет',primary_services:['Компьютерная диагностика','Автоэлектрика'],brands:['Toyota','Lexus'],equipment:['Launch X431'],skills:['CAN-диагностика'],languages:['Русский','Қазақша']},offers:[],reviews:[],works:[],news:[],wallPosts:[],reviewSummary:{rating:4.9,total:7},socialState:{following:false},socialCounts:{followers:0}}};
const serviceMine={ok:true,data:{context:{role:'master',ownerType:'master',ownerUserId:900000,ownerEntityId:'910000',city:'Усть-Каменогорск',label:'Responsive Master'},catalog:[{id:'svc_diag',category:'diagnostics',icon:'⚙',name:'Компьютерная диагностика',basePrice:10000,avgTime:'60 мин'}],offers:[{id:1,serviceId:'svc_diag',ownerType:'master',ownerUserId:900000,ownerEntityId:'910000',ownerName:'Responsive Master',city:'Усть-Каменогорск',price:10000,priceType:'fixed',durationMin:60,warrantyDays:0,availabilityStatus:'available',bookingEnabled:true,active:true,moderationStatus:'approved'}],metrics:{catalogCount:1,configuredCount:1,activeCount:1}}};
const chats={ok:true,chats:[{id:'chat_fixture_1',chatType:'order',orderId:'ord_fixture_1',orderTitle:'Toyota Camry · диагностика',clientName:'Клиент Тест',masterName:'Responsive Master',masterId:'910000',lastMessage:'Добрый день, когда можно приехать?',lastTime:'17:55',participantUnread:2}]};
const messages={ok:true,messages:[{id:'msg_fixture_1',chatId:'chat_fixture_1',authorUserId:800001,authorName:'Клиент Тест',from:'client',type:'text',text:'Добрый день, когда можно приехать?',time:'17:55',deliveryStatus:'read'}]};
const json=(req,obj,status=200)=>req.respond({status,contentType:'application/json',body:JSON.stringify(obj)});
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const events=[],checks=[],requests=[];let documentRequests=0;
 const check=(name,pass,detail={})=>{checks.push({name,pass:Boolean(pass),detail});if(!pass)console.error('FAIL',name,JSON.stringify(detail));else console.log('PASS',name);};
 try{
  const page=await browser.newPage();
  await page.setBypassServiceWorker(true);await page.setCacheEnabled(false);await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.setRequestInterception(true);
  page.on('request',req=>{
   try{
    const u=new URL(req.url()),method=req.method();
    if(req.isNavigationRequest()&&req.resourceType()==='document')documentRequests++;
    if(u.hostname==='localhost'&&u.pathname.startsWith('/api/'))requests.push({method,path:u.pathname,action:u.searchParams.get('action')||''});
    if(method==='GET'&&u.pathname==='/api/auth_session.php')return json(req,legacy);
    if(method==='GET'&&u.pathname==='/api/identity_session.php')return json(req,identity);
    if(method==='GET'&&u.pathname==='/api/master_onboarding.php'&&u.searchParams.get('action')==='current')return json(req,{ok:true,status:'completed',contextId:'910000',currentStep:4,currentView:'review'});
    if(method==='GET'&&u.pathname==='/api/realtime.php')return req.respond({status:200,contentType:'text/event-stream',body:': fixture heartbeat\\n\\n'});
    if(u.pathname==='/api/db.php'&&method==='GET'){
      const a=u.searchParams.get('action')||'';
      if(a==='masterWorkplace.get')return json(req,workplace);
      if(a==='masterProfile.get')return json(req,ownerProfile);
      if(a==='providers.detail')return json(req,provider);
      if(a==='serviceOffers.mine')return json(req,serviceMine);
      if(a==='services.catalog')return json(req,{ok:true,data:{services:serviceMine.data.catalog}});
      if(a==='masters.catalog')return json(req,{ok:true,data:{masters:[]}});
      if(a==='pull')return json(req,{ok:true,users:[],masters:[],services:[],parts:[],orders:[],chats:[],news:[],workPosts:[]});
    }
    if(u.pathname==='/api/db.php'&&method==='POST'){
      let body={};try{body=JSON.parse(req.postData()||'{}')}catch(_e){}
      if(body.action==='chats.getAll')return json(req,chats);
      if(body.action==='messages.get')return json(req,messages);
      if(body.action==='chats.markRead')return json(req,{ok:true,chatId:body.chatId,unread:0});
      if(body.action==='chats.contacts')return json(req,{ok:true,contacts:[]});
      return json(req,{ok:true,fixture:true});
    }
    if(method==='POST'&&u.pathname.startsWith('/api/'))return json(req,{ok:true,fixture:true});
    if(method==='GET'&&u.pathname==='/api/domain.php')return json(req,{ok:true,data:{}});
    req.continue();
   }catch(e){try{req.continue()}catch(_e){}}
  });
  page.on('console',m=>{if(['error','warn'].includes(m.type()))events.push({kind:'console',level:m.type(),text:m.text()})});
  page.on('pageerror',e=>events.push({kind:'pageerror',message:e.message}));
  page.on('requestfailed',r=>events.push({kind:'requestfailed',url:r.url(),failure:r.failure()}));
  page.on('response',r=>{if(r.status()>=400)events.push({kind:'http',status:r.status(),url:r.url()})});
  await page.goto('http://localhost/?ux84_119='+Date.now()+'#/master',{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>window.KaretaNext?.audit?.().ok===true,{timeout:20000});
  await page.waitForFunction(()=>window.KaretaIdentity?.snapshot?.().compatibilityRole==='master',{timeout:10000});
  await page.evaluate(()=>{window.KaretaOnboardingApp?.setActive?.(false);document.getElementById('onb2-overlay')?.remove();document.getElementById('onboarding-welcome')?.remove();window.KaretaRouteRuntime?.transition?.('masterDashboard',{source:'ux84-119',force:true});});
  await page.waitForFunction(()=>document.querySelector('#k-master-workplace')?.dataset.phase==='ready',{timeout:12000});
  check('initial_master_without_reload',documentRequests===1,{documentRequests,route:await page.evaluate(()=>document.querySelector('#k-page-outlet')?.dataset.currentRoute)});
  const mobileNav=await page.evaluate(()=>[...document.querySelectorAll('#k-mobile-nav .k-nav-link')].map(x=>({key:x.dataset.routeKey||x.dataset.routeLink||(x.hasAttribute('data-mobile-more')?'__more__':''),label:x.querySelector('.k-nav-label')?.textContent?.trim()||'',disabled:Boolean(x.disabled)})));
  const expectedMobile=[['masterDashboard','Главная'],['masterExchange','Биржа'],['serviceManagement','Услуги'],['parts','Запчасти'],['cabinet','Аккаунт'],['__more__','Ещё']];
  check('master_bottom_nav_exact',mobileNav.length===expectedMobile.length&&expectedMobile.every(([key,label],i)=>mobileNav[i]?.key===key&&mobileNav[i]?.label===label&&!mobileNav[i]?.disabled),{mobileNav});

  await page.evaluate(()=>window.KaretaSmartActionHub?.open?.());
  await page.waitForSelector('#k-smart-action-hub.is-open');
  const more=await page.evaluate(()=>[...document.querySelectorAll('#k-smart-action-hub [data-smart-action-route]')].filter(x=>x.closest('.k-more-window-quick')).map(x=>({key:x.dataset.smartActionRoute,label:x.innerText.trim(),disabled:x.disabled})));
  const expectedMore=['masterDashboard','masterSchedule','chats','orders','following','cabinetSettings'];
  check('master_more_all_six_present',expectedMore.every(k=>more.some(x=>x.key===k)),{more});
  check('master_more_all_six_enabled',expectedMore.every(k=>more.some(x=>x.key===k&&!x.disabled)),{more});
  await page.screenshot({path:path.join(out,'01_master_more_mobile.jpg'),type:'jpeg',quality:72,fullPage:false});
  await page.evaluate(()=>window.KaretaSmartActionHub?.close?.());

  await page.evaluate(()=>window.KaretaRouteRuntime?.navigate?.('masterProfileOwner',{source:'ux84-119'}));
  await page.waitForFunction(()=>document.querySelector('#k-master-owner-profile')?.dataset.state==='ready',{timeout:10000});
  const ownerState=await page.evaluate(()=>({name:document.querySelector('#k-master-owner-profile h1')?.textContent?.trim()||'',hasClientView:!!document.querySelector('#k-master-owner-profile a[href^="#/masters/profile/master/"]'),text:(document.querySelector('#k-master-owner-profile')?.innerText||'').slice(0,240)}));
  check('master_profile_first_spa_load',ownerState.name==='Responsive Master'&&ownerState.hasClientView,{ownerState,documentRequests});
  await page.click('#k-master-owner-profile a[href^="#/masters/profile/master/"]');
  await page.waitForSelector('.k-master-ref-profile',{timeout:12000});
  const publicState=await page.evaluate(()=>({publicName:document.querySelector('.k-master-ref-profile h1')?.textContent?.trim()||'',hash:location.hash,windowOpen:!!document.querySelector('.k-master-ref-profile')}));publicState.documentRequests=documentRequests;
  check('view_as_client_without_f5',documentRequests===1&&publicState.windowOpen&&publicState.publicName.includes('Responsive Master'),publicState);
  await page.screenshot({path:path.join(out,'02_master_public_profile_no_f5.jpg'),type:'jpeg',quality:72,fullPage:false});

  await page.evaluate(()=>{location.hash='#/chats?chatId=chat_fixture_1';});
  await page.waitForFunction(()=>document.querySelector('#k-page-outlet')?.dataset.currentRoute==='chats'&&document.querySelector('.k-chat-layout')?.classList.contains('has-active'),{timeout:12000});
  await sleep(250);
  const chatState=await page.evaluate(()=>({route:document.querySelector('#k-page-outlet')?.dataset.currentRoute||'',hash:location.hash,active:document.querySelector('.k-chat-row.is-active')?.dataset.chatId||'',head:document.querySelector('[data-chat-head]')?.innerText||'',message:document.querySelector('[data-message-id] p')?.textContent||'',workspaceHead:document.querySelector('#k-page-outlet .k-workspace-head')?.textContent||''}));chatState.documentRequests=documentRequests;
  check('chat_deeplink_opens_exact_chat',chatState.active==='chat_fixture_1'&&chatState.head.includes('Клиент Тест')&&chatState.message.includes('когда можно приехать'),chatState);
  check('chat_no_duplicate_workspace_head',!chatState.workspaceHead,{workspaceHead:chatState.workspaceHead});
  await page.screenshot({path:path.join(out,'03_chat_deeplink_mobile.jpg'),type:'jpeg',quality:72,fullPage:false});

  await page.setViewport({width:1440,height:900,deviceScaleFactor:1});await sleep(200);
  const desktopChat=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,workspaceHead:!!document.querySelector('#k-page-outlet .k-workspace-head'),layout:!!document.querySelector('.k-chat-layout')}));
  check('chat_desktop_app_surface',desktopChat.layout&&!desktopChat.workspaceHead&&!desktopChat.overflow,desktopChat);

  await page.evaluate(()=>window.KaretaRouteRuntime?.navigate?.('serviceManagement',{source:'ux84-119'}));
  await page.waitForSelector('[data-page="service-management"]',{timeout:12000});
  await sleep(250);
  const serviceState=await page.evaluate(()=>({route:document.querySelector('#k-page-outlet')?.dataset.currentRoute||'',workspaceHead:!!document.querySelector('#k-page-outlet .k-workspace-head'),toolbar:!!document.querySelector('.k-master-services-toolbar,.k-service-native-toolbar'),title:(document.querySelector('[data-page="service-management"]')?.innerText||'').slice(0,180),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}));
  check('services_no_duplicate_workspace_head',serviceState.route==='serviceManagement'&&!serviceState.workspaceHead&&serviceState.toolbar&&!serviceState.overflow,serviceState);

  await page.evaluate(()=>window.KaretaRouteRuntime?.navigate?.('orders',{source:'ux84-119'}));
  await page.waitForSelector('[data-page^="orders"]',{timeout:12000});
  await sleep(250);
  const ordersState=await page.evaluate(()=>({route:document.querySelector('#k-page-outlet')?.dataset.currentRoute||'',workspaceHead:!!document.querySelector('#k-page-outlet .k-workspace-head'),toolbar:!!document.querySelector('.k-orders-toolbar,.k-client-orders-native__head'),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}));
  check('orders_no_duplicate_workspace_head',ordersState.route==='orders'&&!ordersState.workspaceHead&&ordersState.toolbar&&!ordersState.overflow,ordersState);

  await page.evaluate(()=>{location.hash='#/orders/new';});
  await page.waitForSelector('[data-request-root][data-request-role="master"]',{timeout:12000});
  await sleep(150);
  const initialRequest=await page.evaluate(()=>({steps:document.querySelectorAll('[data-request-root] .k-request-main-steps>span').length,flowVersion:document.querySelector('[data-request-root]')?.dataset.requestFlowVersion,offerHidden:document.querySelector('[data-request-panel="offer"]')?.hidden,cityField:!!document.querySelector('[data-request-panel="schedule"] [data-request-city-label]'),visitField:!!document.querySelector('[data-request-panel="schedule"] [data-request-visit-choices]'),workspaceHead:!!document.querySelector('#k-page-outlet .k-workspace-head')}));
  check('master_booking_four_step_structure',initialRequest.steps===4&&initialRequest.flowVersion==='9'&&initialRequest.offerHidden&&!initialRequest.cityField&&!initialRequest.visitField,initialRequest);

  await page.evaluate(()=>{
    const root=document.querySelector('[data-request-root]'),form=root.querySelector('[data-request-form]');
    const set=(el,val)=>{el.value=val;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
    set(form.elements.clientName,'Клиент Тест');set(form.elements.clientPhone,'+7 777 111 22 33');set(form.elements.clientCar,'Toyota Camry 2020');
  });
  await page.waitForFunction(()=>!document.querySelector('[data-request-next]')?.disabled,{timeout:3000});
  await page.click('[data-request-next]');
  await page.waitForFunction(()=>document.querySelector('[data-request-panel="schedule"]')?.hidden===false,{timeout:3000});
  const scheduleState=await page.evaluate(()=>({title:document.querySelector('[data-request-window-title]')?.textContent?.trim()||'',caption:document.querySelector('.k-request-progress-caption')?.innerText||'',cityField:!!document.querySelector('[data-request-panel="schedule"] [data-request-city-label]'),visitField:!!document.querySelector('[data-request-panel="schedule"] [data-request-visit-choices]')}));
  check('master_booking_skips_offer_and_location',scheduleState.title==='Когда записать клиента?'&&scheduleState.caption.includes('Шаг 2 из 4')&&!scheduleState.cityField&&!scheduleState.visitField,scheduleState);
  await page.click('[data-request-date-choice="today"]');
  await page.waitForFunction(()=>!document.querySelector('[data-request-next]')?.disabled,{timeout:3000});
  await page.click('[data-request-next]');
  await page.waitForFunction(()=>document.querySelector('[data-request-panel="problem"]')?.hidden===false,{timeout:3000});
  await page.click('[data-request-problem-choice="custom"]');
  await page.evaluate(()=>{const t=document.querySelector('[data-request-form] textarea[name="description"]');t.value='Диагностика электрики и проверка зарядки';t.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>!document.querySelector('[data-request-next]')?.disabled,{timeout:3000});
  await page.click('[data-request-next]');
  await page.waitForFunction(()=>document.querySelector('[data-request-panel="review"]')?.hidden===false,{timeout:3000});
  const reviewState=await page.evaluate(()=>({caption:document.querySelector('.k-request-progress-caption')?.innerText||'',review:document.querySelector('[data-request-review]')?.innerText||'',summary:document.querySelector('[data-request-confirm-summary]')?.innerText||''}));reviewState.documentRequests=documentRequests;
  check('master_booking_review_self_executor',reviewState.caption.includes('Шаг 4 из 4')&&reviewState.summary.includes('Исполнитель')&&reviewState.summary.includes('Вы')&&!reviewState.review.includes('ГДЕ')&&!reviewState.review.includes('ПРЕДЛОЖЕНИЕ'),reviewState);
  check('entire_spa_flow_without_f5',documentRequests===1,{documentRequests});
  await page.screenshot({path:path.join(out,'04_master_booking_review_desktop.jpg'),type:'jpeg',quality:72,fullPage:false});

  const serious=events.filter(e=>e.kind==='pageerror'||(e.kind==='requestfailed'&&e.failure?.errorText!=='net::ERR_ABORTED')||(e.kind==='http'&&e.status>=500));
  check('no_serious_runtime_errors',serious.length===0,{serious,events:events.slice(0,30)});
  const evidence={release:'188.5.5.6.84.119',url:'http://localhost/',browser:await browser.version(),fixture:'synthetic_master_identity_readonly_post_intercept',fixtureLimitations:['no_real_account','all_POST_api_calls_intercepted','profile/chat/order fixture data'],documentRequests,pass:checks.every(x=>x.pass),checks,events,requests,generatedAt:new Date().toISOString()};
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));
  console.log('SUMMARY '+checks.filter(x=>x.pass).length+'/'+checks.length+' PASS='+evidence.pass+' DOCS='+documentRequests+' EVENTS='+events.length);
  if(!evidence.pass)process.exitCode=2;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});