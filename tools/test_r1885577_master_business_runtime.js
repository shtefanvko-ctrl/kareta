'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const workplaceApi=read('api/master_workplace.php');
for(const marker of ['KaretaIdentityContextService','legacy_entity_id','kareta_master_workplace_business','revenue_month','service_offers','master_exchange_responses','unread_master']){
  assert(workplaceApi.includes(marker),`master workplace DB marker missing: ${marker}`);
}
assert(workplaceApi.includes("COALESCE(o.master_id,'')='' AND o.master_user_id=?"),'orders are not isolated by current master profile');
assert(workplaceApi.includes("COALESCE(master_id,'')='' AND master_user_id=?"),'business aggregates are not isolated by current master profile');

const db=read('api/db.php');
assert(db.includes("function kareta_master_exchange_context"),'master exchange context is missing');
assert(db.includes("require_once __DIR__ . '/identity/context_service.php'"),'DB API does not load Identity context service');
assert(db.includes("kareta_master_workplace_profile($pdo)"),'exchange does not use selected Identity master profile');
assert(db.includes("COALESCE(master_id,'')='' AND master_user_id=?"),'exchange state can mix multiple master contexts');


for(const marker of ["masterWorkplace.availability.save","kareta_require_api_capability($pdo,'calendar.manage'","kareta_require_api_capability($pdo,'work_orders.update'","not_current_master_profile"]){
  assert(db.includes(marker),`capability/ownership bridge missing: ${marker}`);
}

const serviceCatalog=read('api/catalog/service_catalog.php');
assert(serviceCatalog.includes("Resolve the concrete profile selected in Identity"),'service offers do not use selected master profile');


const workOrders=read('api/work_orders.php');
assert(workOrders.includes('kareta_work_order_effective_role'),'work-order permissions still depend only on legacy role');
assert(workOrders.includes('kareta_master_workplace_profile($pdo)'),'work-order access is not isolated by selected master profile');
assert(serviceCatalog.includes("$profileType === 'master'"),'service management does not recognize selected master Identity context');

const schedule=read('js/next/pages/master_schedule.js');
for(const forbidden of ['const demos','demoItems','Режим предпросмотра','isDemo','ДЕМО']){
  assert(!schedule.includes(forbidden),`master schedule still contains demo runtime: ${forbidden}`);
}
assert(schedule.includes('только реальные записи из базы'),'schedule DB source notice is missing');

const workplace=read('js/next/pages/master_workplace.js');
const native55=workplace.includes("NATIVE_WORKPLACE_CONTRACT='R188.5.5.6.55'");
if(native55){
  const exchange=read('js/next/pages/work_feed.js');
  for(const marker of ['data-exchange-quick','data-exchange-response','data-exchange-hide'])assert(exchange.includes(marker),`separate Master Exchange UI marker missing: ${marker}`);
  assert(workplace.includes('#/master/exchange'),'native workplace must link to separate Master Exchange');
}else{
  for(const marker of ['k-master-business-metrics','k-master-exchange-panel','data-master-response-form','data-save-lead','data-hide-lead','data-cancel-response'])assert(workplace.includes(marker),`master business UI marker missing: ${marker}`);
}

const client=read('js/next/work_orders/master_workplace_api.js');
for(const action of ['masterExchange.saveResponse','masterExchange.cancelResponse','masterExchange.toggleSaved','masterExchange.toggleHidden']){
  assert(client.includes(action),`master exchange API action missing: ${action}`);
}
assert(client.includes('request_id:payload?.request_id||payload?.requestId'),'exchange save/hide payload is not normalized for server');
assert(db.includes("owner_type='master' AND owner_entity_id=?"),'exchange feed does not match service offers by current master entity');

const registry=read('inc/asset_registry.php');
assert(registry.includes("'css/next/master_business_runtime.css'"),'master business CSS is not registered');
for(const file of ['inc/asset_version.php','sw.js','index.php']){
  assert(read(file).includes('r1885577-master-business-runtime'),`${file} asset marker missing`);
}
console.log('R188.5.5.6.17 master business runtime tests OK');
