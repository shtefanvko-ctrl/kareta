#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error('MASTER_CSS_OWNERSHIP: FAIL — '+m);process.exit(1);};

const registry=read('inc/asset_registry.php');
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

const baseStart=registry.indexOf("'_baseStyles' => [");
const lazyStart=registry.indexOf("'_lazyStyleLayers' => [",baseStart);
if(baseStart<0||lazyStart<=baseStart) fail('cannot parse _baseStyles');
const baseBlock=registry.slice(baseStart,lazyStart);

for(const src of routeSources){
  if(baseBlock.includes("'"+src+"'")) fail(src+' is still eager and duplicated by master_runtime.css');
  if(!build.includes("'"+src+"'")) fail(src+' missing from master runtime builder');
}
for(const shared of ['css/next/design_contract.css','css/next/master_responsive_shell.css']){
  const count=baseBlock.split("'"+shared+"'").length-1;
  if(count!==1) fail(shared+' must be eager exactly once, found '+count);
  if(build.includes("'"+shared+"'")) fail(shared+' must not be duplicated in master runtime');
}
if(!registry.includes("'styles' => ['css/routes/master_runtime.css']")) fail('master route bundle registration missing');

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

console.log('MASTER_CSS_OWNERSHIP: PASS');
