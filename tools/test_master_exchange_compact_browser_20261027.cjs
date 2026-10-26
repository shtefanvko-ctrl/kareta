/* Browser regression: master exchange density and empty/nonempty states, isolated fixtures only. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
let chromium;try{({chromium}=require('playwright'));}catch(_e){({chromium}=require('/home/karetadmin/kareta-workspace/scion-src/web/node_modules/playwright'));}
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/next/pages/work_feed.js'),'utf8');
const w={KaretaApiClient:{},KaretaCatalogCards:{},KaretaRoleAccess:{currentRole:()=> 'master'},
KaretaPageUI:{masterPageHeader:(title,subtitle,opts)=>'<header class="k-master-page-header" '+(opts.attrs||'')+'><div class="k-master-page-header__copy"><small>'+opts.eyebrow+'</small><h1>'+title+'</h1><p>'+subtitle+'</p></div><div class="k-master-page-header__actions">'+opts.actions+'</div></header>'},
KaretaUIIcons:{svg:()=>'<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>',icon:()=>''}};
vm.runInNewContext(source,{window:w,console,Intl,Date,URLSearchParams,setTimeout,clearTimeout});
const html=w.KaretaWorkFeedPages.renderExchange();
const widths=[320,390,430,768,1440];
const cssFiles=['css/next/app_next.css','css/next/master_ui_exchange_schedule_flattening.css','css/next/work_feed.css','css/next/master_surface_contract.css','css/next/master_surfaces.css','css/next/master_exchange_reference_20261025.css'];
const out=path.join(root,'qa-master-exchange-20261027');
fs.mkdirSync(out,{recursive:true});
const mockedOrder={id:'TEST-1',serviceNames:'Диагностика двигателя',vehicleTitle:'Toyota Land Cruiser Prado',priority:'urgent',price:28000,dispatch:{serviceMatch:100,distanceKm:2.3,slaState:'ok'},notes:'Проверить работу двигателя'};
(async()=>{
const localBrowser='/home/karetadmin/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell';
const browser=await chromium.launch({headless:true,...(fs.existsSync(localBrowser)?{executablePath:localBrowser}:{}),args:['--no-sandbox']});
try{
for(const mode of ['empty','nonempty']){
for(const width of widths){
 const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.setContent('<!doctype html><html data-user-role="master"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="k-page-outlet">'+html+'</div></body></html>');
 for(const f of cssFiles)if(fs.existsSync(path.join(root,f)))await page.addStyleTag({path:path.join(root,f)});
 await page.evaluate(({mode,order})=>{
  window.KaretaApiClient={getMasterExchangeFeed:async()=>({ok:true,payload:{data:{items:mode==='nonempty'?[order]:[],kpi:{available:mode==='nonempty'?1:0},tabCounts:{new:mode==='nonempty'?1:0,saved:0,responded:0,accepted:0},load:{loadPct:0,activeOrders:0}}}})};
  window.KaretaRoleAccess={currentRole:()=> 'master'};
  window.KaretaCatalogCards={};
  window.KaretaPageUI={masterPageHeader:()=>''};
  window.KaretaUIIcons={svg:()=>'<svg></svg>',icon:()=>''};
  window.KaretaIdentity={snapshot:()=>({authenticated:true,compatibilityRole:'master',context:{id:42}})};
  window.KaretaNavigationState={capture(){},restoreAfterAsync(){}};
  window.KaretaToast={error(){},success(){}};
  location.hash='#/master/exchange';
 },{mode,order:mockedOrder});
 await page.addScriptTag({path:path.join(root,'js/next/pages/work_feed.js')});
 await page.evaluate(()=>window.KaretaWorkFeedPages.mountExchange());
 await page.waitForFunction(()=>document.querySelector('[data-exchange-grid]')?.getAttribute('aria-busy')==='false',{timeout:5000});
 const first=await page.evaluate(()=>{
  const isShown=el=>{if(!el)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&!!el.getClientRects().length;};
  const tabs=[...document.querySelectorAll('[data-exchange-tab]')].map(el=>{const r=el.getBoundingClientRect();return {label:el.textContent.trim(),visible:isShown(el),x:r.left,right:r.right,height:r.height,width:r.width};});
  const text=document.querySelector('.k-exchange-filter-button > span')||null;
  const btn=document.querySelector('.k-exchange-filter-button');
  const actions=[...document.querySelectorAll('[data-exchange-empty] .k-master-empty-r84__actions button')].filter(isShown).map(x=>x.textContent.trim());
  return {tabs,filterTextVisible:isShown(text),filterHeight:btn.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,actions,emptyTitle:document.querySelector('[data-exchange-empty-title]')?.textContent,cardCount:document.querySelectorAll('[data-exchange-request]').length,badge:document.querySelector('[data-exchange-load]')?.textContent};
 });
 assert.strictEqual(first.tabs.length,4,'tab count');
 assert.strictEqual(first.filterTextVisible,true,'Filter text must not be hidden at '+width);
 assert(first.filterHeight>=44,'Filter touch target small at '+width);
 assert(first.overflow<=1,'Document overflow at '+width+' = '+first.overflow);
 if(width<=767)for(const t of first.tabs){assert(t.visible,'Invisible tab '+t.label+' at '+width);assert(t.x>=0&&t.right<=width+1,'Offscreen tab '+t.label+' at '+width+': '+JSON.stringify(t));assert(t.height>=44,'Short tab '+t.label+' at '+width);}
 if(mode==='empty'){
   assert(first.emptyTitle.includes('Новых заявок'),'Wrong initial empty title at '+width);
   assert.strictEqual(first.actions.length,0,'Duplicate empty actions at '+width);
   await page.locator('[data-exchange-tab="saved"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-exchange-empty-title]')?.textContent.includes('Сохранённых'),{timeout:3000});
   await page.locator('[data-exchange-tab="new"]').click();
   await page.locator('[data-exchange-scope="mine"]').first().click();
   await page.waitForFunction(()=>document.querySelector('[data-exchange-empty-title]')?.textContent.includes('По вашим услугам'),{timeout:3000});
   const actionCount=await page.locator('[data-exchange-empty] .k-master-empty-r84__actions button:visible').count();
   assert.strictEqual(actionCount,1,'Expected 1 scope recovery action');
   await page.locator('[data-exchange-search]').fill('NO-MATCH');
   await page.waitForFunction(()=>document.querySelector('[data-exchange-empty-title]')?.textContent.includes('Подходящих'),{timeout:5000});
   const filtered=await page.locator('[data-exchange-empty] .k-master-empty-r84__actions button:visible').allTextContents();
   assert.strictEqual(filtered.length,1,'Expected exactly one filtered recovery');
   assert(filtered[0].includes('Сбросить'),'Expected reset conditions action');
   await page.locator('[data-exchange-clear-conditions]').click();
   await page.waitForFunction(()=>document.querySelector('[data-exchange-empty-title]')?.textContent.includes('По вашим услугам'),{timeout:3000});
 } else {
   assert.strictEqual(first.cardCount,1,'Real mock order card not rendered');
   assert(first.badge.includes('0%'),'Known load metric should be 0%');
 }
 await page.screenshot({path:path.join(out,mode+'-'+width+'.png'),fullPage:true});
 assert.deepStrictEqual(errors,[],'JS errors '+width+' '+mode);
 console.log('PASS '+mode+' '+width+'px tabs='+first.tabs.length+' overflow='+first.overflow+' actions='+first.actions.length+' cards='+first.cardCount);
 await context.close();
}
}
}finally{await browser.close();}
})().catch(e=>{console.error('FAIL',e.stack||e);process.exitCode=1});
