'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};

const src=read('js/next/api_client.js');
const bundle=read('js/boot/runtime_ui_bundle.js');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');

expect(src.includes('const dbSafeReplay = options.dbSafeReplay === true;'),'dbSafeReplay request flag missing');
expect(src.includes('(isDbRead(requestUrl, method) || dbSafeReplay) ? executeDbRead'),'safe POSTs are not using shared 429 gate');
expect(src.includes('const directChatInFlight=new Map();'),'openDirect single-flight missing');
expect(src.includes("'X-Idempotency-Key':idempotencyKey"),'openDirect idempotency header missing');
for(const action of ['chats.getAll','chats.contacts','messages.get','chats.markRead']){
  const at=src.indexOf("action:'"+action+"'");
  expect(at>=0,action+' wrapper missing');
  expect(src.slice(at,at+340).includes('dbSafeReplay:true'),action+' is not protected by safe replay gate');
}
expect(src.includes("action:'chats.openDirect'")&&src.slice(src.indexOf("action:'chats.openDirect'"),src.indexOf("action:'chats.openDirect'")+420).includes('dbSafeReplay:true'),'chats.openDirect is not protected');
expect(!src.slice(src.indexOf("function sendMessage"),src.indexOf("function updateMessage")).includes('dbSafeReplay:true'),'message send must not be automatically replayed');
expect(bundle.includes('const directChatInFlight=new Map();'),'runtime_ui_bundle is stale');
expect(bundle.includes('const dbSafeReplay = options.dbSafeReplay === true;'),'runtime_ui_bundle safe replay flag missing');

const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1]||'';
const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1]||'';
expect(va==='188.5.5.6.84.144','asset release is not 84.144');
expect(vs===va,'service worker / asset release mismatch');
console.log('CHAT_RATE_LIMIT_84_144: PASS release='+va);
