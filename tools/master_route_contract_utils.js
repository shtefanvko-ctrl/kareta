'use strict';
const fs=require('fs');
const path=require('path');
const {execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
function routePlan(){
  const code=`require ${JSON.stringify(path.join(root,'inc/asset_registry.php'))}; echo json_encode(kareta_route_asset_plan(), JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);`;
  return JSON.parse(execFileSync('php',['-r',code],{encoding:'utf8'}));
}
function matchingBundles(plan,routeKey){return Object.entries(plan).filter(([name,b])=>!name.startsWith('_')&&b&&b.lazy===true&&Array.isArray(b.routeKeys)&&b.routeKeys.includes(routeKey));}
function styleOrder(plan,sequence){
  const order=['css/runtime_boot_bundle.css'];
  for(const routeKey of sequence){
    for(const [,bundle] of matchingBundles(plan,routeKey)){
      for(const style of Array.isArray(bundle.styles)?bundle.styles:[]){if(!order.includes(style))order.push(style)}
      if(String(bundle.cascade||'')==='last'){
        for(const style of Array.isArray(bundle.styles)?bundle.styles:[]){const i=order.indexOf(style);if(i>=0)order.splice(i,1);order.push(style)}
      }
    }
  }
  return order;
}
const MASTER_ROUTE_KEYS=Object.freeze(['masterDashboard','masterSchedule','masterExchange','serviceManagement','masterProfileOwner','masterWallOwner','masterWorks','masterReviews','cabinet','cabinetSettings','orders','chats','parts','community']);
module.exports={root,read,routePlan,matchingBundles,styleOrder,MASTER_ROUTE_KEYS};
