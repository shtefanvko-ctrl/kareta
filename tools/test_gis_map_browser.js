#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..');
const files=new Set([
  '/js/next/onboarding/onboarding_selection_catalog.js',
  '/js/mobile_native_bridge.js',
  '/js/next/pages/map.js',
  '/js/next/geo_map.js',
  '/css/next/geo_map.css',
  '/css/next/map_page.css'
]);
let mode='normal', requests=0;
const fixture=[
  {id:'qa-master',ownerType:'master',ownerId:'qa1',kind:'service',label:'QA Мастер',city:'Усть-Каменогорск',address:'QA улица, 1',latitude:49.97,longitude:82.61,distanceKm:1.2,verifiedAt:'2026-11-01'},
  {id:'qa-sto',ownerType:'sto',ownerId:'qa2',kind:'branch',label:'QA СТО',city:'Усть-Каменогорск',address:'QA улица, 2',latitude:49.974,longitude:82.62,distanceKm:1.8,verifiedAt:null}
];
const respond=(res,status,type,body)=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(body);};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/geo.php'){
    requests++;if(mode==='error')return respond(res,503,'application/json',JSON.stringify({ok:false,error:'qa_unavailable'}));
    const items=mode==='empty'?[]:fixture;
    return respond(res,200,'application/json',JSON.stringify({ok:true,items,meta:{visibility:'exact_only'}}));
  }
  if(url.pathname.startsWith('/qa-tiles/'))return respond(res,503,'text/plain','QA: map tiles intentionally disabled');
  if(files.has(url.pathname)){
    const file=path.join(root,url.pathname);return respond(res,200,file.endsWith('.js')?'application/javascript':'text/css',fs.readFileSync(file));
  }
  const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/css/next/geo_map.css"><link rel="stylesheet" href="/css/next/map_page.css">
    <style>html,body{margin:0;padding:0;background:#f4f7fb;font:14px Arial,sans-serif}*{box-sizing:border-box}</style>
    <script>window.KARETA_GEO_MAP_CONFIG={tileUrl:'/qa-tiles/{z}/{x}/{y}.png'};</script>
    <script src="/js/next/onboarding/onboarding_selection_catalog.js"></script>
    <script src="/js/mobile_native_bridge.js"></script>
    <script src="/js/next/pages/map.js"></script></head>
    <body><div id="qa-app"></div>
    <script>
      const outlet=document.querySelector('#qa-app');
      outlet.innerHTML=window.KaretaMapPages.renderMap();
      window.qaCleanup=window.KaretaMapPages.mountMap();
    </script></body></html>`;
  respond(res,200,'text/html;charset=utf-8',html);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/#/map?city=${encodeURIComponent('Усть-Каменогорск')}`;
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    for(const [w,h] of [[390,844],[820,1180],[1365,800],[1920,1080]]){
      mode='normal';
      const context=await browser.newContext({viewport:{width:w,height:h},geolocation:{latitude:49.971,longitude:82.606},permissions:['geolocation']});
      const page=await context.newPage();
      const errors=[];page.on('pageerror',err=>errors.push(err.message));
      await page.goto(url,{waitUntil:'domcontentloaded'});
      await page.waitForSelector('.k-geo-map-dialog.is-inline',{timeout:12000});
      await page.waitForFunction(()=>document.querySelector('[data-gis-count]')?.textContent==='2',{timeout:12000});
      assert.equal(await page.locator('[data-gis-item]').count(),2);
      const layout=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,map:Math.round(document.querySelector('[data-gis-canvas]').getBoundingClientRect().height)}));
      assert.ok(layout.scroll<=layout.viewport+3,`horizontal overflow at ${w}x${h}: ${JSON.stringify(layout)}`);
      assert.ok(layout.map>=350,`map too short at ${w}x${h}: ${layout.map}`);
      await page.locator('[data-gis-filter-toggle]').click();
      await page.locator('[data-gis-category]').selectOption('master');
      await page.waitForFunction(()=>document.querySelector('[data-gis-count]')?.textContent==='1');
      await page.locator('[data-gis-item]').first().click();
      await page.waitForSelector('[data-geo-map-route]');
      const hash=await page.evaluate(()=>location.hash);
      assert.ok(hash.includes('point=qa-master'));
      await page.locator('[data-gis-category]').selectOption('all');
      await page.locator('[data-gis-search]').fill('QA СТО');
      await page.waitForFunction(()=>document.querySelector('[data-gis-count]')?.textContent==='1');
      await page.locator('[data-gis-search]').fill('');
      await page.waitForFunction(()=>document.querySelector('[data-gis-count]')?.textContent==='2');
      await page.locator('[data-gis-location]').click();
      await page.waitForFunction(()=>document.querySelector('[data-gis-status]')?.textContent.includes('Найдено'),{timeout:12000});
      assert.equal(errors.length,0,errors.join(' / '));
      console.log(`PASS browser ${w}x${h} map=${layout.map}px geolocation, category, selection, search; API calls=${requests}`);
      await context.close();
    }
    mode='error';
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const page=await ctx.newPage();
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('[data-gis-status]')?.dataset.error==='1',{timeout:12000});
    assert.equal(await page.locator('[data-gis-item]').count(),0);
    console.log('PASS browser API 503 fails closed without invented points');
    await ctx.close();
    mode='empty';
    const ctx2=await browser.newContext({viewport:{width:390,height:844}});
    const page2=await ctx2.newPage();
    await page2.goto(url,{waitUntil:'domcontentloaded'});
    await page2.waitForFunction(()=>document.querySelector('[data-gis-status]')?.textContent.includes('Публичных точек'),{timeout:12000});
    assert.equal(await page2.locator('[data-gis-item]').count(),0);
    console.log('PASS browser empty catalog');
    await ctx2.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1}).finally(()=>server.close());
