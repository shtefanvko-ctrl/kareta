'use strict';
/* Local-only Puppeteer browser smoke: no cookies, DB, login or outside network. */
const fs=require('fs'),path=require('path'),assert=require('assert');
const PUPPETEER=require(process.env.KARETA_PUPPETEER_MODULE || 'puppeteer');
const paths={
  'client.kareta.kz':'client',
  'work.kareta.kz':'specialist',
  'works.kareta.kz':'sto',
  'shop.kareta.kz':'shop',
  'm.kareta.kz':'legacy',
};
const port=Number(process.env.KARETA_PREVIEW_PORT||18091);
const evidence=process.env.KARETA_BROWSER_EVIDENCE||path.resolve(__dirname,'../../kareta-domain-browser-evidence');
const screenshots=[];const failures=[];
async function run(){
  fs.mkdirSync(evidence,{recursive:true});
  const browser=await PUPPETEER.launch({headless:true,...(process.env.KARETA_BROWSER_EXECUTABLE ? {executablePath:process.env.KARETA_BROWSER_EXECUTABLE} : {}),args:['--no-sandbox','--disable-setuid-sandbox','--no-proxy-server',`--host-resolver-rules=${Object.keys(paths).map(host=>`MAP ${host} 127.0.0.1`).join(',')}`]});
  try{
    for(const [host,expected]of Object.entries(paths)){
      for(const [device,width,height] of [['desktop',1365,768],['mobile',390,844]]){
        const page=await browser.newPage();
        await page.setViewport({width,height,deviceScaleFactor:1,isMobile:device==='mobile',hasTouch:device==='mobile'});
        await page.setRequestInterception(true);
        page.on('request',request=>{
          const url=new URL(request.url());
          if(!Object.keys(paths).includes(url.hostname) || Number(url.port)!==port){request.abort('blockedbyclient');return;}
          if(url.pathname.startsWith('/api/')){
            request.respond({status:401,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify({ok:false,error:'auth_required',code:'AUTH_REQUIRED'})});return;
          }
          request.continue();
        });
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        const response=await page.goto(`http://${host}:${port}/`,{waitUntil:'domcontentloaded',timeout:25000});
        await new Promise(resolve=>setTimeout(resolve,1300));
        const actual=await page.evaluate(()=>({surface:document.documentElement.dataset.karetaDomainApp,title:document.title,script:!!document.querySelector('script'),hasShell:!!document.querySelector('#k-shell-header'),hasPreloader:!!document.querySelector('#k-app-preloader'),url:location.href}));
        const status=response.status();
        const file=path.join(evidence,`${host.replaceAll('.','-')}-${device}.png`);
        await page.screenshot({path:file,fullPage:false});
        screenshots.push(file);
        if(status!==200||actual.surface!==expected||!actual.hasShell||!actual.hasPreloader||errors.length)failures.push({host,device,status,actual,errors});
        console.log((failures.at(-1)?.host===host&&failures.at(-1)?.device===device?'FAIL':'PASS'),host,device,'HTTP',status,'surface',actual.surface,'JS errors',errors.length);
        await page.close();
      }
    }
    const page=await browser.newPage();
    await page.setViewport({width:420,height:880});
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    const context={type:'personal',id:1},master={type:'profile',profileType:'master',id:2,label:'Мастер'};
    await page.evaluate((config,ctx,m)=>{
      window.KARETA_DOMAIN_SURFACE=config;
      window.KaretaIdentity={snapshot(){return {authenticated:true,mode:'identity',context:ctx,contexts:[ctx,m]};},async select(id){ window.__selectedContextId=id;return {ok:true};}};
    },{role:'master',label:'Кабинет мастера',route:'masterDashboard'},context,master);
    await page.addStyleTag({path:path.resolve(__dirname,'../css/next/domain_surface.css')});
    await page.addScriptTag({path:path.resolve(__dirname,'../js/next/domain_surface.js')});
    const blocked=await page.evaluate(()=>{const result=window.KaretaDomainSurface.enforce();return {blocked:result.blocked,title:document.getElementById('k-domain-surface-title')?.textContent,buttons:document.querySelectorAll('.k-domain-surface-gate__button').length};});
    const gateFile=path.join(evidence,'role-mismatch-desktop.png');
    await page.screenshot({path:gateFile});screenshots.push(gateFile);
    if(!blocked.blocked||blocked.buttons!==1||blocked.title!=='Кабинет мастера')failures.push({kind:'role-gate',blocked});
    else console.log('PASS isolated browser real DOM role mismatch gate');
    await page.close();
  }finally{await browser.close();}
  const report={status:failures.length?'FAIL':'PASS',scope:'local candidate, API requests stubbed as anonymous; no live DB, no authenticated E2E',screenshots,failures};
  fs.writeFileSync(path.join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('BROWSER_SMOKE',report.status,'SCREENSHOTS',screenshots.length,'FAILURES',failures.length);
  if(failures.length)process.exitCode=1;
}
run().catch(err=>{console.error('BROWSER_SMOKE_FAILURE',err.stack||err);process.exitCode=1});
