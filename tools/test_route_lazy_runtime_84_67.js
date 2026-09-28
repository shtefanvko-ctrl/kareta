'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const registry=read('inc/asset_registry.php');
const loader=read('js/next/route_asset_loader.js');
const app=read('js/next/app_next.js');
const requestWindow=read('js/next/request_window.js');
const services=read('js/next/pages/services.js');
const consolidated=read('css/next/client_runtime_consolidated.css');
const asset=read('inc/asset_version.php');const sw=read('sw.js');
const eagerBlock=(registry.match(/'scripts'\s*=>\s*\[([\s\S]*?)\],\s*'images'/)||[])[1]||'';
const extracted=[
  'js/next/catalog/catalog_api.js','js/next/catalog/catalog_state.js',
  'js/next/services/service_offers_api.js','js/next/services/service_offers_state.js',
  'js/next/pages/services.js','js/next/pages/service_management.js',
  'js/next/pages/profile_relations.js','js/next/pages/following.js',
  'js/next/pages/request.js','js/next/work_orders/work_order_api.js','js/next/pages/work_order.js'
];
for(const file of extracted){
  expect(registry.includes(`'${file}'`),`route plan missing extracted asset: ${file}`);
  expect(!eagerBlock.includes(`'${file}'`),`extracted asset remains eager: ${file}`);
}
for(const name of ['servicesCatalog','serviceOffers','serviceManagement','profile','following','request','workOrder']){
  expect(registry.includes(`'${name}' => [`),`84.67 bundle missing: ${name}`);
}
expect(/'mode' => 'route-lazy-v[2-5]'/.test(registry),'route-lazy-v2+ metadata missing');
expect(registry.includes("'cssMode' => 'late-route-overrides'")||/'cssMode' => 'route-domain-css-v[12]'/.test(registry)||registry.includes("'cssMode' => 'boot-css-bundle-v1'")||registry.includes("'cssMode' => 'critical-boot-route-css-v2'"),'route css mode missing');
expect(registry.includes("'styles' => ['css/next/request_5_steps.css']"),'request lazy css missing');
expect(registry.includes("'styles' => ['css/next/client_work_order_v2.css']"),'work-order lazy css missing');
expect(!consolidated.includes('final five-step client request flow'),'request layer still embedded in eager consolidated CSS');
expect(!consolidated.includes('client work-order V2'),'work-order layer still embedded in eager consolidated CSS');
expect(consolidated.includes('consolidated eager client runtime overrides'),'84.67 eager consolidated marker missing');

for(const key of ['services','serviceManagement','profile','following','requestNew','workOrder'])expect(loader.includes(`'${key}'`),`loader lazy route missing: ${key}`);
const appDeps=(app.match(/const APP_DEPENDENCIES=\[([\s\S]*?)\];/)||[])[1]||'';
expect(!appDeps.includes('KaretaCatalogState'),'CatalogState remained app_next boot dependency');
expect(!app.includes('const catalogState = window.KaretaCatalogState'),'CatalogState still captured eagerly by app_next');
expect(app.includes('window.KaretaCatalogState?.hydrate?.'),'optional late catalog hydrate missing');
expect(requestWindow.includes("ensureRoute('requestNew'"),'request window does not lazy-load request route');
expect(requestWindow.includes('data-request-window-retry'),'request window lazy retry missing');
expect(requestWindow.includes('loadController'),'request window lazy cancellation missing');
expect(services.includes("document.readyState==='loading'")&&services.includes('initDocumentHooks'),'services lazy DOM-ready recovery missing');

try{
  const probe=cp.execFileSync('php',['-r',`require ${JSON.stringify(path.join(root,'inc/asset_registry.php'))}; $r=kareta_asset_registry(); echo json_encode(['bootJs'=>count($r['scripts']),'sourceJs'=>count($r['scriptSources']??$r['scripts']),'eagerCss'=>count($r['styles']),'lazyJs'=>count(kareta_route_asset_paths('scripts')),'lazyCss'=>count(kareta_route_asset_paths('styles'))]);`],{encoding:'utf8'}).trim();
  const data=JSON.parse(probe);
  expect(data.bootJs>=1&&data.bootJs<=105,`unexpected boot JS request count ${data.bootJs}`);
  expect(data.sourceJs<=105&&data.sourceJs>=70,`unexpected eager source JS after later extraction, got ${data.sourceJs}`);
  expect(data.eagerCss<=111&&data.eagerCss>=1,`unexpected eager CSS after later consolidation, got ${data.eagerCss}`);
  expect(data.lazyJs>=26,`expected at least 26 lazy JS, got ${data.lazyJs}`);
  expect(data.lazyCss>=2,`expected at least 2 lazy CSS, got ${data.lazyCss}`);
}catch(e){fail.push(`registry count probe failed: ${e.message}`)}

const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1];
const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
const rev=Number(String(va||'').split('.').pop()||0);expect(rev>=67&&vs===va,'84.67+ version mismatch');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84.67 route lazy runtime wave 2: OK');
