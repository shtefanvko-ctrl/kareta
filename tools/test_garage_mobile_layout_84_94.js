#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const page=read('js/next/pages/cabinet.js');
const source=read('css/next/client_cabinet.css');
const bundle=read('css/routes/cabinet_runtime.css');
const asset=read('inc/asset_version.php'),sw=read('sw.js'),gate=read('tools/release_gate.php');
const fail=[];const expect=(ok,label)=>{if(!ok)fail.push(label);};

expect(page.includes('class="k-garage-add-r77"')&&page.includes('data-garage-add-vehicle'),'Garage add-vehicle control contract missing');
expect(page.includes('k-garage-vehicle-stats')&&page.includes('км пробег')&&page.includes('ремонтов')&&page.includes('документов'),'vehicle metrics contract changed');
expect(page.includes('data-garage-set-default')&&page.includes('Сделать основным'),'non-primary vehicle action missing');
expect(page.includes("v.is_default?'':`<button"),'primary vehicle must not render the make-primary action');

for(const [label,css] of [['source',source],['route bundle',bundle]]){
  expect(/\.k-garage-head-r77\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) 42px!important[^}]*max-width:100%!important/s.test(css),`${label}: Garage heading is not viewport-contained`);
  expect(/\.k-garage-car-r77 \.k-garage-vehicle-stats\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/s.test(css),`${label}: vehicle metrics are not a three-column mobile grid`);
  expect(/\.k-garage-tools-grid-r77\s*\{[^}]*display:grid!important[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important[^}]*overflow:visible!important/s.test(css),`${label}: service cards remain a clipped horizontal rail`);
  expect(/\.k-garage-tools-grid-r77 \.k-garage-category b[^}]*word-break:normal!important/s.test(css),`${label}: Garage category labels may still split inside words`);
}

const av=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'188\.5\.5\.6\.84\.(\d+)'/)||[])[1];
const sv=(sw.match(/const RELEASE = '188\.5\.5\.6\.84\.(\d+)'/)||[])[1];
expect(Number(av)>=94,'asset version must be .84.94 or newer');
expect(Number(sv)>=94,'service worker release must be .84.94 or newer');
expect(gate.includes("'84.94' => 'tools/test_garage_mobile_layout_84_94.js'"),'release gate does not run .84.94 regression');
if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('[84.94] Garage mobile layout regression passed.');
