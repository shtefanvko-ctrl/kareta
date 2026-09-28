'use strict';
const fs=require('fs');
const read=p=>fs.readFileSync(p,'utf8');
const info=read('js/next/pages/info.js');
const cabinet=read('js/next/pages/cabinet.js');
const infoCss=read('css/next/client_surface_modernization_phase2.css');
const garageCss=read('css/next/client_cabinet.css');
const checks=[
  [info.includes('k-tow-ref-page'),'tow dedicated surface'],
  [info.includes('data-tow-status'),'tow live status'],
  [info.includes('Определить местоположение'),'tow primary action'],
  [info.includes('navigator.geolocation.getCurrentPosition'),'tow geolocation preserved'],
  [info.includes("openSupport(`Здравствуйте. Нужен эвакуатор."),'tow support chat preserved'],
  [cabinet.includes('k-garage-page-r77'),'garage dedicated surface'],
  [cabinet.includes('k-garage-summary-r77'),'garage summary'],
  [cabinet.includes('k-garage-tools-grid-r77'),'garage service tools'],
  [cabinet.includes('data-garage-add-vehicle'),'garage add action preserved'],
  [cabinet.includes('data-garage-archive-vehicle'),'garage archive preserved'],
  [cabinet.includes('data-garage-restore-vehicle'),'garage restore preserved'],
  [cabinet.includes('data-garage-set-default'),'garage default preserved'],
  [infoCss.includes('R188.5.5.6.84.77 — Tow Truck'),'tow css marker'],
  [garageCss.includes('R188.5.5.6.84.77 — Garage'),'garage css marker'],
  [garageCss.includes('overflow-x:auto!important'),'garage mobile tools local scroll'],
];
let bad=0; for(const [ok,msg] of checks){if(!ok){console.error('FAIL',msg);bad++;}}
if(bad)process.exit(1);
console.log('R188.5.5.6.84.77 Tow Truck + Garage regression OK');
