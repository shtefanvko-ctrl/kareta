'use strict';
const {read,routePlan,styleOrder,MASTER_ROUTE_KEYS}=require('./master_route_contract_utils');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};
const plan=routePlan(),surface='css/next/master_surface_contract.css';
const loader=read('js/next/route_asset_loader.js');
expect(loader.includes("if(String(bundle?.cascade||'')!=='last')return"),'route loader lacks cascade:last promotion');
expect(loader.includes('node.parentNode.appendChild(node)'),'route loader does not re-append canonical stylesheet');
expect(loader.includes('if(state.loadedBundles.has(bundleName)){promoteCascadeStyles(bundle);'),'already-loaded route bundle is not promoted on revisit');
for(const target of MASTER_ROUTE_KEYS){
  const before=MASTER_ROUTE_KEYS.filter(k=>k!==target);
  const order=styleOrder(plan,[...before,target]);
  expect(order.at(-1)===surface,`${target}: retained route CSS can outrank Master Surface Contract after full route sequence`);
  expect(order.filter(x=>x===surface).length===1,`${target}: canonical Master Surface Contract duplicated in sequence`);
}
const serviceFromMaster=styleOrder(plan,['masterDashboard','serviceManagement']);
const serviceFromCabinet=styleOrder(plan,['cabinet','serviceManagement']);
for(const [label,order] of [['master→services',serviceFromMaster],['cabinet→services',serviceFromCabinet]]){
  expect(order.includes('css/next/master_requests_workplace_services.css'),`${label}: service CSS missing`);
  expect(order.at(-1)===surface,`${label}: final cascade is not canonical Master Surface Contract`);
}
console.log('OK master_route_sequence_visual_test');
