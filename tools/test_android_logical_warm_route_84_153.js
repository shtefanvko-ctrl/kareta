'use strict';

const {read,routePlan,styleOrder,MASTER_ROUTE_KEYS}=require('./master_route_contract_utils');

const expect=(value,message)=>{
  if(!value){
    console.error('FAIL:',message);
    process.exit(1);
  }
};

const plan=routePlan();
const loader=read('js/next/route_asset_loader.js');
const canonical=[
  'css/next/master_ui_foundation.css',
  'css/next/master_role_skin.css',
  'css/next/master_surface_contract.css',
  'css/routes/master_reference_final_84_130.css',
  'css/next/master_shell_canonical_84_143.css',
];

function assertCanonicalTail(label,order){
  for(const style of canonical){
    expect(order.includes(style),label+': missing canonical style '+style);
  }
  const indexes=canonical.map(style=>order.indexOf(style));
  for(let i=1;i<indexes.length;i++){
    expect(indexes[i]>indexes[i-1],label+': canonical style order is invalid');
  }
  expect(order.at(-1)===canonical.at(-1),label+': canonical Master shell is not final');
  for(const style of canonical){
    expect(order.filter(item=>item===style).length===1,label+': duplicate canonical style '+style);
  }
}

expect(loader.includes("if(String(bundle?.cascade||'')!=='last')return"),'cascade:last promotion guard missing');
expect(loader.includes('node.parentNode.appendChild(node)'),'cascade:last does not re-append retained styles');
expect(loader.includes('if(state.loadedBundles.has(bundleName)){promoteCascadeStyles(bundle);'),'loaded bundle revisit does not promote canonical styles');

for(const target of MASTER_ROUTE_KEYS){
  const prior=MASTER_ROUTE_KEYS.filter(key=>key!==target);
  assertCanonicalTail('revisit '+target,styleOrder(plan,[...prior,target]));
}

assertCanonicalTail('direct masterDashboard',styleOrder(plan,['masterDashboard']));
assertCanonicalTail('direct masterSchedule',styleOrder(plan,['masterSchedule']));
assertCanonicalTail('direct masterExchange',styleOrder(plan,['masterExchange']));

console.log('ANDROID_LOGICAL_WARM_ROUTE_84_153: PASS canonicalTail='+canonical.join(' -> '));
