'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[]; const expect=(v,m)=>{if(!v)fail.push(m)};
const registry=read('inc/asset_registry.php');
const boot=read('css/runtime_boot_bundle.css');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');
const routeDir=path.join(root,'css/routes');
const bundleFiles=[
  'community_runtime.css','social_windows_runtime.css','providers_runtime.css','details_runtime.css',
  'work_order_runtime.css','sto_runtime.css','profile_runtime.css','workflow_runtime.css',
  'services_runtime.css','master_runtime.css','parts_runtime.css','seller_runtime.css',
  'cabinet_runtime.css','finance_runtime.css','client_guard_postlude.css'
];
for(const f of bundleFiles){
  const p=path.join(routeDir,f); expect(fs.existsSync(p),`missing route CSS bundle ${f}`); if(fs.existsSync(p))expect(fs.statSync(p).size>200,`route CSS bundle empty ${f}`);
  expect(registry.includes(`'css/routes/${f}'`),`route CSS bundle not registered ${f}`);
}
expect(registry.includes("'cssMode' => 'critical-boot-route-css-v2'"),'critical CSS mode metadata missing');
expect(fs.statSync(path.join(root,'css/runtime_boot_bundle.css')).size<=850000,`critical boot CSS too large: ${fs.statSync(path.join(root,'css/runtime_boot_bundle.css')).size}`);
expect(boot.includes('SOURCE: css/next/app_preloader.css'),'preloader CSS left critical bundle');
expect(boot.includes('SOURCE: css/next/app_next.css'),'app shell CSS left critical bundle');
expect(boot.includes('SOURCE: css/next/home_simple.css'),'home CSS left critical bundle');
expect(boot.includes('SOURCE: css/onboarding_bundle.css'),'onboarding CSS left critical bundle');
expect(boot.includes('SOURCE: css/next/kflow_windows.css'),'K-Flow core CSS left critical bundle');
// Request base is deliberately retained because it has many exact-selector overrides in kflow_windows.
expect(boot.includes('SOURCE: css/next/request.css')&&boot.includes('SOURCE: css/next/client_request_garage.css'),'request base was unsafely extracted from K-Flow cascade');
const extracted=[
 'css/next/community.css','css/next/social_fullscreen_pages.css','css/next/community_group_slide_width.css','css/next/community_feed_desktop_grid.css','css/next/social_windows.css',
 'css/next/masters.css','css/next/details.css','css/next/parts_windows_product_detail.css','css/next/work_order.css','css/next/work_order_windows.css',
 'css/next/sto_workplace.css','css/next/sto_recovery_native_operations.css','css/next/sto_schedule_capacity_command_center.css','css/next/sto_native_surface_audit.css','css/next/sto_workspace_windows.css',
 'css/next/profile_relations.css','css/next/workflow.css','css/next/mobile_services_context_grid.css','css/next/master_surfaces.css','css/next/master_business_runtime.css','css/next/master_order_lifecycle.css','css/next/master_aftercare.css','css/next/master_service_pricing_native.css','css/next/master_exchange_acceptance_flow.css','css/next/master_ui_exchange_schedule_flattening.css','css/next/parts_native_marketplace.css','css/next/used_market_listing_wizard.css','css/next/used_market_owner_management.css','css/next/seller_native_workplace.css','css/next/seller_profile_storefront_native.css','css/next/seller_workspace_windows.css','css/next/client_account_native.css','css/next/operational_finance.css'
];
const routeText=bundleFiles.map(f=>read(`css/routes/${f}`)).join('\n');
for(const src of extracted){
  expect(!boot.includes(`SOURCE: ${src}`),`route-only layer remains eager: ${src}`);
  expect(routeText.includes(`SOURCE: ${src}`),`extracted layer missing from route bundles: ${src}`);
}
const postlude=read('css/routes/client_guard_postlude.css');
const guards=['css/next/narrow_mobile.css','css/next/desktop_full_width.css','css/next/kflow_primary_pages.css','css/next/client_surface_layout.css','css/next/reference_client_pages.css','css/next/client_width_guard.css','css/next/client_mobile_geometry.css','css/next/client_viewport_layers.css','css/next/client_surface_modernization_phase3.css'];
let last=-1; for(const g of guards){const i=postlude.indexOf(`SOURCE: ${g}`);expect(i>last,`postlude guard order broken at ${g}`);last=i;}
expect(registry.indexOf("'cssDetailsBase' => [")<registry.indexOf("'cssPartsBase' => ["),'detail CSS must precede parts CSS as in historical cascade');
expect(registry.indexOf("'cssSocialWindowsBase' => [")<registry.indexOf("'cssClientGuardPostlude' => ["),'social windows must precede client guard postlude');
expect(registry.indexOf("'cssClientGuardPostlude' => [")<registry.indexOf("'community' => ["),'client guard postlude must load before pre-existing route-lazy overrides');
for(const css of [boot,...bundleFiles.map(f=>read(`css/routes/${f}`))])expect(!/url\(\s*["']?\.\.?\//.test(css),'critical/route CSS contains unresolved relative url()');
try{
 const out=cp.execFileSync('php',['-r',`require ${JSON.stringify(path.join(root,'inc/asset_version.php'))}; require ${JSON.stringify(path.join(root,'inc/asset_registry.php'))}; $r=kareta_asset_registry(); $p=kareta_route_asset_plan(); echo json_encode(['eagerCss'=>count($r['styles']),'lazyCss'=>count(kareta_route_asset_paths('styles')),'plan'=>$p], JSON_UNESCAPED_SLASHES);`],{encoding:'utf8'}).trim();
 const d=JSON.parse(out); expect(d.eagerCss===2,`expected boot CSS + role-scoped Master shell CSS, got ${d.eagerCss}`); expect(registry.includes("'css/next/master_shell_canonical_84_143.css'"),'canonical Master shell must be eager for direct deep-links'); expect(d.lazyCss>=46,`expected route CSS extraction, got ${d.lazyCss} lazy styles`);
 const stylesFor=key=>Object.values(d.plan).filter(v=>v&&v.lazy===true&&Array.isArray(v.routeKeys)&&v.routeKeys.includes(key)).flatMap(v=>Array.isArray(v.styles)?v.styles:[]);
 const exactOrder=(key,wanted)=>{const got=stylesFor(key);let last=-1;for(const item of wanted){const i=got.indexOf(item);expect(i>=0,`${key} missing style ${item}`);expect(i>last,`${key} CSS order broken at ${item}: ${got.join(' -> ')}`);last=i;}};
 exactOrder('community',['css/routes/community_runtime.css','css/routes/social_windows_runtime.css','css/routes/client_guard_postlude.css']);
 exactOrder('productDetail',['css/routes/details_runtime.css','css/routes/parts_runtime.css','css/routes/client_guard_postlude.css']);
 exactOrder('workOrder',['css/routes/work_order_runtime.css','css/routes/client_guard_postlude.css','css/next/client_work_order_v2.css']);
 exactOrder('cabinet',['css/routes/cabinet_runtime.css','css/routes/client_guard_postlude.css','css/next/client_cabinet.css']);
 exactOrder('finance',['css/routes/finance_runtime.css','css/next/finance.css']);
 exactOrder('masterDashboard',['css/routes/master_runtime.css','css/next/master_requests_workplace_services.css','css/next/master_schedule.css','css/next/master_workplace_native.css']);
}catch(e){fail.push(`registry probe failed: ${e.message}`)}
const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1];const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
const rev=Number(String(va||'').split('.').pop()||0); expect(rev>=81&&vs===va,'84.81+ release parity mismatch');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log(`R188.5.5.6.84.81 critical CSS split OK: eager=${fs.statSync(path.join(root,'css/runtime_boot_bundle.css')).size} bytes; route bundles=${bundleFiles.length}`);
