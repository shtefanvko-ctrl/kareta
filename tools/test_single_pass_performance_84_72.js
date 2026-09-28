'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[]; const expect=(v,m)=>{if(!v)fail.push(m)};
const registry=read('inc/asset_registry.php');
const index=read('index.php');
const app=read('js/next/app_next.js');
const preloader=read('js/next/app_preloader.js');
const loader=read('js/next/route_asset_loader.js');
const role=read('js/next/onboarding/pages/role_page.js');
const onboarding=read('js/next/onboarding/onboarding_app.js');
const config=read('config.php');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');
const bundlePath=path.join(root,'css/runtime_boot_bundle.css');
const bundle=fs.readFileSync(bundlePath,'utf8');

expect(registry.includes("'css/runtime_boot_bundle.css'"),'single eager CSS bundle is not registered');
expect(registry.includes("'mode' => 'route-lazy-v5'")&&(registry.includes("'cssMode' => 'boot-css-bundle-v1'")||registry.includes("'cssMode' => 'critical-boot-route-css-v2'")),'84.72 asset metadata missing');
expect(bundle.includes('SOURCE: css/next/app_preloader.css')&&bundle.includes('SOURCE: css/next/app_next.css'),'boot CSS source ordering markers missing');
expect(bundle.includes('R188.5.5.6.84.72 ROUTE LOAD SKELETON'),'route skeleton CSS missing');
expect(!/url\(\s*["']?\.\.?\//.test(bundle),'boot CSS bundle contains unresolved relative url()');
expect(index.includes('function warmRuntimeWindow(start=0,count=6)'),'bounded runtime preload window missing');
expect(!index.includes('function warmRuntimeFetches'),'old all-script preload burst remains');
expect(index.includes('KaretaAppPreloader?.atomicProgress?.(state.loaded,state.total,item.path)'),'atomic loader does not advance visible progress');
expect(index.includes("console.info('[KARETA][boot.release]'"),'deploy/version boot marker missing');
expect(preloader.includes('function atomicProgress(loaded,total,path=')&&preloader.includes('const mapped=4+Math.round((completed/remaining)*34)'),'preloader does not map atomic progress');
expect(!app.includes("preloader?.show?.({ progress:6"),'app boot still restarts preloader at 6%');
const routeReadyAwait=app.includes('await ensureInitialRouteReady(targetRoute)')?'await ensureInitialRouteReady(targetRoute)':'await routeAssetLoader.ensureRoute(targetRoute)';
expect(app.includes(routeReadyAwait)&&app.indexOf(routeReadyAwait)<app.indexOf("routeRuntime.transition(targetRoute, { source:'boot' })"),'initial lazy deep-link is rendered before bundle readiness');
if(routeReadyAwait.includes('ensureInitialRouteReady'))expect(app.includes('async function ensureInitialRouteReady(routeKey)')&&app.includes('routeAssetLoader.ensureRoute(key)'),'route warmup helper does not fail closed to route readiness');
expect(app.includes("for(const key of ['parts','masters','community'])"),'primary client routes are not prefetched after boot');
expect(loader.includes('function isRouteReady(routeKey)')&&loader.includes('function prefetchRoute(routeKey,options={})'),'route readiness/prefetch API missing');
expect(app.includes('k-route-skeleton')&&!app.includes('<p>Подготавливаем раздел…</p>'),'visible route preparation placeholder remains');
expect(!role.includes("loader?.show?.({ progress:18")&&!role.includes("loader?.complete?.('Добро пожаловать!')"),'existing-account OTP restarts global preloader');
expect(!onboarding.includes("loader?.show?.({ progress:14")&&!onboarding.includes("loader?.complete?.('Добро пожаловать!')"),'profile finalize restarts global preloader');
expect(config.includes("$kareta_otp_test_code = '0000'")&&config.includes("$kareta_account_type_approval_mode = 'admin_review'"),'temporary OTP/admin review contract regressed');
try{
 const probe=cp.execFileSync('php',['-r',`require ${JSON.stringify(path.join(root,'inc/asset_registry.php'))}; $r=kareta_asset_registry(); echo json_encode(['css'=>count($r['styles']),'bootJs'=>count($r['scripts']),'sourceJs'=>count($r['scriptSources']??$r['scripts']),'lazyJs'=>count(kareta_route_asset_paths('scripts')),'lazyCss'=>count(kareta_route_asset_paths('styles'))]);`],{encoding:'utf8'}).trim();
 const d=JSON.parse(probe); expect(d.css===1,`expected one eager CSS request, got ${d.css}`);expect(d.sourceJs===72,`unexpected eager source JS count ${d.sourceJs}`);expect(d.bootJs>=1&&d.bootJs<=72,`unexpected boot JS request count ${d.bootJs}`);expect(d.lazyJs===59||d.lazyJs===60,`unexpected lazy JS count ${d.lazyJs}`);expect(d.lazyCss>=31,`unexpected lazy CSS count ${d.lazyCss}`);
}catch(e){fail.push(`registry probe failed: ${e.message}`)}
const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1]; const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
expect(vs===va&&/^188\.5\.5\.6\.84\.(?:7[2-9]|[89]\d|\d{3,})$/.test(va),'84.72+ version mismatch');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84.72 single-pass performance + parts readiness: OK');
