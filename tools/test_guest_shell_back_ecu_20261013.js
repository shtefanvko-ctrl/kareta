'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const back=read('js/next/mobile_back.js');
const header=read('css/next/mobile_brand_center.css');
const cards=read('css/next/reference_client_pages.css');
const bootCss=read('css/runtime_boot_bundle.css');
const clientCss=read('css/routes/client_guard_postlude.css');
const home=read('js/next/pages/core.js');
const services=read('js/next/pages/services.js');
const registry=read('inc/asset_registry.php');
const index=read('index.php');

for(const [file,source] of [['mobile_back.js',back],['core.js',home],['services.js',services]])new vm.Script(source,{filename:file});
assert.equal((index.match(/id="k-mobile-back"/g)||[]).length,1,'exactly one Shell back node');
assert(header.includes('[data-kareta-header-mode="inner"] > .k-brand'),'inner route must hide branded masthead');
assert(header.includes('.k-shell-page-title'),'inner contextual title styling missing');
assert(back.includes('routeTrail.length > 1 && history.length > 1'),'no safe guard for direct-entry history');
assert(home.includes('href="#/diagnostics" data-ecu-entry="home"'),'Home ECU entry missing');
assert(services.includes('href="#/diagnostics" data-ecu-entry="services"'),'Services ECU entry missing');
assert(cards.includes('.k-services-ecu-cta')&&cards.includes('.k-home-ref-ecu-cta'),'ECU card CSS missing');
for(const [marker,source] of [['/* Guest shell canon 2026-10-13',header],['/* 2026-10-13 — integrated ECU diagnosis entry',cards]]){
  const pos=source.indexOf(marker);
  assert(pos>=0,'required CSS source delta missing: '+marker);
  const delta=source.slice(pos).trimEnd();
  assert(bootCss.includes(delta),'eager runtime CSS missing source delta: '+marker);
  assert(clientCss.includes(delta),'route CSS missing source delta: '+marker);
}
assert(registry.includes("'routeKeys' => ['diagnostics']"),'preexisting diagnostics lazy route missing');
assert(fs.existsSync(path.join(root,'js/next/pages/diagnostics.js')),'real diagnostics module missing');
assert(fs.existsSync(path.join(root,'api/obd.php')),'OBD API missing');

const wnd={};
const doc={readyState:'loading',addEventListener(){}};
const loc={hash:'#/diagnostics'};
vm.runInNewContext(back,{window:wnd,document:doc,location:loc},{filename:'mobile_back.js'});
assert.equal(wnd.KaretaMobileBack.fallbackFor('#/diagnostics'),'#/services');
assert.equal(wnd.KaretaMobileBack.fallbackFor('#/parts/item/42'),'#/parts');
assert.equal(wnd.KaretaMobileBack.fallbackFor('#/services/category/diagnostics'),'#/services');
assert.equal(wnd.KaretaMobileBack.routeTitle('#/diagnostics'),'Диагностика ЭБУ');
assert.equal(wnd.KaretaMobileBack.routeTitle('#/parts/item/42'),'Карточка товара');
console.log('PASS guest shell / single back / ECU entry static+route contract 2026-10-13');
