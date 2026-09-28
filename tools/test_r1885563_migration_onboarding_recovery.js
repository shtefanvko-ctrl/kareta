'use strict';
const assert=require('assert');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const response=(status,payload,raw='')=>({
  ok:status>=200&&status<300,status,statusText:'',
  headers:{get:name=>String(name).toLowerCase()==='content-type'?(payload?'application/json; charset=utf-8':'text/html'):''},
  text:async()=>payload?JSON.stringify(payload):raw,
});

function onboardingSandbox(responses){
  const calls=[];
  const storage={values:new Map(),setItem(k,v){this.values.set(k,String(v));},getItem(k){return this.values.get(k)||null;},removeItem(k){this.values.delete(k);}};
  const sandbox={
    Date,Math,JSON,String,Number,Boolean,Object,Array,Promise,Error,
    navigator:{onLine:true},sessionStorage:storage,
    fetch:async url=>{calls.push(String(url));const next=responses.shift();if(!next)throw new Error('unexpected_fetch');return next;},
    console:{error(){},warn(){},log(){},info(){}},
    setTimeout,clearTimeout,
  };
  sandbox.window={KaretaRuntimeLog:{add(){}},window:null};sandbox.window.window=sandbox.window;
  vm.createContext(sandbox);vm.runInContext(read('js/next/onboarding/onboarding_api.js'),sandbox,{filename:'onboarding_api.js'});
  return {api:sandbox.window.KaretaOnboardingApi,calls};
}

async function validDatabaseFailureIsNotRetried(){
  const serverError={ok:false,error:'database_unavailable',databaseState:'schema_initialization_failed',recoveryAction:'repair_database_migrations',requestId:'req-test'};
  const {api,calls}=onboardingSandbox([response(503,serverError)]);
  let caught=null;try{await api.requestCode('+77000000000');}catch(error){caught=error;}
  assert(caught,'database failure was not returned to the UI');
  assert.strictEqual(caught.code,'database_unavailable');
  assert.strictEqual(caught.databaseState,'schema_initialization_failed');
  assert.strictEqual(calls.length,1,'valid 503 response duplicated the OTP request');
  assert.strictEqual(calls[0],'/api/auth_session.php');
}

async function missingPrimaryUsesCompatibilityGateway(){
  const {api,calls}=onboardingSandbox([
    response(404,null,'<html>missing</html>'),
    response(200,{ok:true,sent:true,expiresIn:600,mode:'register',requestId:'fallback-ok'}),
  ]);
  const result=await api.requestCode('+77000000001');
  assert(result.ok&&result.sent,'compatibility gateway did not return success');
  assert.deepStrictEqual(calls,['/api/auth_session.php','/api/onboarding_code.php']);
}

function migrationAndDiagnosticsContracts(){
  const migration=read('api/migrations/098_role_workspaces_completion.php');
  assert.strictEqual(crypto.createHash('sha256').update(migration).digest('hex'),'02a2d591dbc6eb68733177da1b79283f0c0e2b44f66d11ae37f26dd7725c3a0d','historical migration 98 checksum changed');
  const bootstrap=read('api/bootstrap.php');
  const helperStart=bootstrap.indexOf('function kareta_prepare_migration_98_dashboard_layout_compatibility');
  const helperEnd=bootstrap.indexOf('\nfunction kareta_migrate',helperStart);
  const helper=bootstrap.slice(helperStart,helperEnd);
  for(const marker of ['idx_dashboard_layout_account_fk','GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX',"$expectedScope = 'account_id,context_kind,context_key,dashboard_key'"])assert(helper.includes(marker),`migration recovery missing: ${marker}`);
  assert(helper.indexOf('idx_dashboard_layout_account_fk')<helper.indexOf('uq_dashboard_layout_scope'),'FK index is not prepared first');
  assert(bootstrap.includes("'schema_or_migration_failed' => 'schema_initialization_failed'"),'migration failure is still reported as a connection failure');
  const auth=read('api/auth_session.php');
  assert(auth.indexOf("if (!$pdo instanceof PDO)")<auth.indexOf("if ($action === 'onboarding.requestCode')"),'auth_session still reaches OTP with a null PDO');
  const diagnostics=read('api/runtime_diagnostics.php');
  assert(diagnostics.includes("'recoveryAction'=>kareta_db_public_recovery_action($databaseState)"),'safe recovery action is missing');
  assert(read('api/db.php').includes("'databaseState'=>$databaseState"),'public ping does not expose the safe database state');
}

function releaseContract(){
  const release='20260806-r188555-runtime-dependency-bootstrap-r188556-security-hardening-r1885561-atomic-runtime-bootstrap-r1885562-identity-db-recovery-r1885563-migration98-onboarding-recovery-r1885564-fk-detach-schema-recovery-r1885565-serialized-schema-index-recovery';
  for(const file of ['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'])assert(read(file).includes(release),`release mismatch: ${file}`);
  assert(read('index.php').includes("$cacheEpoch = 'r1885565-serialized-schema-index-recovery'"),'cache epoch mismatch');
}

(async()=>{await validDatabaseFailureIsNotRetried();await missingPrimaryUsesCompatibilityGateway();migrationAndDiagnosticsContracts();releaseContract();console.log('R188.5.5.6.3 migration/onboarding recovery tests OK');})().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
