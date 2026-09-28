'use strict';
const fs=require('fs');
const path=require('path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const core=fs.readFileSync(path.join(root,'js/next/pages/core.js'),'utf8');
const css=[
  fs.readFileSync(path.join(root,'css/next/kflow_windows.css'),'utf8'),
  fs.readFileSync(path.join(root,'css/next/home_responsive.css'),'utf8')
].join('\n');
const out=path.join(root,'docs/previews/home_responsive');
fs.mkdirSync(out,{recursive:true});

const viewports=[
  [320,568],[360,800],[390,844],[430,932],[768,1024],[1024,768],[1366,768],[1440,900],[1920,1080]
];
const shots=new Set(['390x844','768x1024','1024x768','1440x900']);

(async()=>{
  const executablePath=process.env.KARETA_CHROMIUM_PATH||path.join(process.env.HOME||'/root','.cache/ms-playwright/chromium-1234/chrome-linux64/chrome');
  if(!fs.existsSync(executablePath)){console.log(`[SKIP] Chromium is unavailable: ${executablePath}`);return;}
  const browser=await chromium.launch({headless:true,executablePath,args:['--allow-file-access-from-files']});
  const results=[];
  try{
    for(const [width,height] of viewports){
      const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
      await page.setContent(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><base href="file://${root.replaceAll('\\','/')}/"><style>html,body{margin:0;min-height:100%;background:#fff}${css}</style></head><body><div class="k-app-shell"><header id="k-shell-header"></header><main id="k-page-outlet"></main><nav id="k-mobile-nav"></nav></div></body></html>`);
      await page.evaluate(()=>{
        window.KaretaIdentity={snapshot:()=>({account:{fullname:'Константин Штефан'}})};
        window.KaretaAnalytics={track:()=>{}};
        window.KaretaServicesPages={};
        window.KaretaCatalogState={
          subscribe(callback){callback({status:'ready',services:[{id:'oil',name:'Замена масла'},{id:'diag',name:'Диагностика'},{id:'tires',name:'Шиномонтаж'}]});return()=>{};},
          load(){return Promise.resolve({status:'ready'});}
        };
        window.KaretaApiClient={
          getMastersCatalog:()=>Promise.resolve({ok:true,payload:{data:{stations:[
            {id:1,name:'AutoPro Service',rating:4.8,address:'ул. Протозанова, 45',distance:'1,2 км'},
            {id:2,name:'Drive Center',rating:4.6,address:'ул. Казахстан, 97',distance:'1,8 км'}
          ]}}}),
          request:()=>Promise.resolve({ok:true,payload:{notifications:[]}})
        };
      });
      await page.addScriptTag({content:core});
      await page.evaluate(()=>{
        const context={state:{user:{name:'Константин Штефан'}},api:window.KaretaApiClient,lifecycle:{addCleanup:()=>{}}};
        document.querySelector('#k-page-outlet').innerHTML=window.KaretaCorePages.renderHome(context);
        window.KaretaCorePages.mountHome(context);
      });
      await page.waitForTimeout(150);
      const audit=await page.evaluate(()=>{
        const root=document.querySelector('[data-home-responsive]');
        const primary=document.querySelector('.k-home-primary');
        const rect=root.getBoundingClientRect();
        return {
          documentOverflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
          rootOverflowX:root.scrollWidth>root.clientWidth+1,
          rootWidth:Math.round(rect.width),
          primaryColumns:getComputedStyle(primary).gridTemplateColumns.split(' ').length,
          requestHeight:Math.round(document.querySelector('.k-home-request-card').getBoundingClientRect().height),
          actions:document.querySelectorAll('.k-home-action-card').length,
          stations:document.querySelectorAll('.k-home-service-card').length,
          popular:document.querySelectorAll('.k-home-service-chip').length,
          activeSteps:document.querySelectorAll('.k-home-request-steps .is-active').length,
          bottomNavPreserved:!!document.querySelector('#k-mobile-nav')
        };
      });
      results.push({viewport:`${width}x${height}`,...audit});
      const key=`${width}x${height}`;
      if(shots.has(key))await page.screenshot({path:path.join(out,`${key}.png`),fullPage:true});
      await page.close();
    }
  }finally{await browser.close();}
  const bad=results.filter(row=>row.documentOverflowX||row.rootOverflowX||row.actions!==4||row.stations!==2||row.popular!==3||row.activeSteps!==1||!row.bottomNavPreserved);
  console.log(JSON.stringify(results,null,2));
  if(bad.length){console.error('Responsive home visual audit failed');process.exit(1);}
  console.log(`Responsive home visual audit: ${results.length} viewports OK`);
})().catch(error=>{console.error(error);process.exit(1);});
