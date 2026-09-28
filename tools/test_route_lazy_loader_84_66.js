'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const registry=read('inc/asset_registry.php');
const app=read('js/next/app_next.js');
const loader=read('js/next/route_asset_loader.js');
const manifest=read('asset_manifest.php');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');
const lazy=[
  'js/next/shop/shop_api.js','js/next/shop/shop_state.js','js/next/pages/parts.js',
  'js/next/pages/masters.js','js/next/pages/details.js',
  'js/next/work_orders/sto_workplace_api.js','js/next/pages/sto_workplace.js',
  'js/next/seller/seller_api.js','js/next/seller/seller_state.js','js/next/pages/seller.js',
  'js/next/community/community_state.js','js/next/community/community_api.js','js/next/pages/community.js',
  'js/next/pages/identity_migration.js','js/next/pages/admin_workspaces.js'
];

expect(registry.includes("'js/next/route_asset_loader.js'"),'route asset loader not registered');
const sourceOrder=(registry.match(/'scriptSources'\s*=>\s*\[([\s\S]*?)\]\s*,\s*\]\s*;/)||[])[1]||registry;
expect(sourceOrder.indexOf("'js/next/route_asset_loader.js'")<sourceOrder.indexOf("'js/next/app_next.js'"),'route loader must load before app_next');
expect(/'mode' => 'route-lazy-v[1-5]'/.test(registry)&&registry.includes("'lazy' => true"),'route lazy plan missing');
for(const name of ['community','parts','masters','details','sto','seller','admin'])expect(registry.includes(`'${name}' => [`),`lazy bundle missing: ${name}`);
for(const file of lazy)expect(registry.includes(`'${file}'`),`lazy asset missing from route plan: ${file}`);

const appDeps=(app.match(/const APP_DEPENDENCIES=\[([\s\S]*?)\];/)||[])[1]||'';
for(const global of ['KaretaCommunityPages','KaretaPartsPages','KaretaMastersPages','KaretaStoWorkplacePages','KaretaSellerPages','KaretaAdminWorkspacePages','KaretaDetailPages'])expect(!appDeps.includes(global),`${global} remained an eager app dependency`);
expect(appDeps.includes('KaretaRouteAssetLoader'),'app_next must depend on route loader');
expect(app.includes('routeAssetLoader.ensureRoute(key')&&app.includes("data-route-assets-loading"),'app_next lazy render gate missing');
expect(app.includes("community:{global:'KaretaCommunityPages'")&&app.includes("parts:{global:'KaretaPartsPages'")&&app.includes("stoDashboard:{global:'KaretaStoWorkplacePages'"),'late page bindings missing');
expect(app.includes("routeRuntime.onAction('service-booking'")&&!app.includes('servicesPages.registerActions'),'service booking action must stay in core without Services capture');

expect(loader.includes('KNOWN_LAZY_ROUTE_KEYS')&&loader.includes('route_bundle_globals_missing')&&loader.includes('route_script_execution_failed'),'loader integrity guards missing');
expect(loader.includes("if(!isKnownLazy(key))return {ok:true,lazy:false,bundles:[]}"),'non-lazy route must not fetch manifest');
expect(loader.includes("for(const script of Array.isArray(bundle.scripts)?bundle.scripts:[])")&&loader.includes('await loadScript(payload,script,bundleName)'),'bundle scripts must load sequentially');
expect(loader.includes('route_manifest_release_mismatch')&&loader.includes("url.searchParams.set('route_loader','1')"),'route manifest release guard missing');
expect(loader.includes("!Array.isArray(payload.assets)||!payload.routeBundles")&&!loader.includes("!response.ok||!payload?.ok"),'lazy loader must tolerate unrelated degraded-manifest assets');
expect(loader.includes("karetaRouteState='failed'")&&loader.includes("karetaRouteState='loaded'"),'failed lazy nodes must be removable/retryable');
expect(manifest.includes("'lazy' => $lazy")&&manifest.includes("'lazyScriptCount'")&&manifest.includes("'totalScriptCount'")&&manifest.includes("'route-loader'"),'manifest lazy asset metadata missing');

try{
  const probe=cp.execFileSync('php',['-r',`require ${JSON.stringify(path.join(root,'inc/asset_registry.php'))}; $r=kareta_asset_registry(); $p=kareta_route_asset_plan(); echo json_encode(['global'=>count($r['scripts']),'lazy'=>count(kareta_route_asset_paths('scripts')),'community'=>$p['community']['routeKeys'],'product'=>$p['parts']['routeKeys'],'details'=>$p['details']['routeKeys']]);`],{encoding:'utf8'}).trim();
  const data=JSON.parse(probe);
  expect(data.global<=116,`expected eager scripts <=116, got ${data.global}`);
  expect(data.lazy>=15,`expected lazy scripts >=15, got ${data.lazy}`);
  expect(data.community.includes('community'),'community route key missing');
  expect(data.product.includes('productDetail')&&data.details.includes('productDetail'),'product detail must load shop + details bundles');
}catch(e){fail.push(`registry probe failed: ${e.message}`)}

const eagerBlock=(registry.match(/'scripts'\s*=>\s*\[([\s\S]*?)\],\s*'images'/)||[])[1]||'';
for(const file of lazy)expect(!eagerBlock.includes(`'${file}'`),`lazy script still eager: ${file}`);

const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1];
const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
const rev=Number(String(va||'').split('.').pop()||0);
expect(rev>=66&&vs===va,'84.66+ version mismatch');

if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84.66 route lazy loader: OK');
