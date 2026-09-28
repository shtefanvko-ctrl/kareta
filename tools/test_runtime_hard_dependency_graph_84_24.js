'use strict';
const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const registry=fs.readFileSync(path.join(root,'inc/asset_registry.php'),'utf8');
const block=(registry.split("'scripts' => [",2)[1]||'').split("],\n        'images'",1)[0]||'';
const paths=[...block.matchAll(/'([^']+\.js)'/g)].map(m=>m[1]);const index=new Map(paths.map((p,i)=>[p,i]));
const graph={
  'js/next/catalog/catalog_api.js':['js/next/api_client.js'],
  'js/next/catalog/catalog_state.js':['js/next/catalog/catalog_api.js'],
  'js/next/services/service_offers_api.js':['js/next/api_client.js'],
  'js/next/services/service_offers_state.js':['js/next/services/service_offers_api.js'],
  'js/next/shop/shop_api.js':['js/next/api_client.js'],
  'js/next/shop/shop_state.js':['js/next/shop/shop_api.js'],
  'js/next/pages/orders.js':['js/next/page_ui.js','js/next/orders/orders_api.js','js/next/orders/orders_state.js'],
  'js/next/pages/request.js':['js/next/page_ui.js','js/next/api_client.js'],
  'js/next/pages/client_request_final.js':['js/next/api_client.js','js/next/client/client_cabinet_api.js','js/next/page_ui.js'],
  'js/next/pages/parts.js':['js/next/shop/shop_state.js','js/next/catalog_cards.js','js/next/shop/shop_api.js'],
  'js/next/seller/seller_api.js':['js/next/api_client.js'],
  'js/next/seller/seller_state.js':['js/next/seller/seller_api.js'],
  'js/next/pages/seller.js':['js/next/page_ui.js','js/next/seller/seller_api.js','js/next/seller/seller_state.js','js/next/api_client.js'],
  'js/next/client/client_cabinet_api.js':['js/next/api_client.js'],
  'js/next/client/first_vehicle_flow.js':['js/next/client/client_cabinet_api.js'],
  'js/next/pages/client_first_vehicle.js':['js/next/client/client_cabinet_api.js','js/next/client/first_vehicle_flow.js'],
  'js/next/pages/cabinet.js':['js/next/page_ui.js','js/next/client/client_cabinet_api.js'],
  'js/next/account_window.js':['js/next/client/client_cabinet_api.js'],
  'js/next/pages/services.js':['js/next/page_ui.js','js/next/catalog/catalog_state.js','js/next/catalog_cards.js'],
  'js/next/pages/service_management.js':['js/next/page_ui.js','js/next/services/service_offers_state.js','js/next/services/service_offers_api.js']
};
const errors=[];let edges=0;
for(const [consumer,deps] of Object.entries(graph)){
  const ci=index.get(consumer);if(ci==null){errors.push(`consumer missing: ${consumer}`);continue;}
  for(const provider of deps){edges++;const pi=index.get(provider);if(pi==null)errors.push(`provider missing: ${provider}`);else if(pi>=ci)errors.push(`bad order: ${provider}(${pi}) must be before ${consumer}(${ci})`);}
}
if(errors.length){console.error(errors.map(x=>'FAIL: '+x).join('\n'));process.exit(1)}
console.log(`Runtime hard dependency graph 84.24: ${edges} provider→consumer edges OK`);
