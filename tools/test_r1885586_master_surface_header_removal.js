'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const must=(ok,msg)=>{if(!ok)throw new Error(msg);};

const r84=read('inc/asset_version.php').includes('r1885644-global-ux-cleanup-legacy-removal');
const runtime=fs.existsSync(path.join(root,'js/next/master_surface_runtime.js'))?read('js/next/master_surface_runtime.js'):'';
const css=read('css/next/master_surfaces.css');
const version=read('inc/asset_version.php');
const sw=read('sw.js');

must(!runtime.includes('k-master-surface-header'),'runtime still creates master surface header');
must(!runtime.includes('data-master-surface-header'),'runtime still depends on master surface header');
must(!css.includes('.k-master-surface-header'),'obsolete master surface header CSS remains');
if(r84){must(!runtime,'R84 must remove the remaining legacy master surface injector');}else{must(runtime.includes('addOrdersSummary(page)'),'orders summary was removed with header');must(runtime.includes('addRouteNote(page,routeKey)'),'route notes were removed with header');must(runtime.includes("':scope > .k-page-hero, :scope > .k-master-shift-hero, :scope > .k-staff-cabinet-head, :scope > .k-client-subhead'"),'route note fallback anchor missing');}
must(version.includes('r1885586-master-surface-header-removal'),'asset version missing');
must(sw.includes('r1885586-master-surface-header-removal'),'service worker version missing');
console.log('OK R188.5.5.6.26 master surface header removal');
