'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.resolve(__dirname,'../js/next/client/first_vehicle_flow.js'),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

function harness(api){
  const listeners=new Map(),values=new Map(),session=new Map(),timers=[];
  const storage=map=>({getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)});
  let accountId=101;
  const snapshot=()=>({authenticated:true,account:{id:accountId},context:{type:'personal'},compatibilityRole:'client'});
  const root={dataset:{},classList:{add(){}},setAttribute(){},addEventListener(name,fn){this[name]=fn;},querySelector:()=>null,replaceChildren(){this.innerHTML='';},scrollTo(){},innerHTML:''};
  const location={hash:'#/cabinet/garage'};
  const window={
    KaretaClientCabinetApi:api,
    KaretaIdentity:{snapshot},
    addEventListener:(name,fn)=>listeners.set(name,[...(listeners.get(name)||[]),fn]),
    setTimeout:fn=>{timers.push(fn);return timers.length;},
  };
  const classList={add(){},remove(){}};
  const document={documentElement:{classList},body:{classList},getElementById:id=>id==='k-first-vehicle-layer'?root:null};
  vm.runInNewContext(source,{window,document,localStorage:storage(values),sessionStorage:storage(session),setTimeout:window.setTimeout,clearTimeout:()=>{},location});
  return {flow:window.KaretaFirstVehicleFlow,values,session,timers,root,location,snapshot,setAccount:id=>{accountId=id;},anonymous:()=>listeners.get('kareta:session-anonymous')[0]()};
}

async function checkOldReadCannotChangeNewAccount(){
  const old=deferred(),next=deferred(),calls=[];
  const h=harness({firstEntryCurrent:()=>{calls.push(1);return calls.length===1?old.promise:next.promise;}});
  const reading=h.flow.loadServerFirstEntry();
  h.anonymous();h.setAccount(202);
  old.resolve({ok:true,payload:{data:{status:'completed',revision:9,draft:{brandName:'Old account'}}}});
  assert.equal(await reading,null);
  assert.equal(h.values.get('kareta.firstVehicle.prompt.v1:202'),undefined);
  assert.equal(h.values.get('kareta.firstVehicle.draft.v1:202'),undefined);
  const newReading=h.flow.loadServerFirstEntry();
  next.resolve({ok:true,payload:{data:{status:'completed',revision:1}}});
  assert.equal((await newReading).revision,1);
  assert.equal(h.values.get('kareta.firstVehicle.prompt.v1:202'),'completed');
}

async function checkOldScheduleCannotNavigateNewAccount(){
  const old=deferred();let reads=0,garageReads=0;
  const h=harness({
    firstEntryCurrent:()=>{reads++;return reads===1?old.promise:Promise.resolve({ok:true,payload:{data:{status:'draft',revision:0}}});},
    get:()=>{garageReads++;return Promise.resolve({ok:true,payload:{data:{vehicles:[],archivedVehicles:[]}}});},
  });
  const scheduling=h.flow.maybeScheduleFirstEntry({identity:h.snapshot()});
  h.anonymous();h.setAccount(202);
  old.resolve({ok:true,payload:{data:{status:'draft'}}});
  assert.equal(await scheduling,false);
  assert.equal(garageReads,0);
  assert.equal(h.timers.length,0);
  assert.equal(await h.flow.maybeScheduleFirstEntry({identity:h.snapshot()}),true,'new account must get its own first-car prompt');
  assert.equal(garageReads,1);
  assert.equal(h.session.get('kareta.firstVehicle.pendingIntro.v1'),'202');
}

async function checkOldDraftSaveCannotChangeNewAccount(){
  const old=deferred(),next=deferred();let writes=0;
  const h=harness({saveFirstEntryDraft:()=>{writes++;return writes===1?old.promise:next.promise;}});
  const saving=h.flow.flushServerDraft();
  h.anonymous();h.setAccount(202);
  old.resolve({ok:true,payload:{data:{status:'completed',revision:5}}});
  assert.equal(await saving,false);
  assert.equal(h.values.get('kareta.firstVehicle.prompt.v1:202'),undefined);
  const newSaving=h.flow.flushServerDraft();
  next.resolve({ok:true,payload:{data:{status:'draft',revision:1}}});
  assert.equal(await newSaving,true);
  assert.equal(writes,2);
}

async function checkOldVehicleSaveCannotRenderNewAccount(){
  const old=deferred(),h=harness({saveVehicle:()=>old.promise});
  h.values.set('kareta.firstVehicle.draft.v1:101',JSON.stringify({brandId:'toyota',brandName:'Toyota',modelId:'camry',modelName:'Camry',year:'2020'}));
  h.flow.start({mode:'manual'});
  const click=h.root.click({target:{closest:selector=>selector==='[data-first-vehicle-save]'?{}:null}});
  h.anonymous();h.setAccount(202);
  old.resolve({ok:true,payload:{vehicle:{id:4,brand:'Toyota',model:'Camry'}}});
  await click;
  assert.equal(h.values.get('kareta.firstVehicle.prompt.v1:202'),undefined);
  assert.equal(h.root.innerHTML.includes('Автомобиль добавлен'),false);
}

async function checkOldDismissCannotNavigateNewAccount(){
  const old=deferred(),h=harness({dismissFirstEntry:()=>old.promise});
  h.flow.start({mode:'intro',startStep:1});
  const click=h.root.click({target:{closest:selector=>selector==='[data-first-vehicle-later]'?{}:null}});
  h.anonymous();h.setAccount(202);
  old.resolve({ok:true,payload:{data:{status:'dismissed',revision:1}}});
  await click;
  assert.equal(h.location.hash,'#/cabinet/garage');
  assert.equal(h.values.get('kareta.firstVehicle.prompt.v1:202'),undefined);
}

Promise.all([checkOldReadCannotChangeNewAccount(),checkOldScheduleCannotNavigateNewAccount(),checkOldDraftSaveCannotChangeNewAccount(),checkOldVehicleSaveCannotRenderNewAccount(),checkOldDismissCannotNavigateNewAccount()])
  .then(()=>console.log('FIRST_VEHICLE_ACCOUNT_ISOLATION_84_151: PASS stale read, schedule, draft, vehicle save, dismiss'))
  .catch(error=>{console.error(error);process.exitCode=1;});
