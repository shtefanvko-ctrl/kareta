'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};

const version=read('inc/asset_version.php');
const sw=read('sw.js');
const current=JSON.parse(read('docs/release/current.json'));
const config=read('config.php');
const phpManifest=read('api/migration_manifest.php');
const jsonManifest=JSON.parse(read('api/migration_manifest.json'));
const registry=read('inc/asset_registry.php');
const routes=read('js/next/route_registry.js');
const app=read('js/next/app_next.js');
const nav=read('js/next/shell_nav.js');
const identityBundle=read('js/boot/runtime_identity_bundle.js');
const shellBundle=read('js/boot/runtime_shell_bundle.js');
const geometry=read('css/next/page_geometry_canonical_84_146.css');
const notFoundCss=read('css/next/not_found_84_146.css');
const notFoundJs=read('js/next/pages/not_found.js');
const htaccess=read('.htaccess');
const indexPhp=read('index.php');
const catalogState=read('js/next/catalog/catalog_state.js');
const masters=read('js/next/pages/masters.js');
const communityState=read('js/next/community/community_state.js');
const community=read('js/next/pages/community.js');
const domainApi=read('api/domain.php');
const ordersApi=read('js/next/orders/orders_api.js');
const serverPackage=read('tools/build_server_package.py');
const onboardingBundle=read('js/boot/runtime_onboarding_bundle.js');

const assetRelease=(version.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1]||'';
const swRelease=(sw.match(/const RELEASE = '([^']+)'/)||[])[1]||'';
const configDb=Number((config.match(/define\('KARETA_DB_VERSION',\s*(\d+)\)/)||[])[1]||0);
const phpDb=Number((phpManifest.match(/'version'\s*=>\s*(\d+)/)||[])[1]||0);
const jsonDb=Number(jsonManifest.targetDbVersion||0);

expect(/^188\.5\.5\.6\.84\.\d+$/.test(assetRelease),'invalid public runtime release token');
expect(swRelease===assetRelease,'service worker / asset release mismatch');
expect(current.release===assetRelease,'docs/release/current.json release mismatch');
expect(configDb>0&&phpDb===configDb&&jsonDb===configDb,
  'DB version mismatch config='+configDb+' phpManifest='+phpDb+' jsonManifest='+jsonDb);
expect(Number(current.database?.canonicalVersion)===configDb,'current release canonical DB mismatch');
expect(Number(current.database?.manifestVersion)===configDb,'current release manifest DB mismatch');

const obdPath=String(current.database?.obdSchemaMigration||'');
if(Number(current.androidNative?.apiVersion||0)>=6){
  expect(obdPath&&fs.existsSync(path.join(root,obdPath)),'Native API 6 OBD schema migration missing');
  const obd=read(obdPath);
  const obdVersion=Number((obd.match(/'version'\s*=>\s*(\d+)/)||[])[1]||0);
  expect(obdVersion>0&&obdVersion<=configDb,'OBD schema migration is outside canonical DB boundary');
  expect(obd.includes('CREATE TABLE IF NOT EXISTS obd_diagnostic_sessions'),'OBD schema ownership missing');
}

expect(routes.includes("notFound:Object.freeze({ path:'#/404'"),'notFound route missing');
expect(routes.includes("return found ? found[0] : 'notFound';"),'unknown hashes do not resolve to notFound');
expect(app.includes("notFound:{global:'KaretaNotFoundPages'"),'404 page binding missing');
expect(app.includes("if(routeKey==='notFound') return 'notFound';"),'404 is role-redirected');
expect(nav.includes("if(routeKey==='notFound')"),'404 active-nav reset missing');
expect(identityBundle.includes("notFound:Object.freeze({ path:'#/404'"),'identity bundle is stale for 404');
expect(shellBundle.includes("if(routeKey==='notFound')"),'shell bundle is stale for 404');

expect(registry.includes("'css/next/page_geometry_canonical_84_146.css'"),'canonical page geometry not eager');
expect(registry.includes("'routeKeys' => ['notFound']"),'404 lazy asset bundle missing');
expect(geometry.includes('--k-route-frame-max:1280px'),'desktop content-frame token missing');
expect(notFoundCss.includes('.k-not-found-page')&&notFoundJs.includes('Страница не найдена'),'production 404 surface missing');
expect(htaccess.includes('index.php?kareta_route_fallback=1')&&indexPhp.includes('http_response_code(404);'),
  'clean URL HTTP 404 contract missing');

expect(sw.includes('async function cacheFirstReleaseStatic(request)'),'release static cache-first strategy missing');
expect(sw.includes('const cached = await cache.match(canonical);'),'static cache is not checked before network');
expect(htaccess.includes('RewriteRule ^ - [R=404,L]'),'missing static files can still fall through to SPA HTML');
expect(catalogState.includes('kareta.catalog.snapshot:'),'services release-scoped cache missing');
expect(masters.includes('kareta.masters.snapshot:'),'masters release-scoped cache missing');
expect(communityState.includes('fetchedAt:0'),'community freshness timestamp missing');
expect(community.includes("changed?'loaded':'revalidated'"),'community unchanged-content repaint guard missing');

expect(!domainApi.includes("'notifications.manageOwn'"),'notifications still require unavailable manageOwn capability');
expect((domainApi.match(/'notifications\.read'/g)||[]).length>=3,'notifications read capability contract missing');
expect(ordersApi.includes('dbSafeReplay:true'),'orders.getAll is not protected by the DB safe-replay gate');
expect(ordersApi.includes("clientExchange.dashboard")&&ordersApi.includes("{...options,dbSafeReplay:true}"),'client exchange read burst is not serialized');
expect(ordersApi.includes("clientSchedule.reschedule.list")&&ordersApi.includes("clientSchedule.arrival.list"),'client schedule read actions missing');
expect(serverPackage.includes('if workflow_run_id and not re.fullmatch(r"[0-9]{1,32}", workflow_run_id):'),'local provenance workflowRunId normalization missing');
expect(indexPhp.includes("assets/logo/main/kareta_logo_full.png"),'index uses non-canonical full logo path');
expect(onboardingBundle.includes('assets/logo/main/kareta_logo_full.png'),'onboarding bundle uses non-canonical full logo path');

console.log('CURRENT_RELEASE: PASS release='+assetRelease+' db='+configDb);
