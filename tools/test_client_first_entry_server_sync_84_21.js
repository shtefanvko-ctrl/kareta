'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const flowSource=read('js/next/client/first_vehicle_flow.js');
const apiSource=read('js/next/client/client_cabinet_api.js');
const backend=read('api/client_cabinet.php');
const db=read('api/db.php');
const migration=read('api/migrations/129_client_first_entry_state.php');
const checks=[];const expect=(n,v)=>{checks.push([n,!!v]);console.log(`${v?'PASS':'FAIL'} ${n}`)};
expect('migration 129 creates account-scoped first-entry state',migration.includes("'version' => 129")&&migration.includes('client_first_entry_state')&&migration.includes('PRIMARY KEY (`account_id`)'));
expect('state has revision and terminal timestamps',migration.includes('`revision` INT UNSIGNED')&&migration.includes('`dismissed_at`')&&migration.includes('`completed_at`'));
expect('existing vehicles backfill completed',migration.includes("'completed',4,NULL,1,NOW()")&&migration.includes('client_vehicles'));
expect('backend current reconciles real vehicle existence',backend.includes('kareta_client_first_entry_has_vehicle')&&backend.includes("status='completed'")&&backend.includes('draft_json=NULL'));
expect('backend draft is revision guarded',backend.includes("error'=>'revision_conflict")&&backend.includes('expectedRevision')&&backend.includes('FOR UPDATE'));
expect('backend dismiss is revision guarded and server persisted',backend.includes("status='dismissed'")&&backend.includes('dismissed_at=NOW()'));
expect('vehicle creation automatically completes first entry',db.includes('kareta_client_first_entry_mark_completed($pdo)'));
expect('API exposes current/save/dismiss',db.includes("clientFirstEntry.current")&&db.includes("clientFirstEntry.saveDraft")&&db.includes("clientFirstEntry.dismiss")&&apiSource.includes('firstEntryCurrent')&&apiSource.includes('saveFirstEntryDraft')&&apiSource.includes('dismissFirstEntry'));
expect('frontend server state wins prompt terminal status',flowSource.includes("server.status==='completed'")&&flowSource.includes("server.status==='dismissed'"));
expect('frontend keeps local fallback',flowSource.includes('localStorage')&&flowSource.includes('promptStatus()')&&flowSource.includes('readDraft()'));
expect('frontend serializes server draft saves',flowSource.includes('serverSaving')&&flowSource.includes('serverSavePending')&&flowSource.includes('flushServerDraft'));
expect('revision conflict does not clear local draft',flowSource.includes("error==='revision_conflict'")&&flowSource.includes('state.serverConflict=true'));

function store(){const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),_m:m};}
function makeSandbox(firstEntry, cabinet){
  const localStorage=store(),sessionStorage=store(),nav=[];let saved=[];
  const api={
    firstEntryCurrent:async()=>({ok:true,payload:{data:firstEntry}}),
    get:async()=>({ok:true,payload:{data:cabinet}}),
    saveFirstEntryDraft:async payload=>{saved.push(payload);return{ok:true,payload:{data:{status:'in_progress',revision:(payload.expectedRevision||0)+1,currentStep:payload.currentStep,draft:payload.draft,updatedAt:'2026-08-14T08:00:00Z',hasVehicles:false}}}},
    dismissFirstEntry:async payload=>({ok:true,payload:{data:{status:'dismissed',revision:(payload.expectedRevision||0)+1,currentStep:1,draft:{},updatedAt:'2026-08-14T08:00:00Z',hasVehicles:false}}}),
    saveVehicle:async()=>({ok:true,payload:{vehicle:{id:'v1',brand:'Toyota',model:'Camry',year:'2013'}}})
  };
  const window={KaretaClientCabinetApi:api,KaretaNavigationCore:{interfaceRole:()=> 'client'},KaretaIdentity:{snapshot:()=>({account:{id:77},context:{accountId:77}})},KaretaNext:{state:{user:{id:5,phone:'7700'}}},KaretaRouteRuntime:{navigate:(key,opts)=>nav.push([key,opts])},KaretaApiClient:{invalidate:()=>{}},addEventListener:()=>{},setTimeout:fn=>{fn();return 1;},scrollTo:()=>{}};
  const sandbox={window,localStorage,sessionStorage,location:{hash:'#/home'},setTimeout:fn=>{fn();return 1;},clearTimeout:()=>{},console,Date,JSON,Object,String,Number,Boolean,Array,Math,RegExp,encodeURIComponent};
  vm.createContext(sandbox);vm.runInContext(flowSource,sandbox);
  return {flow:window.KaretaFirstVehicleFlow,localStorage,sessionStorage,nav,saved};
}
(async()=>{
  let s=makeSandbox({status:'dismissed',revision:3,draft:{},hasVehicles:false,updatedAt:'2026-08-14T07:00:00Z'},{vehicles:[],archivedVehicles:[]});
  expect('second device respects server dismissed',await s.flow.maybeScheduleFirstEntry({})===false&&s.nav.length===0);
  s=makeSandbox({status:'completed',revision:4,draft:{},hasVehicles:true,updatedAt:'2026-08-14T07:00:00Z'},{vehicles:[{id:'v1'}],archivedVehicles:[]});
  expect('server completed prevents repeat intro',await s.flow.maybeScheduleFirstEntry({})===false&&s.nav.length===0);
  s=makeSandbox({status:'in_progress',revision:5,draft:{step:3,brandId:'toyota',brandName:'Toyota',modelId:'camry',modelName:'Camry',year:'2013',clientUpdatedAt:1786690000000},hasVehicles:false,updatedAt:'2026-08-14T07:00:00Z'},{vehicles:[],archivedVehicles:[]});
  const scheduled=await s.flow.maybeScheduleFirstEntry({});
  const restored=s.flow.readDraft();
  expect('cross-device server draft restores vehicle fields',scheduled===true&&restored.brandName==='Toyota'&&restored.modelName==='Camry'&&String(restored.year)==='2013');
  expect('empty garage still opens intro after server restore',s.nav.some(x=>x[0]==='cabinetGarage'));
  await s.flow.flushServerDraft();
  expect('server draft save carries expected revision',s.saved.length>0&&s.saved[0].expectedRevision===5&&s.saved[0].draft.brandName==='Toyota');
  const failed=checks.filter(x=>!x[1]);console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);if(failed.length)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
