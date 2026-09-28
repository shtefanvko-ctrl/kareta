'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const request=read('js/next/pages/request.js');
const css=read('css/next/kflow_windows.css');
const version=read('inc/asset_version.php');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const meta=(/const clientStepMeta=\[([\s\S]*?)\n\s*\];/.exec(request)||[])[1]||'';
const rows=[...meta.matchAll(/\['([^']+)'\s*,/g)].map(m=>m[1]);
expect(JSON.stringify(rows)===JSON.stringify(['offer','place-time','review']),`CLIENT final steps must be exactly 3, got ${JSON.stringify(rows)}`);
expect(request.includes("total:3,current:current+1,label:'Формирование заявки'"),'CLIENT progress must render total=3');
for(const marker of [
  'data-request-client-final',
  'data-client-request-panel="offer" data-step-index="0"',
  'data-client-request-panel="place-time" data-step-index="1"',
  'data-client-request-panel="review" data-step-index="2"',
  'data-client-source="vehicle"','data-client-source="services"','data-client-source="problem"',
  'data-client-offer="market"','data-client-offer="budget"','data-client-offer="direct"',
  'data-client-location-mode="mobile"','data-client-location-mode="service"',
  'data-client-date="today"','data-client-date="tomorrow"','data-client-date="custom"',
  'data-client-open-time','data-client-request-summary','data-client-request-consent',
  "FLOW_VERSION=6", "sessionStorage.setItem(DRAFT_KEY", "idempotencyKey:draft.idempotencyKey", "const localDateIso=date=>",
  "if(steps)steps.innerHTML=''", "title.textContent='Заявка отправлена'"
]) expect(request.includes(marker),`missing CLIENT 3-step marker: ${marker}`);
const clientBlock=(/function clientRequestContent[\s\S]*?\n  function mountClientRequest/.exec(request)||[''])[0];
expect((clientBlock.match(/data-client-request-panel=/g)||[]).length===3,'CLIENT markup must contain exactly 3 parent panels');
expect(!/data-client-request-panel=[^\n]*data-step-index="[3-9]"/.test(clientBlock),'CLIENT must not render step 4+');
expect(!clientBlock.includes('data-client-request-panel="vehicle-services"'),'vehicle/services must not be CLIENT parent step');
expect(!clientBlock.includes('data-client-request-panel="problem"'),'problem must not be CLIENT parent step');
expect(css.includes('.k-flow-request[data-request-client-final]'),'CLIENT 3-step CSS scope missing');
expect(css.includes('font-family:Inter'),'CLIENT final flow must use specified Inter/system typography');
expect(css.includes('.k-client-choice-card')&&css.includes('min-height:88px'),'offer choice-card geometry missing');
expect(css.includes('.k-client-segmented')&&css.includes('.k-client-request-summary'),'location/review styling missing');
expect(request.includes("if(isClient)return clientRequestContent(context,options)"),'CLIENT render must branch away from MASTER/STO work request');
expect(request.includes("if(root.hasAttribute('data-request-client-final'))return mountClientRequest(context,root,form)"),'CLIENT mount must branch away from MASTER/STO work request');
const vm=/188\.5\.5\.6\.84\.(\d+)/.exec(version);expect(vm&&Number(vm[1])>=22,'asset version must be 84.22+');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('KARETA CLIENT Request 84.22: exactly 3 final steps; source context nested; independent MASTER/STO flow; success outside progress OK');
