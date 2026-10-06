#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=[];
const expect=(ok,name)=>{console.log((ok?'PASS ':'FAIL ')+name);if(!ok)fail.push(name);};

const onboarding=read('js/next/onboarding/onboarding_api.js');
const identity=read('api/identity/schema_contract.php');
const vehicleMigration=read('api/migrations/144_vehicle_catalog_stable_ids.php');
const vehicleApi=read('js/next/client/client_cabinet_api.js');
const orders=read('js/next/orders/orders_api.js');
const bridge=read('js/mobile_native_bridge.js');
const obd=read('api/obd.php');
const history=read('api/vehicle_passport.php');

expect(onboarding.includes("KaretaFormContract?.prepare?.('onboarding'"),'SPA form -> canonical form contract');
expect(identity.includes("'contexts'")&&identity.includes("'context_members'"),'Identity context contract');
expect(vehicleMigration.includes('brand_id')&&vehicleMigration.includes('model_id')&&vehicleMigration.includes('generation_id'),'stable vehicle catalog IDs');
expect(vehicleApi.includes("formPayload('vehicle'"),'vehicle form -> canonical vehicle DTO');
expect(orders.includes("prepare?.('order'"),'order payload -> canonical order DTO');
for(const command of ['elmConnect','elmSnapshot','offlineEnqueue']) expect(bridge.includes(command),'Android bridge '+command);
expect(obd.includes('VEHICLE_ID_REQUIRED'),'OBD sync requires vehicleId');
expect(obd.includes('kareta_obd_vehicle_access')&&obd.includes('VEHICLE_FORBIDDEN'),'OBD ownership guard');
expect(obd.includes("'diagnosticSessionId'")&&obd.includes("'orderId'"),'OBD returns canonical diagnostic relation');
expect(history.includes("$b['vehicleId']")&&history.includes("$b['orderId']"),'existing vehicle history relation remains vehicleId/orderId based');

console.log('NOT RUN browser E2E');
console.log('NOT RUN real MySQL migration/integration');
console.log('NOT RUN Android device/WebView/Bluetooth ELM327');
process.exit(fail.length?1:0);
