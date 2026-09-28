'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message);};

const index=read('index.php');
const css=read('css/next/shell_header_restoration.css');
const homeCss=read('css/next/home_responsive.css');
const home=read('js/next/pages/core.js');
const shell=read('js/next/shell_header.js');
const app=read('js/next/app_next.js');
const registry=read('inc/asset_registry.php');
const version=read('inc/asset_version.php');
const sw=read('sw.js');

assert(version.includes("'188.5.5.6.84.14'"),'Asset version mismatch');
assert(sw.includes("const RELEASE = '188.5.5.6.84.14';"),'Service Worker version mismatch');
for(const marker of ['id="k-shell-header"','id="k-desktop-nav"','id="k-shell-location"','id="k-shell-notifications"','id="k-menu-toggle"'])assert(index.includes(marker),`Shell DOM missing ${marker}`);
assert(index.indexOf('id="k-shell-location"')<index.indexOf('id="k-shell-notifications"'),'Location must be next to and before notification bell');
assert(index.indexOf('id="k-shell-notifications"')<index.indexOf('id="k-menu-toggle"'),'Burger must remain after utility controls');
assert(!home.includes('class="k-home-header"'),'Home still renders duplicate header');
assert(homeCss.includes('body.k-home-route-active #k-shell-header{display:grid}'),'Home still hides global Shell');
assert(homeCss.includes('body.k-home-route-active .k-app-shell{padding-top:var(--k-shell-h)}'),'Home does not reserve fixed header height');
assert(css.includes('#k-shell-header.k-shell-header.is-scroll-hidden')&&css.includes('transform:translate3d(0,0,0)!important'),'CSS scroll-hide override missing');
assert(css.includes('@media (min-width:861px)')&&css.includes('#k-desktop-nav.k-desktop-nav')&&css.includes('display:flex!important'),'Desktop nav is not restored');
assert(css.includes('#k-menu-toggle.k-menu-toggle')&&css.includes('display:inline-flex!important'),'Burger is not permanently restored');
assert(shell.includes('data-scroll-state')&&shell.includes("'fixed'")&&!shell.includes("window.addEventListener('scroll'"),'Persistent Shell runtime must not perform per-scroll work');
assert(shell.includes("window.addEventListener('kareta:notification-unread'")&&shell.includes('resolveCity'),'Geo/bell runtime missing');
assert(app.includes('Never auto-hide it on scroll')&&!app.includes('const hide = () =>'),'Legacy auto-hide runtime is still active');
assert(registry.indexOf('shell_header_restoration.css')>registry.indexOf('home_responsive.css'),'Shell restoration CSS must load after Home overrides');
assert(registry.indexOf('shell_header.js')>registry.indexOf('api_client.js'),'Shell header runtime must load after API client');

console.log('R188.5.5.6.84.14 persistent Shell header restoration: OK');
