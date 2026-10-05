#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error('MASTER_CSS_OWNERSHIP: FAIL — '+m);process.exit(1);};

const registry=read('inc/asset_registry.php');
const boot=read('css/runtime_boot_bundle.css');
const runtime=read('css/routes/master_runtime.css');
const build=read('tools/build_master_runtime_css.js');
const routeSources=[
  'css/next/master_business_runtime.css',
  'css/next/master_order_lifecycle.css',
  'css/next/master_aftercare.css',
  'css/next/master_service_pricing_native.css',
  'css/next/master_exchange_acceptance_flow.css',
  'css/next/master_ui_exchange_schedule_flattening.css',
  'css/next/master_surfaces.css'
];
const shared=['css/next/design_contract.css','css/next/master_responsive_shell.css'];

const sourceStart=registry.indexOf("'_sourceLayers' => [");
const lazyStart=registry.indexOf("'_lazyStyleLayers' => [",sourceStart);
if(sourceStart<0||lazyStart<=sourceStart) fail('cannot parse _sourceLayers');
const inventory=registry.slice(sourceStart,lazyStart);

for(const src of routeSources){
  if(!inventory.includes("'"+src+"'")) fail(src+' missing from source inventory');
  if(boot.includes('SOURCE: '+src)) fail(src+' leaked into eager boot CSS');
  if(!runtime.includes('SOURCE: '+src)) fail(src+' missing from master runtime');
  if(!build.includes("'"+src+"'")) fail(src+' missing from master runtime builder');
}

const retiredSources=['css/next/master_client_r84_postlude.css'];
for(const src of retiredSources){
  if(!inventory.includes("'"+src+"'")) fail(src+' missing from source inventory');
  if(boot.includes('SOURCE: '+src)) fail(src+' leaked into eager boot CSS');
  if(runtime.includes('SOURCE: '+src)) fail(src+' still present in master runtime');
  if(build.includes("'"+src+"'")) fail(src+' still present in master runtime builder');
}

const exchangeOwner=read('css/next/master_ui_exchange_schedule_flattening.css');
if(!exchangeOwner.includes('EXCHANGE CARD DENSITY FIX')) fail('exchange density rules are not owned by exchange CSS');
const serviceOwner=read('css/next/master_requests_workplace_services.css');
for(const token of [
  'MASTER surfaces aligned with the client r84 card system.',
  'actionable master empty states',
  '@media(max-width:1199px)',
  '@media(max-width:767px)'
]){
  if(!serviceOwner.includes(token)) fail('service-management canonical owner missing '+token);
}

const surface=read('css/next/master_surface_contract.css');
const canonStart=surface.indexOf('/* R188.5.5.6.84.182 — canonical UI system');
const canonEnd=surface.indexOf('/* R188.5.5.6.84.183',canonStart);
if(canonStart<0||canonEnd<0) fail('cannot locate Master canonical 84.182 block');
const canon182=surface.slice(canonStart,canonEnd);
for(const leaked of ['\n:root{','\n:where(','\n:is(','\n.k-page :is(','\n.k-app-shell :is(','html[data-user-role] #k-page-outlet']){
  if(canon182.includes(leaked)) fail('Master canonical block leaks outside master role: '+JSON.stringify(leaked));
}
for(const scoped of [
  'html[data-user-role="master"]{',
  'html[data-user-role="master"] #k-page-outlet',
  'html[data-user-role="master"] :where(.k-btn,.k-button)',
  'html[data-user-role="master"] :is(',
  'html[data-user-role="master"] .k-page :is(',
  'html[data-user-role="master"] .k-app-shell :is('
]){
  if(!canon182.includes(scoped)) fail('Master canonical role scope missing: '+scoped);
}

for(const src of shared){
  if(!inventory.includes("'"+src+"'")) fail(src+' missing from source inventory');
  const marker='SOURCE: '+src;
  const count=boot.split(marker).length-1;
  if(count!==1) fail(src+' must be eager exactly once, found '+count);
  if(runtime.includes(marker)) fail(src+' duplicated in master runtime');
  if(build.includes("'"+src+"'")) fail(src+' duplicated in master runtime builder');
  const source=read(src).trimEnd();
  const markerText='/* ===== SOURCE: '+src+' ===== */';
  const start=boot.indexOf(markerText);
  if(start<0) fail(src+' marker missing from boot');
  const bodyStart=start+markerText.length+1;
  const next=boot.indexOf('\n/* ===== SOURCE:',bodyStart);
  const body=(next<0?boot.slice(bodyStart):boot.slice(bodyStart,next)).trim();
  if(body!==source.trim()) fail(src+' eager copy is stale');
}
if(!registry.includes("'styles' => ['css/routes/master_runtime.css']")) fail('master route bundle registration missing');
console.log('MASTER_CSS_OWNERSHIP: PASS');
