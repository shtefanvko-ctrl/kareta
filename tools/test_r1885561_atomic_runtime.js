'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

function releaseContract(){
  const release='20260806-r188555-runtime-dependency-bootstrap-r188556-security-hardening-r1885561-atomic-runtime-bootstrap';
  for(const file of ['inc/asset_version.php','sw.js','js/next/core/realtime_client.js']){
    assert(read(file).includes(release),`release mismatch: ${file}`);
  }
}

function atomicBootstrapSyntaxAndContract(){
  const index=read('index.php');
  const match=index.match(/<script id="k-atomic-runtime-bootstrap">([\s\S]*?)<\/script>/);
  assert(match,'atomic runtime bootstrap is missing');
  let replacement=0;
  const runnable=match[1].replace(/<\?=[\s\S]*?\?>/g,()=>replacement++===0?JSON.stringify('test-release'):JSON.stringify([]));
  new vm.Script(runnable,{filename:'k-atomic-runtime-bootstrap.js'});
  for(const marker of [
    'manifestPreflight','hasStaleWorker','stale_service_worker_controller',
    'purgeLegacyRuntime','script.async=false','script.dataset.karetaScriptOrder',
    "localStorage.setItem(releaseKey,release)","kareta.atomic.recovery:${release}",
  ])assert(index.includes(marker),`atomic bootstrap marker missing: ${marker}`);
  assert(!index.includes('<?= kareta_render_scripts() ?>'),'runtime still uses non-atomic direct script tags');
  assert(index.includes('Clear-Site-Data: "cache"'),'one-time browser cache epoch is missing');
  assert(index.includes("CDN-Cache-Control: no-store"),'index can be cached by a surrogate');
}

function dependencyOrder(){
  const registry=read('inc/asset_registry.php');
  const chain=[
    'js/next/runtime_dependencies.js','js/next/route_registry.js','js/next/dynamic_navigation.js',
    'js/next/role_access.js','js/next/context_manager.js','js/next/navigation_core.js',
    'js/next/shell_nav.js','js/next/shell_menu.js','js/next/route_runtime.js','js/next/route_asset_loader.js','js/next/app_next.js',
  ];
  let previous=-1;
  for(const file of chain){const position=registry.indexOf(`'${file}'`);assert(position>previous,`invalid runtime order near ${file}`);previous=position;}
  const shellNav=read('js/next/shell_nav.js');
  const shellMenu=read('js/next/shell_menu.js');
  assert(shellNav.includes("deferScript('shell_nav'")&&!shellNav.includes('Dynamic navigation stack is required before shell_nav.js'),'shell_nav still crashes on a missing dependency');
  assert(shellMenu.includes("deferScript('shell_menu'")&&!shellMenu.includes('Dynamic navigation is required before shell_menu.js'),'shell_menu still crashes on a missing dependency');
  const app=read('js/next/app_next.js');
  assert(app.indexOf("deferScript('app_next'")<app.indexOf('const PAGE_RENDERERS'),'app_next builds renderer references before dependency validation');
}

function cachePolicy(){
  const htaccess=read('.htaccess');
  const manifest=read('asset_manifest.php');
  for(const marker of ['CDN-Cache-Control "no-store"','Surrogate-Control "no-store"'])assert(htaccess.includes(marker),`.htaccess misses ${marker}`);
  for(const marker of ["CDN-Cache-Control: no-store","Surrogate-Control: no-store"])assert(manifest.includes(marker),`manifest misses ${marker}`);
}

releaseContract();
atomicBootstrapSyntaxAndContract();
dependencyOrder();
cachePolicy();
console.log('R188.5.5.6.1 atomic runtime bootstrap tests OK');
