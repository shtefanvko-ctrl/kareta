'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const target='css/routes/master_runtime.css';
const sources=[
  'css/next/design_contract.css',
  'css/next/master_surfaces.css',
  'css/next/master_business_runtime.css',
  'css/next/master_order_lifecycle.css',
  'css/next/master_aftercare.css',
  'css/next/master_service_pricing_native.css',
  'css/next/master_exchange_acceptance_flow.css',
  'css/next/master_ui_exchange_schedule_flattening.css',
  'css/next/master_client_r84_postlude.css',
];
function build(){
  const chunks=['/* KARETA.KZ R188.5.5.6.84.102 — GENERATED master route bundle. DO NOT EDIT. Run: node tools/build_master_runtime_css.js */\n'];
  for(const src of sources){
    const text=fs.readFileSync(path.join(root,src),'utf8').trimEnd();
    chunks.push(`\n/* ===== SOURCE: ${src} ===== */\n${text}\n`);
  }
  return chunks.join('');
}
const expected=build(),full=path.join(root,target);
if(process.argv.includes('--check')){
  const actual=fs.existsSync(full)?fs.readFileSync(full,'utf8'):'';
  if(actual!==expected){console.error(`STALE ${target}`);process.exit(1);}
  console.log(`master runtime fresh: ${sources.length} sources`);
}else{
  fs.writeFileSync(full,expected);
  console.log(`built ${target} (${Buffer.byteLength(expected)} bytes)`);
}
