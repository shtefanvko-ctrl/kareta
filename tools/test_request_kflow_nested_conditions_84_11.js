'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const request=read('js/next/pages/request.js');
const css=read('css/next/kflow_windows.css')+'\n'+read('css/next/request_5_steps.css');
const version=read('inc/asset_version.php');
const db=read('api/db.php');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
for(const marker of [
  'data-request-flow-version="8"',
  'data-request-panel="vehicle"','data-request-panel="offer"','data-request-panel="schedule"','data-request-panel="problem"','data-request-panel="review"',
  'data-request-offer-choice="exchange"','data-request-offer-choice="own_price"',
  'data-request-problem-choice="services"','data-request-problem-choice="custom"','data-request-problem-mode',
  'data-request-city-option','data-request-detect-city','navigator.geolocation',
  'data-request-visit-choice="field"','data-request-visit-choice="service"','data-request-address',
  'data-request-date-choice="today"','data-request-date-choice="tomorrow"','data-request-date-choice="custom"',
  'data-request-picker-slot','data-request-exact-time','data-request-schedule-done',
  'data-request-media','video/mp4',
  'data-request-consent','data-request-rules-dialog','data-request-success-actions','На главную',
  "budgetFrom:mode==='own_price'?budget:undefined","fieldService:visit==='field'","address:visit==='field'?text(addressEl?.value):text(cityEl?.value)"
]) expect(request.includes(marker),`missing request contract: ${marker}`);
expect((request.match(/data-request-panel=/g)||[]).length===5,'request must render five user steps');
expect(request.includes('const REQUEST_FLOW_VERSION=8'),'draft flow version 8 missing');
for(const token of ['.k-request-final-choice','.k-request-location-row','.k-request-consent','.k-request-rules-dialog','.k-request-problem-modes'])expect(css.includes(token),`missing request CSS: ${token}`);
expect(db.includes("$customServiceNames = trim((string)($o['serviceNames'] ?? ''))")&&db.includes("error'=>'service_required'"),'backend service/custom-problem compatibility contract missing');
const vm=/KARETA_ASSET_VERSION\s*=\s*'188\.5\.5\.6\.84\.(\d+)'/.exec(version);expect(vm&&Number(vm[1])>=58,'asset version must be 188.5.5.6.84.58 or newer');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('KARETA Request: five steps + nested conditions OK');
