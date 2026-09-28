#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const request=read('js/next/pages/request.js');
const css=read('css/next/kflow_windows.css')+'\n'+read('css/runtime_boot_bundle.css');
const asset=read('inc/asset_version.php'),sw=read('sw.js'),gate=read('tools/release_gate.php');
const fail=[];const expect=(value,message)=>{if(!value)fail.push(message);};
for(const removed of ['Срочная помощь','Когда нужна помощь?','data-request-urgent-timing','data-request-urgent-details','name="urgent"','form.elements.urgent'])expect(!request.includes(removed),`stale request urgency contract: ${removed}`);
expect(!css.includes('.k-request-urgent-details'),'stale urgency CSS remains');
expect(request.includes("nextBtn.textContent=step===3?'Проверить заявку':'Продолжить'"),'step 4 review action changed');
expect(request.includes('submitBtn.hidden=step!==4||Boolean(createdOrder)'),'step 5 submit visibility changed');
expect(request.includes("priority:'normal'"),'request priority must default to normal');
expect(request.includes('delete data.urgent;delete data.urgentTiming;'),'legacy urgency values must be removed from saved drafts');
const av=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'188\.5\.5\.6\.84\.(\d+)'/)||[])[1];
const sv=(sw.match(/const RELEASE = '188\.5\.5\.6\.84\.(\d+)'/)||[])[1];
expect(Number(av)>=88,'asset version .84.88+ missing');
expect(Number(sv)>=88&&sv===av,'service worker release .84.88+ parity missing');
expect(gate.includes("'84.88' => 'tools/test_request_urgency_cleanup_84_88.js'"),'release gate does not run .84.88 regression');
if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('[84.88] Request urgency UI cleanup regression passed.');
