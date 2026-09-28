#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const request=read('js/next/pages/request.js');
const api=read('js/next/api_client.js');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');
const gate=read('tools/release_gate.php');
const fail=[];const expect=(value,message)=>{if(!value)fail.push(message);};
const submit=(/const submit=async event=>\{([\s\S]*?)\n\s*\};/.exec(request)||[])[1]||'';
expect(submit.includes("time=text(timeEl?.value)"),'request submit must define time from timeEl');
expect(submit.includes("Предпочтительное время: ${time||'В течение дня'}"),'request notes must use scoped time');
expect(submit.includes("time:/^\\d{2}:\\d{2}$/.test(time)?time:''"),'request payload must use scoped time');
expect(api.includes('const DB_READ_MIN_GAP_MS = 300'),'DB read pacing gate missing');
expect(api.includes('if (result.status !== 429) return result;'),'DB read 429 retry guard missing');
expect(api.includes("return method === 'GET' && /(?:^|\\/)api\\/db\\.php"),'DB retry must be GET-only');
expect(api.includes('const transport = isDbRead(url, method) ? executeDbRead(url, fetchOptions) : execute(url, fetchOptions);'),'DB read transport gate not wired');
const av=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1]||'';
const sv=(sw.match(/const RELEASE\s*=\s*'([^']+)'/)||[])[1]||'';
expect(/^188\.5\.5\.6\.84\.(?:98|99|[1-9][0-9]{2,})$/.test(av),'asset version must be .84.98+');
expect(sv===av,'service worker release parity missing');
expect(gate.includes("'84.98' => 'tools/test_request_submit_db_backoff_84_98.js'"),'release gate must run .84.98 regression');
if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('[84.98] Request submit time + DB 429 backoff regression passed.');
