const fs=require('fs'), assert=require('assert');
(async()=>{
 const sw=fs.readFileSync('sw.js','utf8');
 const from=sw.indexOf('async function validRouteManifestResponse('),to=sw.indexOf('async function cacheFirstVersioned(');
 assert(from>0&&to>from);
 const valid=Function('RELEASE',sw.slice(from,to)+';return validRouteManifestResponse;')('188.5.5.6.84.178');
 const r=(type,payload,ok=true)=>({ok,headers:{get:()=>type},clone(){return {json:async()=>payload}}});
 const good={release:'188.5.5.6.84.178',assets:[],routeBundles:{}};
 assert.equal(await valid(r('application/json',good)),true,'valid');
 assert.equal(await valid(r('text/html',good)),false,'MIME');
 assert.equal(await valid(r('application/json',{...good,release:'bad'})),false,'release');
 assert.equal(await valid(r('application/json',{...good,assets:null})),false,'assets');
 assert.equal(await valid(r('application/json',good,false)),false,'http');
 const parts=fs.readFileSync('js/next/pages/parts.js','utf8');
 const pf=parts.indexOf('  function storeDirectory('),pt=parts.indexOf('  function storeStrip(');
 assert(pf>0&&pt>pf);
 const directory=Function('cityMatch','storeTrust','storeMode','state',parts.slice(pf,pt)+';return storeDirectory;')(
   row=>row.city==='Almaty',new Map(),'rating',{city:'Almaty'});
 const d=directory({products:[{seller_user_id:1,store_name:'One',city:'Almaty'},
   {seller_user_id:2,store_name:'Two',city:'Astana'},
   {seller_user_id:1,store_name:'One',city:'Astana'}]});
 assert.equal(d.length,1);
 assert.equal(d[0].products,1);
 console.log('PASS:SW manifest scenarios 5/5; parts city scenarios 2/2');
})().catch(e=>{console.error('FAIL',e.stack);process.exit(1)});

const stageGuardCheck=(name,text)=>{const x=fs.readFileSync(name,'utf8');assert(x.includes(text),name);};
stageGuardCheck('js/next/pages/notifications.js','Could not mark notifications as read');
stageGuardCheck('js/next/pages/master_schedule.js','freeSlotsRequestId');
stageGuardCheck('js/next/pages/work_feed.js','exchangeLoadSequence');
