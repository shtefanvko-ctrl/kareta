'use strict';
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};
try{execFileSync('node',[path.join(root,'tools/build_master_runtime_css.js'),'--check'],{stdio:'pipe'});}catch(e){console.error(String(e.stdout||e.stderr||e.message));process.exit(1)}
const source=read('css/next/master_ui_exchange_schedule_flattening.css'),bundle=read('css/routes/master_runtime.css');
const sources=['master_surfaces.css','master_business_runtime.css','master_order_lifecycle.css','master_aftercare.css','master_service_pricing_native.css','master_exchange_acceptance_flow.css','master_ui_exchange_schedule_flattening.css'];
for(const name of sources)expect(bundle.includes(`SOURCE: css/next/${name}`),`master_runtime missing ${name}`);
expect(source.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),'source mobile toolbar is not 2-column');
expect(bundle.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),'generated master_runtime lacks 2-column mobile toolbar');
expect(!bundle.includes('.k-master-r71-toolbar__actions{grid-template-columns:1fr 1fr 1fr}'),'generated master_runtime contains stale 3-column toolbar');
expect(!/k-master-r71-toolbar__actions[^{}]*\{[^}]*repeat\(3,minmax\(0,1fr\)\)/.test(bundle),'generated master_runtime contains stale repeat(3) toolbar');
console.log('OK master_bundle_sync_test');
