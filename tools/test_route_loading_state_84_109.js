'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const fail=[];const expect=(value,message)=>{if(!value)fail.push(message);};

const app=read('js/next/app_next.js');
const loader=read('js/next/route_asset_loader.js');
const css=read('css/next/app_next.css');
const registry=read('inc/asset_registry.php');
const shellBundle=read('js/boot/runtime_shell_bundle.js');
const bootCss=read('css/runtime_boot_bundle.css');

expect(app.includes('function routeLoadingHtml(route)'),'route loading renderer missing');
expect(app.includes('data-route-loading-progress'),'route progress element missing');
expect(app.includes('role="progressbar"'),'route progress ARIA contract missing');
expect(app.includes('function updateRouteLoadingProgress'),'route progress updater missing');
expect(app.includes("data-route-assets-loading')!=='1'"),'stale route progress guard missing');
expect(app.includes("data-route-token')!==String(routeToken)"),'route token guard missing');
expect(app.includes('onProgress:detail=>updateRouteLoadingProgress'),'route loader progress is not connected to outlet');
expect(app.includes("phase:'start',percent:4"),'initial visible loading state missing');

for(const event of ["emitRouteLoad('start'","emitRouteLoad('end'","emitRouteLoad(aborted?'cancel':'error'"]){
  expect(loader.includes(event),'route lifecycle event missing: '+event);
}
expect(loader.includes('function reportRouteProgress'),'central route progress reporter missing');
expect(loader.includes("typeof options?.onProgress==='function'"),'loader callback contract missing');
expect(loader.includes('onAssetLoaded?.({bundle:bundleName,type:'),'per-asset progress hook missing');
expect(loader.includes("phase:'assets'")&&loader.includes("phase:'manifest'")&&loader.includes("phase:'ready'"),
  'route progress phases incomplete');
expect(loader.includes('loaded:completed,total'),'route progress counters missing');

expect(css.includes('Stage 18')&&css.includes('unified lazy-route loading state'),'system route loading CSS marker missing');
expect(css.includes('.k-route-loading{')&&css.includes('min-height:clamp('),'white-screen prevention min-height missing');
expect(css.includes('.k-route-loading__progress')&&css.includes('--k-route-progress'),'route progress CSS missing');
expect(css.includes('.k-route-skeleton__grid')&&css.includes('@keyframes kRouteSkeleton'),'route skeleton CSS missing');
expect(css.includes('@media(prefers-reduced-motion:reduce)'),'reduced-motion loading fallback missing');

expect(registry.includes("'css/runtime_boot_bundle.css'"),'critical boot CSS bundle is not eager');
expect(registry.includes("'css/next/app_next.css'"),'app_next CSS source layer missing from registry');
expect(bootCss.includes('SOURCE: css/next/app_next.css'),'app_next CSS missing from eager boot bundle');
expect(bootCss.includes('.k-route-loading__progress')&&bootCss.includes('kRouteSkeleton'),'route loading CSS not synchronized into eager boot bundle');
expect(!/k-route-loading[^\n]*display\s*:\s*none/.test(css),'route loading surface hidden by CSS');
expect(shellBundle.includes('function reportRouteProgress'),'runtime shell bundle stale: progress reporter absent');
expect(shellBundle.includes('kareta:route-load-'+'$'+'{type}'),'runtime shell bundle stale: route load events absent');

try{
  const result=cp.spawnSync(process.execPath,['tools/build_boot_js_bundles.js','--check'],{cwd:root,encoding:'utf8'});
  expect(result.status===0,'boot JS bundles are stale: '+String(result.stderr||result.stdout||'').trim());
}catch(error){fail.push('bundle freshness check failed: '+error.message);}

if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('ROUTE_LOADING_STATE_84_109: PASS systemSkeleton=1 progress=1 slowNetworkBlank=0');
