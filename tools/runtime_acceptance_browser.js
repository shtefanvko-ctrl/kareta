'use strict';

const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {runObdAcceptance}=require('./runtime_acceptance_obd');

const root=path.resolve(__dirname,'..');
const base=String(process.env.KARETA_ACCEPTANCE_BASE_URL||'http://127.0.0.1:8080').replace(/\/$/,'');
const expectedVersion=String(process.env.KARETA_ACCEPTANCE_EXPECTED_VERSION||'');
const report={status:'RUNNING',base,expectedVersion,startedAt:new Date().toISOString(),auth:{},rounds:[],errors:{page:[],console:[],request:[],http:[]}};

async function json(res,label,expectedStatus=200){
  const status=res.status();
  const text=await res.text();
  let data=null;
  try{data=JSON.parse(text);}catch(_error){}
  assert.equal(status,expectedStatus,label+' HTTP '+status+' body='+text.slice(0,500));
  assert.ok(data&&typeof data==='object',label+' must return JSON');
  return data;
}

async function waitRoute(page,hash,key,round){
  await page.evaluate(target=>{location.hash=target;},hash);
  await page.waitForFunction(expected=>{
    const outlet=document.querySelector('#k-page-outlet');
    return outlet
      && outlet.getAttribute('data-current-route')===expected
      && outlet.getAttribute('data-route-assets-loading')!=='1'
      && !outlet.querySelector('[data-route-loading]')
      && !outlet.querySelector('.k-route-load-error');
  },key,{timeout:20000});
  await page.waitForTimeout(250);
  const state=await page.evaluate(()=>({
    hash:location.hash,
    route:document.querySelector('#k-page-outlet')?.getAttribute('data-current-route')||'',
    loading:Boolean(document.querySelector('#k-page-outlet [data-route-loading]')),
    loadError:Boolean(document.querySelector('#k-page-outlet .k-route-load-error')),
    outletText:String(document.querySelector('#k-page-outlet')?.textContent||'').trim().slice(0,300),
    navMounted:Boolean(document.querySelector('#k-mobile-nav')),
  }));
  assert.equal(state.route,key,round+': route '+hash);
  assert.equal(state.loading,false,round+': loading remained on '+hash);
  assert.equal(state.loadError,false,round+': route load error on '+hash);
  assert.ok(state.outletText.length>0,round+': empty outlet on '+hash);
  report.rounds.push({round,hash,key,state});
}

(async()=>{
  let browser;
  try{
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({
      viewport:{width:390,height:844},
      locale:'ru-RU',
      serviceWorkers:'allow',
    });

    const phone='77005550144';
    const requestCode=await json(await context.request.post(base+'/api/auth_session.php',{
      data:{action:'onboarding.requestCode',phone}
    }),'requestCode');
    assert.equal(requestCode.ok,true);
    assert.equal(requestCode.testMode,true,'runtime acceptance requires test OTP transport');
    const code=String(requestCode.testCode||requestCode.devCode||'');
    assert.match(code,/^\d{4,8}$/,'test OTP not exposed');

    const verify=await json(await context.request.post(base+'/api/auth_session.php',{
      data:{action:'onboarding.verifyCode',phone,code,entryRole:'client'}
    }),'verifyCode');
    assert.equal(verify.ok,true);
    assert.equal(verify.verified,true);

    let registered=Boolean(verify.existingAccount);
    if(!registered){
      const complete=await json(await context.request.post(base+'/api/auth_session.php',{
        data:{action:'onboarding.complete',profile:{
          phone,name:'KARETA Runtime Acceptance',role:'client',entry_role:'client',
          city:'Усть-Каменогорск',profile:{specialization:''},vehicle:{}
        }}
      }),'onboarding.complete');
      assert.equal(complete.ok,true);
      assert.equal(complete.confirmed,true);
      registered=true;
    }
    report.auth={phoneMasked:'***0144',registered,existingAccount:Boolean(verify.existingAccount)};

    await runObdAcceptance({context,base,json,report});

    const page=await context.newPage();
    page.on('pageerror',error=>report.errors.page.push(String(error?.stack||error)));
    page.on('console',msg=>{if(msg.type()==='error')report.errors.console.push(msg.text());});
    page.on('requestfailed',req=>{
      try{
        const url=new URL(req.url());
        if(url.origin===new URL(base).origin){
          const type=req.resourceType();
          const failure=req.failure()?.errorText||'';
          // Route lifecycle deliberately aborts in-flight fetch/XHR work when the user
          // leaves a page. Treat that cancellation as expected, but keep all other
          // same-origin failures actionable.
          if(failure==='net::ERR_ABORTED'&&(type==='fetch'||type==='xhr'))return;
          report.errors.request.push({url:req.url(),type,failure});
        }
      }catch(_error){}
    });
    page.on('response',res=>{
      try{
        const url=new URL(res.url());
        if(url.origin!==new URL(base).origin)return;
        const type=res.request().resourceType();
        if((type==='script'||type==='stylesheet'||type==='image')&&res.status()>=400)report.errors.http.push({url:res.url(),status:res.status(),type});
        if(url.pathname.startsWith('/api/')&&res.status()>=500)report.errors.http.push({url:res.url(),status:res.status(),type});
      }catch(_error){}
    });

    await page.goto(base+'/#/home',{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>window.KaretaRouteRegistry&&document.querySelector('#k-page-outlet'),null,{timeout:20000});
    await waitRoute(page,'#/home','home','first');
    await waitRoute(page,'#/services','services','first');
    await waitRoute(page,'#/community','community','first');
    await waitRoute(page,'#/masters','masters','first');

    const more=page.locator('#k-mobile-nav [data-mobile-more]');
    assert.equal(await more.count(),1,'mobile More control missing');
    await more.click();
    await page.waitForFunction(()=>{
      const button=document.querySelector('#k-mobile-nav [data-mobile-more]');
      return button?.getAttribute('aria-expanded')==='true';
    },null,{timeout:5000});
    await page.keyboard.press('Escape');

    await page.goBack({timeout:10000}).catch(()=>null);
    await page.waitForFunction(()=>document.querySelector('#k-page-outlet')?.getAttribute('data-current-route')==='community',null,{timeout:10000});

    await page.evaluate(()=>{
      const outlet=document.querySelector('#k-page-outlet');
      window.__KARETA_ACCEPTANCE_SECOND_LOADING__=[];
      window.__KARETA_ACCEPTANCE_SECOND_OBSERVER__?.disconnect?.();
      const record=()=>{
        if(outlet?.getAttribute('data-route-assets-loading')==='1'||outlet?.querySelector('[data-route-loading]')){
          window.__KARETA_ACCEPTANCE_SECOND_LOADING__.push({hash:location.hash,at:Date.now()});
        }
      };
      const observer=new MutationObserver(record);
      observer.observe(outlet,{subtree:true,childList:true,attributes:true,attributeFilter:['data-route-assets-loading']});
      window.__KARETA_ACCEPTANCE_SECOND_OBSERVER__=observer;
    });

    await waitRoute(page,'#/home','home','second');
    await waitRoute(page,'#/services','services','second');
    await waitRoute(page,'#/community','community','second');
    await waitRoute(page,'#/masters','masters','second');

    const secondLoads=await page.evaluate(()=>{
      window.__KARETA_ACCEPTANCE_SECOND_OBSERVER__?.disconnect?.();
      return Array.isArray(window.__KARETA_ACCEPTANCE_SECOND_LOADING__)?window.__KARETA_ACCEPTANCE_SECOND_LOADING__:[];
    });
    report.secondCircleLoading=secondLoads;
    assert.equal(secondLoads.length,0,'second circle re-entered route loading/skeleton state');

    const runtime=await page.evaluate(()=>({
      assetVersion:String(window.KARETA_NEXT_ASSET_VERSION||''),
      route:String(document.querySelector('#k-page-outlet')?.getAttribute('data-current-route')||''),
      morePresent:Boolean(document.querySelector('#k-mobile-nav [data-mobile-more]')),
      routeLoadError:Boolean(document.querySelector('#k-page-outlet .k-route-load-error')),
    }));
    report.runtime=runtime;
    assert.equal(runtime.assetVersion,expectedVersion,'browser asset version mismatch');
    assert.equal(runtime.routeLoadError,false,'route load error visible at end');

    await page.screenshot({path:path.join(root,'artifacts/runtime-acceptance/second-circle.png'),fullPage:true});

    assert.equal(report.errors.page.length,0,'browser page errors: '+report.errors.page.join(' | '));
    assert.equal(report.errors.request.length,0,'same-origin request failures: '+JSON.stringify(report.errors.request));
    assert.equal(report.errors.http.length,0,'same-origin fatal HTTP responses: '+JSON.stringify(report.errors.http));

    report.status='PASS';
    console.log('RUNTIME_BROWSER_ACCEPTANCE: PASS routes=home,services,community,masters second_circle_loading=0');
    await context.close();
  }catch(error){
    report.status='FAIL';
    report.failure=String(error?.stack||error);
    console.error(report.failure);
    process.exitCode=1;
  }finally{
    report.finishedAt=new Date().toISOString();
    const dir=path.join(root,'artifacts/runtime-acceptance');
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'browser.json'),JSON.stringify(report,null,2)+'\n');
    if(browser)await browser.close().catch(()=>{});
  }
})();
