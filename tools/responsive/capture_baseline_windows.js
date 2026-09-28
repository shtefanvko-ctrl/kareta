'use strict';
const fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const out=process.env.KARETA_RD_OUT || path.resolve(__dirname,'../../docs/responsive-baseline/188.5.5.6.84.110/stage_0001');
fs.mkdirSync(out,{recursive:true});
const viewports=[
 {key:'mobile',width:390,height:844},
 {key:'tablet',width:768,height:1024},
 {key:'desktop',width:1440,height:900},
];
const scenarios=[
 {role:'client',route:'home',hash:'#/home'},
 {role:'master',route:'masterDashboard',hash:'#/master'},
 {role:'sto',route:'stoDashboard',hash:'#/sto'},
 {role:'seller',route:'seller',hash:'#/seller'},
 {role:'admin',route:'adminMonitoring',hash:'#/admin/monitoring'},
 {role:'owner',route:'home',hash:'#/home'},
];
const policies={
 client:{defaultRoute:'home'},master:{defaultRoute:'masterDashboard'},
 sto:{defaultRoute:'stoDashboard'},seller:{defaultRoute:'seller'},
 admin:{defaultRoute:'home'},owner:{defaultRoute:'home'}
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const browser=await puppeteer.launch({
 headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',
 args:['--no-sandbox','--disable-dev-shm-usage']
});
const browserVersion=await browser.version(),evidence=[],defects=[],coverageNotes=[];
try{
 for(const scenario of scenarios){
  for(const viewport of viewports){
   const page=await browser.newPage();
   await page.setBypassServiceWorker(true);
   await page.setViewport({width:viewport.width,height:viewport.height,deviceScaleFactor:1});
   await page.setRequestInterception(true);
   page.on('request',req=>{
    const u=new URL(req.url());
    if(req.method()==='GET'&&u.pathname==='/api/auth_session.php'){
     const user={id:900000,name:'Responsive Baseline '+scenario.role,phone:'',
      role:scenario.role,entry_role:scenario.role,onboarded:1,onboarding_stage:'done',
      active:1,city:'Усть-Каменогорск',initials:'RB'};
     const body={ok:true,user,access:{role:scenario.role,defaultRoute:policies[scenario.role].defaultRoute,
      routes:[scenario.route],capabilities:[]},dbReady:true,fixture:true};
     return req.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
    }
    req.continue();
   });
   const events=[];
   page.on('console',async m=>{
    if(!['error','warn'].includes(m.type()))return;
    const vals=[];for(const a of m.args()){try{vals.push(await a.jsonValue())}catch{vals.push(a.toString())}}
    events.push({kind:'console',level:m.type(),text:m.text(),vals});
   });
   page.on('pageerror',e=>events.push({kind:'pageerror',message:e.message}));
   page.on('requestfailed',r=>events.push({kind:'requestfailed',url:r.url(),failure:r.failure()}));
   page.on('response',r=>{if(r.status()>=400)events.push({kind:'http',status:r.status(),url:r.url()})});
   await page.goto('http://localhost/'+scenario.hash,{waitUntil:'domcontentloaded',timeout:20000});
   await page.waitForFunction(()=>window.KaretaNext?.audit?.().ok===true,{timeout:15000});
   await sleep(1200);
   await page.evaluate(()=>{
    window.KaretaOnboardingApp?.setActive?.(false);
    document.getElementById('onb2-overlay')?.remove();
    document.getElementById('onboarding-welcome')?.remove();
   });
   await page.waitForFunction(route=>{
    const o=document.querySelector('#k-page-outlet');
    return !!o&&o.getAttribute('data-current-route')===route&&o.getAttribute('data-route-assets-loading')!=='1';
   },{timeout:5000},scenario.route).catch(()=>null);
   await sleep(500);
   const state=await page.evaluate(({role,route})=>{
    const doc=document.documentElement,o=document.querySelector('#k-page-outlet');
    const rect=n=>n?(()=>{const r=n.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}})():null;
    return {requestedRole:role,effectiveRole:window.KaretaRoleAccess?.currentRole?.()||'',
     requestedRoute:route,actualRoute:o?.dataset.currentRoute||window.KaretaNext?.state?.routeKey||'',
     identityMode:doc.dataset.identityMode||'',outletHtmlLength:(o?.innerHTML||'').length,
     outletText:(o?.innerText||'').slice(0,400),viewportWidth:doc.clientWidth,
     documentScrollWidth:doc.scrollWidth,pageOverflowX:doc.scrollWidth>doc.clientWidth+1,
     header:rect(document.querySelector('#k-shell-header')),mobileNav:rect(document.querySelector('#k-mobile-nav')),
     htmlClasses:doc.className,bodyClasses:document.body.className};
   },scenario);
   const vp=viewport.width+'x'+viewport.height;
   const filename=scenario.route+'__'+scenario.role+'__'+vp+'__chrome__baseline.png';
   await page.screenshot({path:path.join(out,filename),fullPage:true});
   const authHttp=events.filter(e=>e.kind==='http'&&[401,403].includes(e.status));
   const serious=events.filter(e=>e.kind==='pageerror'||e.kind==='requestfailed'||(e.kind==='http'&&e.status>=500));
   evidence.push({stage:'1/539',release:'188.5.5.6.84.110',baseUrl:'http://localhost/',
    url:'http://localhost/'+scenario.hash,browser:browserVersion,
    viewport:{width:viewport.width,height:viewport.height,class:viewport.key},
    fixture:'legacy_session_ui_fixture',fixtureLimitations:['identity_backend_not_authenticated',
     'secured_role_api_401_403_is_expected_in_fixture'],
    screenshot:filename,state,events,capturedAt:new Date().toISOString()});
   if(authHttp.length)coverageNotes.push({type:'fixture_auth_boundary',screenshot:filename,count:authHttp.length});
   if(state.pageOverflowX)defects.push({type:'page_overflow_x',screenshot:filename,state});
   if(state.actualRoute!==scenario.route)defects.push({type:'route_mismatch',screenshot:filename,state});
   if(state.outletHtmlLength===0)defects.push({type:'empty_outlet',screenshot:filename,state});
   for(const event of serious)defects.push({type:'runtime_event',screenshot:filename,event});
   await page.close();
  }
 }
}finally{await browser.close();}
fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));
fs.writeFileSync(path.join(out,'known_defects.json'),JSON.stringify(defects,null,2));
fs.writeFileSync(path.join(out,'coverage_notes.json'),JSON.stringify(coverageNotes,null,2));
const summary={stage:'AUTO_STAGE: 1/539',release:'188.5.5.6.84.110',baseUrl:'http://localhost/',
 browser:browserVersion,roles:scenarios.map(x=>x.role),screenshots:evidence.length,
 defects:defects.length,coverageNotes:coverageNotes.length,
 overflow:evidence.filter(x=>x.state.pageOverflowX).length,
 routeMismatch:evidence.filter(x=>x.state.actualRoute!==x.state.requestedRoute).length,
 emptyOutlet:evidence.filter(x=>x.state.outletHtmlLength===0).length,
 generatedAt:new Date().toISOString()};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
