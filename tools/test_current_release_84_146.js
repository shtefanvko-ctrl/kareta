'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};

const version=read('inc/asset_version.php');
const sw=read('sw.js');
const registry=read('inc/asset_registry.php');
const routes=read('js/next/route_registry.js');
const app=read('js/next/app_next.js');
const nav=read('js/next/shell_nav.js');
const identityBundle=read('js/boot/runtime_identity_bundle.js');
const shellBundle=read('js/boot/runtime_shell_bundle.js');
const geometry=read('css/next/page_geometry_canonical_84_146.css');
const notFoundCss=read('css/next/not_found_84_146.css');
const notFoundJs=read('js/next/pages/not_found.js');
const current=JSON.parse(read('docs/release/current.json'));

const va=(version.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1]||'';
const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1]||'';
expect(va==='188.5.5.6.84.146','asset release is not 84.146');
expect(vs===va,'service worker / asset release mismatch');
expect(current.release===va,'docs/release/current.json release mismatch');
expect(Number(current.database?.canonicalVersion)===129,'current release DB boundary must stay 129');

expect(routes.includes("notFound:Object.freeze({ path:'#/404'"),'notFound route missing');
expect(routes.includes("return found ? found[0] : 'notFound';"),'unknown hashes do not resolve to notFound');
expect(app.includes("notFound:{global:'KaretaNotFoundPages'"),'404 page binding missing');
expect(app.includes("if(routeKey==='notFound') return 'notFound';"),'404 is still role-redirected');
expect(nav.includes("if(routeKey==='notFound')"),'404 active-nav reset missing');
expect(identityBundle.includes("notFound:Object.freeze({ path:'#/404'"),'identity bundle is stale for 404');
expect(shellBundle.includes("if(routeKey==='notFound')"),'shell bundle is stale for 404');

expect(registry.includes("'css/next/page_geometry_canonical_84_146.css'"),'canonical page geometry not eager');
expect(registry.includes("'routeKeys' => ['notFound']"),'404 lazy asset bundle missing');
expect(registry.includes("'css/next/not_found_84_146.css'"),'404 CSS not registered');
expect(registry.includes("'js/next/pages/not_found.js'"),'404 JS not registered');

expect(geometry.includes('--k-route-frame-max:1280px'),'desktop content-frame token missing');
expect(geometry.includes('#k-page-outlet.k-page-outlet > :where(section,main,article,div)[class]'),'direct route-root geometry missing');
expect(geometry.includes('padding-left:0!important')&&geometry.includes('padding-right:0!important'),'route roots still own outer desktop gutters');
expect(notFoundCss.includes('.k-not-found-page'),'404 design CSS missing');
expect(notFoundJs.includes('Страница не найдена'),'404 renderer missing');

console.log('CURRENT_RELEASE_84_146: PASS release='+va);
