#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const contract=require(path.join(root,'js/next/contracts/enterprise_data_v1.js'));
const schema=JSON.parse(fs.readFileSync(path.join(root,'schemas/enterprise-data-v1.schema.json'),'utf8'));
const failures=[];
const expect=(ok,name)=>{console.log((ok?'PASS ':'FAIL ')+name);if(!ok)failures.push(name);};

const dto=contract.canonicalDto({
  account_id:12,vehicle_id:'veh_1',brand_id:'toyota',model_id:'camry',
  generation_id:'xv70',order_id:'ord_1',diagnostic_session_id:'diag_1',dtc_code:'P0300'
});
expect(dto.accountId===12,'account_id -> accountId');
expect(dto.vehicleId==='veh_1','vehicle_id -> vehicleId');
expect(dto.brandId==='toyota'&&dto.modelId==='camry'&&dto.generationId==='xv70','stable vehicle ids');
expect(dto.orderId==='ord_1'&&dto.diagnosticSessionId==='diag_1','relation ids');
expect(dto.dtcCode==='P0300','DTC code canonicalized');
expect(dto.schemaVersion==='1.0.0','schema version injected');
expect(!('vehicle_id' in dto),'mapped legacy key removed from canonical DTO');

const compat=contract.compatPayload({client_vehicle_id:'veh_2',status:'available'});
expect(compat.client_vehicle_id==='veh_2','compat keeps legacy field');
expect(compat.vehicleId==='veh_2','compat adds vehicleId');
expect(compat.status==='available','English enum preserved');

const envelope=contract.envelope({vehicle_id:'veh_3'},{requestId:'req_test',idempotencyKey:'idem_test'});
expect(envelope.requestId==='req_test'&&envelope.idempotencyKey==='idem_test','envelope correlation');
expect(envelope.data.vehicleId==='veh_3','envelope data canonicalized');

const allowed=new Set(contract.commonKeys);
for(const key of ['accountId','vehicleId','diagnosticJobId','schemaVersion']) expect(allowed.has(key),'common key '+key);
expect(schema.properties.schemaVersion.const==='1.0.0','JSON schema version');
expect(schema.properties.data.propertyNames.pattern.includes('A-Za-z'),'JSON schema English key rule');

process.exit(failures.length?1:0);
