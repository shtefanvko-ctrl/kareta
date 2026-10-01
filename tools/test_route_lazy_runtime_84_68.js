'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const registry=read('inc/asset_registry.php');
const loader=read('js/next/route_asset_loader.js');
const windowEngine=read('js/next/window_engine.js');
const consolidated=read('css/next/client_runtime_consolidated.css');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');
const eagerJs=(registry.match(/'scripts'\s*=>\s*\[([\s\S]*?)\],\s*'images'/)||[])[1]||'';
const eagerCss=(registry.match(/'styles'\s*=>\s*\[([\s\S]*?)\],\s*'scripts'/)||[])[1]||'';

const extractedJs=[
  'js/next/pages/cabinet.js',
  'js/next/pages/chats.js',
  'js/next/pages/notifications.js',
  'js/next/pages/work_feed.js',
  'js/next/vehicles/vehicle_api.js','js/next/pages/vehicle.js',
  'js/next/orders/orders_api.js','js/next/orders/orders_state.js','js/next/pages/orders.js','js/next/pages/workflow.js',
  'js/next/pages/news.js','js/next/pages/info.js',
  'js/next/pages/master_onboarding.js',
  'js/next/work_orders/master_workplace_api.js','js/next/work_orders/master_schedule_api.js',
  'js/next/pages/master_workplace.js','js/next/pages/master_schedule.js',
  'js/next/pages/master_profile_owner.js','js/next/pages/master_wall.js','js/next/pages/master_works.js','js/next/pages/master_reviews.js',
];
for(const file of extractedJs){
  expect(registry.includes(`'${file}'`),`84.68 route plan missing JS: ${file}`);
  expect(!eagerJs.includes(`'${file}'`),`84.68 extracted JS remains eager: ${file}`);
}

const extractedCss=[
  'css/next/client_cabinet.css','css/next/chats.css','css/next/notifications.css','css/next/work_feed.css',
  'css/next/vehicle.css','css/next/client_orders_native.css',
  'css/next/client_legacy_surface_modernization.css','css/next/client_surface_modernization_phase2.css',
  'css/next/master_onboarding.css','css/next/master_schedule.css',
  'css/next/master_owner_profile.css','css/next/master_works_portfolio.css','css/next/master_reviews_social.css',
  'css/next/master_social_wall.css','css/next/master_workplace_native.css','css/next/master_requests_workplace_services.css',
  'css/next/master_order_communication_scheduling.css','css/next/master_capacity_reschedule.css',
  'css/next/master_shift_breaks_arrival.css','css/next/master_day_operations_auto_recovery.css',
  'css/next/master_auto_recovery_control_center.css','css/next/master_workspace_windows.css',
];
for(const file of extractedCss){
  expect(registry.includes(`'${file}'`),`84.68 route plan missing CSS: ${file}`);
  expect(!eagerCss.includes(`'${file}'`),`84.68 extracted CSS remains eager: ${file}`);
}

for(const name of [
  'cabinet','chats','notifications','workFeed','vehicle','ordersCore','ordersPage','workflowPage','news','infoPages',
  'clientLegacyPhase1','clientPhase2','masterOnboarding','masterWorkplaceApi','masterWorkspace',
  'masterProfileOwner','masterWall','masterWorks','masterReviews'
]){
  expect(registry.includes(`'${name}' => [`),`84.68 bundle missing: ${name}`);
}
expect(/'mode' => 'route-lazy-v[3-5]'/.test(registry),'84.68 route-lazy-v3+ metadata missing');
expect(/'cssMode' => 'route-domain-css-v[12]'/.test(registry)||registry.includes("'cssMode' => 'boot-css-bundle-v1'")||registry.includes("'cssMode' => 'critical-boot-route-css-v2'"),'84.68 route-domain CSS metadata missing');

for(const key of [
  'cabinet','cabinetGarage','cabinetSettings','chats','notifications','works','masterExchange','realWorks','workDetail',
  'vehicle','orders','workflow','news','masterNews','about','lawyer','masterOnboarding','masterDashboard',
  'masterProfileOwner','masterWallOwner','masterWorks','masterReviews','providerReviews'
]){
  expect(loader.includes(`'${key}'`),`route loader lazy key missing: ${key}`);
}

expect(registry.includes("'routeKeys' => ['masterDashboard','cabinetSettings']"),'master workplace API bundle must use canonical cabinetSettings route key');
expect(!registry.includes("'masterDashboard','masterWorkplaceSettings'"),'obsolete masterWorkplaceSettings pseudo route key remains in registry');
const cabinetSource=read('js/next/pages/cabinet.js');
expect(cabinetSource.includes("ensureRoute('cabinetSettings'"),'master cabinet settings recovery must use canonical cabinetSettings route');
expect(!cabinetSource.includes("ensureRoute('masterWorkplaceSettings'"),'obsolete masterWorkplaceSettings recovery path remains');
expect(!loader.includes("'masterWorkplaceSettings'"),'route loader still exposes obsolete masterWorkplaceSettings pseudo key');
expect(windowEngine.includes("loader?.isKnownLazy?.(meta.key)")&&windowEngine.includes("await loader.ensureRoute(meta.key"),'entity window does not wait for lazy route assets');
expect(windowEngine.includes('data-entity-window-retry'),'entity window lazy retry missing');
expect(windowEngine.includes("loadController.signal.aborted||state.targetHash!==target||!dialog.open"),'entity window stale-load guard missing');
expect(consolidated.includes('R188.5.5.6.84.68 — consolidated eager client runtime overrides'),'84.68 consolidated marker missing');
expect(!consolidated.includes('client legacy surface modernization, phase 1'),'phase1 still embedded in eager consolidated CSS');
expect(!consolidated.includes('client surface modernization, phase 2'),'phase2 still embedded in eager consolidated CSS');
expect(consolidated.includes('client surface modernization, phase 3'),'phase3 must remain eager for shared overlays');

try{
  const probe=cp.execFileSync('php',['-r',`require ${JSON.stringify(path.join(root,'inc/asset_registry.php'))}; $r=kareta_asset_registry(); echo json_encode(['bootJs'=>count($r['scripts']),'sourceJs'=>count($r['scriptSources']??$r['scripts']),'eagerCss'=>count($r['styles']),'lazyJs'=>count(kareta_route_asset_paths('scripts')),'lazyCss'=>count(kareta_route_asset_paths('styles'))]);`],{encoding:'utf8'}).trim();
  const data=JSON.parse(probe);
  expect(data.bootJs>=1&&data.bootJs<=84,`unexpected boot JS request count ${data.bootJs}`);
  expect(data.sourceJs<=84&&data.sourceJs>=65,`unexpected eager source JS after later extraction, got ${data.sourceJs}`);
  expect(data.eagerCss<=90&&data.eagerCss>=1,`unexpected eager CSS after later consolidation, got ${data.eagerCss}`);
  expect(data.lazyJs>=47,`expected at least 47 lazy JS, got ${data.lazyJs}`);
  expect(data.lazyCss>=25,`expected at least 25 lazy CSS, got ${data.lazyCss}`);
}catch(e){fail.push(`registry count probe failed: ${e.message}`)}

const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1];
const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
const rev=Number(String(va||'').split('.').pop()||0);expect(rev>=68&&vs===va,'84.68+ version mismatch');

if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84.68 route lazy runtime wave 3: OK');
