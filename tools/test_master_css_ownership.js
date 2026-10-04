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
  'css/next/master_client_r84_postlude.css',
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
