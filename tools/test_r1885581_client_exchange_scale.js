'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');const assert=(v,m)=>{if(!v)throw new Error(m);};
const migration=read('api/migrations/107_client_exchange_production_scale.php');
for(const x of ['exchange_status','exchange_round','exchange_published_at','exchange_deadline_at','exchange_max_responses','idx_orders_exchange_feed','idx_exchange_request_status_price'])assert(migration.includes(x),`missing ${x}`);
const api=read('api/client_exchange_scale.php');for(const fn of ['kareta_client_exchange_scale_dashboard','kareta_client_exchange_scale_republish'])assert(api.includes(`function ${fn}`),`missing ${fn}`);assert(api.includes('LIMIT $limit OFFSET $offset'),'pagination missing');
const db=read('api/db.php');for(const action of ['clientExchange.dashboard','clientExchange.republish'])assert(db.includes(action),`dispatch missing ${action}`);for(const guard of ['exchange_deadline_passed','exchange_response_limit_reached','exchange_status'])assert(db.includes(guard),`guard missing ${guard}`);
const orders=read('js/next/pages/orders.js');
if(orders.includes('k-client-orders-native')){for(const marker of ['data-client-order-offers','data-client-bid-confirm','data-client-bid-decline','data-client-exchange-republish','Предложения мастеров'])assert(orders.includes(marker),`native exchange UI missing ${marker}`);}else{for(const marker of ['k-client-exchange-board','data-client-bid-accept','data-client-bid-decline','data-client-exchange-republish','Выберите лучшее предложение'])assert(orders.includes(marker),`UI missing ${marker}`);}
const apiJs=read('js/next/orders/orders_api.js');for(const fn of ['exchangeDashboard','acceptExchangeResponse','declineExchangeResponse','republishExchangeOrder'])assert(apiJs.includes(fn),`client API missing ${fn}`);
const registry=read('inc/asset_registry.php');assert(registry.includes('client_exchange_scale.css'),'css registry missing');
console.log('R188.5.5.6.21 client exchange production scale OK');
