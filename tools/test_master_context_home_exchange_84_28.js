const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const core=read('js/next/pages/core.js');
const db=read('api/db.php');
let passed=0;
function ok(cond,msg){if(!cond){console.error('[FAIL]',msg);process.exitCode=1;}else{passed++;console.log('[OK]',msg);}}
ok(core.includes("function homeCompatibilityRole(context)"),'Home has context-role resolver');
ok(core.includes("contextType==='profile'&&profileType==='master'"),'MASTER profile context is detected');
ok(core.includes("function homeCanLoadClientCabinet(context)"),'Home has client-cabinet guard');
ok(core.includes("return homeCompatibilityRole(context)==='client'"),'Client Cabinet is client-only');
ok(core.includes("if(homeCanLoadClientCabinet(context)){(async()=>"),'Cabinet request is guarded before execution');
ok((core.match(/cabinetApi\?\.get/g)||[]).length===1&&core.indexOf('if(homeCanLoadClientCabinet(context)){(async()=>')<core.indexOf('cabinetApi?.get'),'Only guarded Home cabinet loader remains');
ok(db.includes("if ($action === 'masterExchange.feed') { if (!$pdo) _no_db(); kareta_require_api_capability($pdo,'requests.read',['master','sto','admin','owner']); kareta_master_exchange_feed_v2($pdo); }"),'masterExchange.feed registered on GET');
ok(db.includes("if ($action === 'masterExchange.getMine') { if (!$pdo) _no_db(); kareta_require_api_capability($pdo,'requests.read',['master','sto','admin','owner']); master_exchange_get_mine($pdo); }"),'masterExchange.getMine registered on GET');
ok(db.includes("case 'masterExchange.feed':"),'POST compatibility route remains');
ok(db.includes("case 'masterExchange.getMine':"),'POST getMine compatibility route remains');
if(!process.exitCode)console.log(`MASTER context Home/Exchange contract: ${passed}/10 OK`);
