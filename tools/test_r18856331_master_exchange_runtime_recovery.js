'use strict';
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const dispatch=read('api/production_dispatch.php');
const feed=read('js/next/pages/work_feed.js');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');
const config=read('config.php');
const migration=read('api/migrations/126_master_exchange_capability_recovery.php');
expect(dispatch.includes("MASTER_EXCHANGE_NOTIFY_PRIMARY"),'primary exchange notification guard missing');
expect(dispatch.includes("MASTER_EXCHANGE_NOTIFY_FALLBACK"),'fallback exchange notification guard missing');
expect(/if\(\$tab==='new'\)\{try\{kareta_master_exchange_notify_matching_items/.test(dispatch),'exchange notifications must not break feed reads');
expect(feed.includes("api/db.php?action=masterWorkplace.get"),'workplace fallback endpoint missing');
expect(feed.includes('loadExchangeFallback'),'exchange read fallback missing');
expect(feed.includes('exchangeErrorText'),'exchange error decoder missing');
expect(feed.includes("message&&message!=='Не удалось выполнить операцию'"),'generic normalized error must not hide backend error code');
expect(feed.includes('workplace_fallback:'),'degraded fallback reason missing');
expect(feed.includes('exchangeState.degraded=true'),'fallback must mark degraded mode');
expect(asset.includes('r18856331-master-exchange-runtime-recovery'),'R73.1 asset suffix missing');
expect(sw.includes('r18856331-master-exchange-runtime-recovery'),'R73.1 service worker suffix missing');
expect(/KARETA_DB_VERSION',\s*126/.test(config),'R73.1 expected DB version 126');
for(const t of ["'version' => 126","'profile.master'","'requests.read'","'requests.respond'","'personal.client'","'requests.update'"])expect(migration.includes(t),`R73.1 migration missing ${t}`);
const manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`Shell Freeze 2 hash changed: ${file}`)}
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.73.1 master exchange runtime recovery + Shell Freeze 2 OK');
