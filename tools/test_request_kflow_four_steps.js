'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const request=read('js/next/pages/request.js');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const meta=(/const stepMeta=\[([\s\S]*?)\n\s*\];/.exec(request)||[])[1]||'';
const metaRows=[...meta.matchAll(/\['([^']+)'\s*,/g)].map(m=>m[1]);
expect(JSON.stringify(metaRows)===JSON.stringify(['vehicle','offer','schedule','problem','review']),`request steps mismatch: ${JSON.stringify(metaRows)}`);
for(const marker of [
  'data-request-panel="vehicle" data-step-index="0"',
  'data-request-panel="offer" data-step-index="1"',
  'data-request-panel="schedule" data-step-index="2"',
  'data-request-panel="problem" data-step-index="3"',
  'data-request-panel="review" data-step-index="4"',
  "['offer','Как получить предложение?'",
  "['schedule','Где и когда?'",
  "['problem','В чём проблема?'",
  "['review','Подтверждение'",
  'REQUEST_FLOW_VERSION=8',
  'setStep(Math.min(4,Number(draft.step||0)))'
]) expect(request.includes(marker),`missing five-step marker: ${marker}`);
expect((request.match(/data-request-panel=/g)||[]).length===5,'request must have exactly five user steps');
expect(!/data-step-index="[5-9]"/.test(request),'request must not render a sixth user step');
expect(request.includes('${[1,2,3,4,5].map'),'five-circle progress UI missing');
expect(request.includes('data-request-problem-choice="services"')&&request.includes('data-request-problem-choice="custom"'),'problem mode switch missing');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('KARETA Request: final five-step flow OK');
