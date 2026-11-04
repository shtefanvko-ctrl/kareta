#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const checks=[];
const expect=(name,ok)=>{checks.push({name,ok:!!ok});console.log((ok?'PASS ':'FAIL ')+name);};

const identity=read('api/identity/schema_contract.php');
const orderVehicle=read('api/migrations/030_orders_vehicle_category_health.php');
const stableVehicle=read('api/migrations/144_vehicle_catalog_stable_ids.php');
const vehicleDomain=read('api/vehicle_passport.php');
const obdApi=read('api/obd.php');
const obdSession=read('api/migrations/135_obd_elm327_diagnostics.php');
const obdJobs=read('api/migrations/136_obd_remote_control_plane.php');
const nativeBridge=read('js/mobile_native_bridge.js');
const formUi=read('js/next/onboarding/onboarding_form_ui.js');
const formValidation=read('js/next/onboarding/onboarding_form_validation.js');
const policy=read('docs/harness/ENTERPRISE_DATA_FORM_CONTRACT_V1.md');
const phpContract=read('api/contracts/enterprise_data_v1.php');
const jsContract=read('js/next/contracts/enterprise_data_v1.js');
const schema=JSON.parse(read('schemas/enterprise-data-v1.schema.json'));
const onboardingApi=read('js/next/onboarding/onboarding_api.js');
const cabinetApi=read('js/next/client/client_cabinet_api.js');
const onboardingBundle=read('js/boot/runtime_onboarding_bundle.js');
const coreBundle=read('js/boot/runtime_core_bundle.js');

for(const table of ['accounts','persons','person_profiles','contexts','context_members','auth_sessions','capabilities']){
  expect('identity contract: '+table,identity.includes("'"+table+"'"));
}
expect('orders bind client vehicle',orderVehicle.includes("'client_vehicle_id'")&&orderVehicle.includes('idx_orders_vehicle_status'));
expect('stable vehicle brand id',stableVehicle.includes("'brand_id'")||stableVehicle.includes('brand_id VARCHAR'));
expect('stable vehicle model id',stableVehicle.includes("'model_id'")||stableVehicle.includes('model_id VARCHAR'));
expect('stable vehicle generation id',stableVehicle.includes("'generation_id'")||stableVehicle.includes('generation_id VARCHAR'));
expect('vehicle domain accepts vehicleId',vehicleDomain.includes("$b['vehicleId']")||vehicleDomain.includes("$_GET['id']"));
expect('vehicle issue relation keeps order id',vehicleDomain.includes('order_id')&&vehicleDomain.includes("$b['orderId']"));

expect('OBD session stores vehicle relation',obdSession.includes('vehicle_id VARCHAR'));
expect('OBD jobs store vehicle relation',obdJobs.includes('vehicle_id VARCHAR'));
expect('OBD API resolves vehicleId',obdApi.includes("$payload['vehicleId']")||obdApi.includes("$_GET['vehicleId']"));
expect('OBD API has vehicle ownership guard',obdApi.includes('kareta_obd_vehicle_access')&&obdApi.includes('VEHICLE_FORBIDDEN'));
expect('OBD sync requires vehicleId',obdApi.includes('VEHICLE_ID_REQUIRED')&&obdApi.includes("if($vehicleId==='')"));
expect('OBD sync source remains android',obdApi.includes("'android'"));

for(const command of ['getLocation','scanVin','scanQr','takePhoto','pickImage','elmConnect','elmSnapshot','offlineEnqueue','share']){
  expect('native capability boundary: '+command,nativeBridge.includes(command));
}

expect('onboarding form UI module exists',formUi.includes('KaretaOnboardingFormUI')&&formUi.includes('registrationForm'));
expect('onboarding validation module exists',formValidation.includes('KaretaOnboardingFormValidation')&&formValidation.includes('validateRegistration'));
expect('onboarding source uses form contract',onboardingApi.includes("KaretaFormContract?.prepare?.('onboarding'"));
expect('vehicle source uses form contract',cabinetApi.includes("formPayload('vehicle'"));
expect('generated onboarding bundle contains form contract',onboardingBundle.includes("KaretaFormContract?.prepare?.('onboarding'"));
expect('generated core bundle contains vehicle form contract',coreBundle.includes("formPayload('vehicle'"));

for(const key of ['accountId','personId','contextId','cityId','vehicleId','brandId','modelId','generationId','orderId','diagnosticSessionId','diagnosticJobId','requestId','idempotencyKey','schemaVersion']){
  expect('PHP canonical key '+key,phpContract.includes("'"+key+"'"));
  expect('JS canonical key '+key,jsContract.includes("'"+key+"'"));
}
expect('canonical schema version',schema.properties?.schemaVersion?.const==='1.0.0');
expect('policy English data canon',policy.includes('ключи DB/API/DTO/schema/ID и enum-значения — английские'));
expect('policy forbids duplicate vehicle identity',policy.includes('carId')&&policy.includes('autoId')&&policy.includes('elmVehicleId'));
expect('policy keeps Android capability-only boundary',policy.includes('Android владеет только native capabilities'));

const orderWidth=/client_vehicle_id[^\n]*VARCHAR\((\d+)\)/i.exec(orderVehicle)?.[1]||'unknown';
const obdWidth=/vehicle_id VARCHAR\((\d+)\)/i.exec(obdSession)?.[1]||'unknown';
if(orderWidth!==obdWidth){
  console.log('NOTICE ID_WIDTH_COMPAT_DEBT orders.client_vehicle_id='+orderWidth+' obd.vehicle_id='+obdWidth+' (v1 intentionally does not migrate DB)');
}

const failed=checks.filter(x=>!x.ok);
console.log('\nENTERPRISE_DATA_FORM_CONTRACT: '+(failed.length?'FAIL':'PASS')+' checks='+(checks.length-failed.length)+'/'+checks.length);
if(failed.length) process.exit(1);
