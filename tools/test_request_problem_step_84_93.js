#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const request=read('js/next/pages/request.js');
const asset=read('inc/asset_version.php'),sw=read('sw.js'),gate=read('tools/release_gate.php');
const fail=[];const expect=(ok,label)=>{if(!ok)fail.push(label);};

expect(/<textarea name="description"[^>]*minlength="5"[^>]*required[^>]*aria-required="true"/.test(request),'problem description is not visibly and natively required');
expect(request.includes("if(description.length<5)return false;if(mode==='services'&&selectedServices().length<1)return false;"),'step 4 does not require a description in both problem modes');
expect(request.includes("problemLabel.textContent='Описание проблемы'"),'problem field loses its required label when mode changes');
expect(request.includes("nextBtn.textContent=step===3?'Проверить заявку':'Продолжить'"),'step 4 must show only the review action');
expect(request.includes('submitBtn.hidden=step!==4||Boolean(createdOrder)'),'submit action must remain exclusive to step 5');
expect(request.includes("root.closest('.k-request-window-body')")&&request.includes("scrollHost.scrollTo({top:0,left:0,behavior:'auto'})"),'step transition does not reset the request window scroll');
for(const removed of ['Срочная помощь','Когда нужна помощь?','name="urgent"','form.elements.urgent'])expect(!request.includes(removed),`removed urgency UI returned: ${removed}`);
expect(request.includes("priority:'normal'"),'request priority must remain normal');
const av=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'188\.5\.5\.6\.84\.(\d+)'/)||[])[1];
const sv=(sw.match(/const RELEASE = '188\.5\.5\.6\.84\.(\d+)'/)||[])[1];
expect(Number(av)>=93,'asset version must be .84.93 or newer');
expect(Number(sv)>=93,'service worker release must be .84.93 or newer');
expect(gate.includes("'84.93' => 'tools/test_request_problem_step_84_93.js'"),'release gate does not run .84.93 regression');
if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('[84.93] Request problem-step regression passed.');
