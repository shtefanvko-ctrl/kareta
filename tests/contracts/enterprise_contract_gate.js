#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const failures=[];
const expect=(ok,name)=>{console.log((ok?'PASS ':'FAIL ')+name);if(!ok)failures.push(name);};

const schema=JSON.parse(read('schemas/enterprise-data-v1.schema.json'));
const allow=JSON.parse(read('tests/contracts/legacy_allowlist.json'));
const data=require('../../js/next/contracts/enterprise_data_v1.js');
const form=require('../../js/next/forms/form_contract.js');

const cyr=/[\u0400-\u052F]/;
const canonicalProps=Object.keys(schema.properties.data.properties||{});
for(const key of canonicalProps) expect(/^[A-Za-z][A-Za-z0-9]*$/.test(key)&&!cyr.test(key),'canonical key '+key);
for(const [name,definition] of Object.entries(schema.properties.data.properties||{})){
  for(const value of definition.enum||[]) expect(typeof value!=='string'||(!cyr.test(value)&&/^[\x20-\x7E]+$/.test(value)),'English enum '+name+'='+value);
}
expect(!canonicalProps.includes('carId')&&!canonicalProps.includes('autoId')&&!canonicalProps.includes('elmVehicleId'),'no duplicate vehicle identity keys');

const declared=data.legacyAliases;
for(const [legacy,canonical] of Object.entries(declared)){
  expect(allow.fields[legacy]===canonical,'legacy alias allowlisted '+legacy);
}
for(const legacy of Object.keys(allow.fields)) expect(declared[legacy]===allow.fields[legacy],'allowlist alias implemented '+legacy);

const canonical=data.canonicalDto({client_vehicle_id:'veh_1',order_id:'ord_1',dtc_code:'P0300'});
expect(canonical.vehicleId==='veh_1'&&canonical.orderId==='ord_1'&&canonical.dtcCode==='P0300','legacy aliases canonicalize');
expect(!('client_vehicle_id' in canonical)&&!('order_id' in canonical),'canonical DTO excludes mapped snake_case');

const boundaryFiles=[
  'js/next/onboarding/onboarding_api.js',
  'js/next/client/client_cabinet_api.js',
  'js/next/orders/orders_api.js',
  'js/next/work_orders/work_order_api.js',
  'js/next/work_orders/master_workplace_api.js',
  'js/next/work_orders/sto_workplace_api.js',
  'js/next/seller/seller_api.js'
];
for(const file of boundaryFiles) expect(read(file).includes('KaretaFormContract'),'form contract boundary '+file);

const cityCatalog=read('js/next/onboarding/onboarding_selection_catalog.js');
const masterOnboarding=read('js/next/pages/master_onboarding.js');
for(const cityId of ['almaty','astana','shymkent','karaganda','ust-kamenogorsk','semey','pavlodar','ridder']){
  expect(cityCatalog.includes("id:'"+cityId+"'"),'stable cityId '+cityId);
}
expect(!masterOnboarding.includes("String(name).toLowerCase().replace(/\\s+/g,'_')"),'master fallback does not derive ID from localized label');

for(const file of ['js/next/contracts/enterprise_data_v1.js','js/next/forms/form_contract.js']){
  const source=read(file);
  const bad=[...source.matchAll(/['"]([^'"]*[\u0400-\u052F][^'"]*)['"]\s*:/g)];
  expect(bad.length===0,'no Cyrillic object keys in '+file);
}

const registry=read('inc/asset_registry.php');
const dataIndex=registry.indexOf("'js/next/contracts/enterprise_data_v1.js'");
const formIndex=registry.indexOf("'js/next/forms/form_contract.js'");
const onboardingBundleIndex=registry.indexOf("'js/boot/runtime_onboarding_bundle.js'");
expect(dataIndex>=0&&formIndex>dataIndex&&onboardingBundleIndex>formIndex,'contract runtime loads before onboarding bundle');

const onboardingBundle=read('js/boot/runtime_onboarding_bundle.js');
const coreBundle=read('js/boot/runtime_core_bundle.js');
expect(onboardingBundle.includes("KaretaFormContract?.prepare?.('onboarding'"),'generated onboarding bundle contains compatibility hook');
expect(coreBundle.includes("formPayload('vehicle'"),'generated core bundle contains vehicle compatibility hook');

const obd=read('api/obd.php');
expect(obd.includes("if($vehicleId==='')")&&obd.includes("'VEHICLE_ID_REQUIRED'"),'OBD sync requires vehicleId');
expect(obd.includes('kareta_obd_vehicle_access')&&obd.includes("'VEHICLE_FORBIDDEN'"),'OBD ownership guard retained');

if(failures.length){
  console.error('\nENTERPRISE_CONTRACT_GATE: FAIL static='+failures.length);
  process.exit(1);
}

const commands=[
  ['php',['-l','api/contracts/enterprise_data_v1.php']],
  ['php',['-l','api/obd.php']],
  ['node',['--check','js/next/contracts/enterprise_data_v1.js']],
  ['node',['--check','js/next/forms/form_contract.js']],
  ['node',['--check','tests/contracts/enterprise_data_contract_v1.js']],
  ['node',['--check','tests/contracts/form_contract_v1.js']],
  ['node',['--check','tests/integration/enterprise_golden_flow.js']],
  ['node',['--check','tools/test_enterprise_data_form_contract.js']],
  ['php',['tests/contracts/enterprise_data_contract_v1.php']],
  ['node',['tests/contracts/enterprise_data_contract_v1.js']],
  ['node',['tests/contracts/form_contract_v1.js']],
  ['node',['tests/integration/enterprise_golden_flow.js']],
  ['node',['tools/test_enterprise_data_form_contract.js']]
];

for(const [command,args] of commands){
  console.log('\n$ '+command+' '+args.join(' '));
  const result=spawnSync(command,args,{cwd:root,stdio:'inherit'});
  if(result.error){
    console.error('ENTERPRISE_CONTRACT_GATE: FAIL unable to run '+command+': '+result.error.message);
    process.exit(1);
  }
  if(result.status!==0){
    console.error('ENTERPRISE_CONTRACT_GATE: FAIL command exit='+result.status);
    process.exit(result.status||1);
  }
}

console.log('\nENTERPRISE_CONTRACT_GATE: PASS');
