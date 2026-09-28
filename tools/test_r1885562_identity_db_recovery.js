'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const response=(status,payload)=>({
  ok:status>=200&&status<300,
  status,
  text:async()=>JSON.stringify(payload),
});

async function productionGuardSkipsUnavailableIdentity(){
  const calls=[],events=[],logs=[];
  const sandbox={
    Date,Promise,Object,String,Boolean,Error,CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},
    document:{documentElement:{dataset:{}}},
    fetch:async url=>{calls.push(String(url));return response(200,{ok:true,dbReady:false,assetVersion:'test'});},
  };
  sandbox.window={
    addEventListener(){},dispatchEvent:event=>events.push(event),
    KaretaRuntimeLog:{add:(...args)=>logs.push(args)},
  };
  Object.assign(sandbox.window,{window:sandbox.window,document:sandbox.document,fetch:sandbox.fetch,CustomEvent:sandbox.CustomEvent});
  vm.createContext(sandbox);vm.runInContext(read('js/next/production_guard.js'),sandbox,{filename:'production_guard.js'});
  const health=await sandbox.window.KaretaProductionGuard.check({force:true});
  assert(health.dbReady===false&&health.identityReady===false,'DB outage did not produce an unavailable Identity snapshot');
  assert(calls.length===1&&calls[0].includes('action=ping&identity_probe='),'Identity endpoint was called after dbReady=false');
  assert(!calls.some(url=>url.includes('identity_health.php')),'Identity health 503 cascade was not prevented');
  assert(sandbox.document.documentElement.dataset.identityHealth==='unavailable','unavailable state was not exposed to the UI');
  assert(logs.some(entry=>entry[0]==='identity.health.unavailable'&&entry[2]==='warn'),'expected outage was not logged as a warning');
}

async function productionGuardChecksIdentityWhenReady(){
  const calls=[];
  const sandbox={
    Date,Promise,Object,String,Boolean,Error,CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},
    document:{documentElement:{dataset:{}}},
    fetch:async url=>{calls.push(String(url));return calls.length===1?response(200,{ok:true,dbReady:true,assetVersion:'test'}):response(200,{ok:true,status:'ready'});},
  };
  sandbox.window={addEventListener(){},dispatchEvent(){},KaretaRuntimeLog:{add(){}}};
  Object.assign(sandbox.window,{window:sandbox.window,document:sandbox.document,fetch:sandbox.fetch,CustomEvent:sandbox.CustomEvent});
  vm.createContext(sandbox);vm.runInContext(read('js/next/production_guard.js'),sandbox,{filename:'production_guard.ready.js'});
  const health=await sandbox.window.KaretaProductionGuard.check({force:true});
  assert(calls.length===2&&calls[1]==='/api/identity_health.php','ready DB did not continue to Identity health');
  assert(health.dbReady===true&&health.identityReady===true,'ready Identity state is invalid');
}

function staticRecoveryContracts(){
  const release='20260806-r188555-runtime-dependency-bootstrap-r188556-security-hardening-r1885561-atomic-runtime-bootstrap-r1885562-identity-db-recovery';
  for(const file of ['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'])assert(read(file).includes(release),`release mismatch: ${file}`);
  const app=read('js/next/app_next.js');
  assert(app.includes("guard?.identityReady!==false && guard?.dbReady!==false"),'app does not honor the DB/Identity guard');
  assert(app.includes("if(!state.user && !state.identity?.authenticated)"),'anonymous protected snapshot is not skipped');
  const diagnostics=read('api/runtime_diagnostics.php'),bootstrap=read('api/bootstrap.php');
  for(const state of ['configuration_missing','pdo_mysql_missing','connection_failed'])assert((diagnostics+bootstrap).includes(`'${state}'`),`safe diagnostic state missing: ${state}`);
  assert(diagnostics.includes("if($authorized)$response['diagnostic']=$diagnostic"),'detailed diagnostics are no longer authorization-gated');
  assert(read('js/next/runtime_logger.js').includes('Date.now()-diagnosticLastAt<30000'),'diagnostic request throttle is missing');
  assert(/\$cacheEpoch = 'r188556(?:2-identity-db-recovery|[3-9]-)/.test(read('index.php')),'browser cache epoch was not advanced');
}

(async()=>{await productionGuardSkipsUnavailableIdentity();await productionGuardChecksIdentityWhenReady();staticRecoveryContracts();console.log('R188.5.5.6.2 Identity/DB recovery tests OK');})().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
