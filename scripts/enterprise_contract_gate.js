#!/usr/bin/env node
'use strict';
const cp=require('child_process');
const path=require('path');
const root=path.resolve(__dirname,'..');

function run(command,args){
  console.log('\n> '+command+' '+args.join(' '));
  cp.execFileSync(command,args,{cwd:root,stdio:'inherit'});
}

const phpFiles=[
  'api/contracts/enterprise_data_v1.php',
  'api/obd.php',
  'api/data_integrity.php'
];
for(const file of phpFiles) run('php',['-l',file]);

const jsFiles=[
  'js/next/contracts/enterprise_data_v1.js',
  'js/next/forms/form_contract.js',
  'js/next/onboarding/onboarding_api.js',
  'js/next/onboarding/onboarding_selection_catalog.js',
  'js/next/pages/master_onboarding.js',
  'js/next/client/client_cabinet_api.js',
  'js/next/orders/orders_api.js',
  'js/next/work_orders/work_order_api.js',
  'js/next/work_orders/master_workplace_api.js',
  'js/next/work_orders/sto_workplace_api.js',
  'js/next/seller/seller_api.js',
  'tests/contracts/enterprise_data_contract_v1.js',
  'tests/contracts/form_contract_v1.js',
  'tests/contracts/enterprise_contract_gate.js',
  'tests/integration/enterprise_golden_flow.js',
  'tools/test_enterprise_data_form_contract.js'
];
for(const file of jsFiles) run('node',['--check',file]);

run('php',['tests/contracts/enterprise_data_contract_v1.php']);
run('node',['tests/contracts/enterprise_data_contract_v1.js']);
run('node',['tests/contracts/form_contract_v1.js']);
run('node',['tests/contracts/enterprise_contract_gate.js']);
run('node',['tools/test_enterprise_data_form_contract.js']);
run('node',['tests/integration/enterprise_golden_flow.js']);
try {
  run('node',['tools/build_boot_js_bundles.js','--check']);
} catch (error) {
  console.error('BOOT_BUNDLE_FRESHNESS: FAIL; generated diff follows');
  cp.execFileSync('node',['tools/build_boot_js_bundles.js'],{cwd:root,stdio:'inherit'});
  try {
    cp.execFileSync('git',['diff','--','js/boot/runtime_onboarding_bundle.js','js/boot/runtime_core_bundle.js'],{cwd:root,stdio:'inherit'});
  } catch (_diffError) {}
  process.exit(1);
}

console.log('\nENTERPRISE_CONTRACT_GATE: PASS');
console.log('NOT RUN data_integrity runtime against real MySQL');
console.log('NOT RUN browser E2E');
console.log('NOT RUN Android device/WebView/Bluetooth ELM327');
