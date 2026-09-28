'use strict';
const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');const registry=read('inc/asset_registry.php');const request=read('js/next/pages/client_request_final.js');const index=read('index.php');const version=read('inc/asset_version.php');
const errors=[];const ok=(v,m)=>{if(!v)errors.push(m)};
const pos=p=>registry.indexOf(`'${p}'`);
const api=pos('js/next/api_client.js'),cabinet=pos('js/next/client/client_cabinet_api.js'),requestPage=pos('js/next/pages/request.js'),final=pos('js/next/pages/client_request_final.js'),firstFlow=pos('js/next/client/first_vehicle_flow.js'),firstPage=pos('js/next/pages/client_first_vehicle.js');
ok(api>=0&&cabinet>api,'ClientCabinetApi must load after ApiClient');
ok(requestPage>cabinet,'Request page must load after ClientCabinetApi so CLIENT final flow can mount safely');
ok(final>cabinet&&final>api,'client_request_final must load after ApiClient and ClientCabinetApi');
ok(firstFlow>cabinet&&firstPage>firstFlow,'First Car dependency order is invalid');
ok(!request.includes("throw new Error('CLIENT Request final dependencies are required')"),'client_request_final must not kill atomic boot on dependency drift');
ok(request.includes("deferScript('client_request_final',MODULE_DEPENDENCIES,scriptSource)"),'client_request_final must use runtime dependency deferral');
ok(request.includes('__KARETA_CLIENT_REQUEST_FINAL_MODULE__'),'client_request_final duplicate-load guard missing');
ok(index.includes("if(atomicState && atomicState.phase!=='ready') return;"),'secondary runtime watchdog must not compete with atomic boot');
ok(index.includes('warmRuntimeFetches(index+1,2)'),'atomic runtime must use bounded preload look-ahead');
ok(!index.includes('for(const item of scripts){\n          try{const link=document.createElement(\'link\');link.rel=\'preload\''),'atomic runtime still preloads the entire registry');
const vm=/188\.5\.5\.6\.84\.(\d+)/.exec(version);ok(vm&&Number(vm[1])>=24,'asset version must be 84.24+');
if(errors.length){console.error(errors.map(x=>'FAIL: '+x).join('\n'));process.exit(1)}
console.log('Atomic runtime dependency order 84.24: CLIENT Request provider order + fail-safe deferral + bounded preload OK');
