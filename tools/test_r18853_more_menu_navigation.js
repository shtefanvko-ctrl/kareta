'use strict';
const fs=require('fs');const vm=require('vm');const path=require('path');const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
global.window={};global.location={hash:'#/home'};
vm.runInThisContext(read('js/next/ui_icons.js'),{filename:'ui_icons.js'});
vm.runInThisContext(read('js/next/route_registry.js'),{filename:'route_registry.js'});

const hub=read('js/next/smart_action_hub.js');
const actionIcons=[...hub.matchAll(/\{key:'[^']+',label:'[^']+',icon:'([^']+)'/g)].map(match=>match[1]);
assert(actionIcons.length>=40,'smart action catalog is unexpectedly incomplete');
const missingIcons=[...new Set(actionIcons)].filter(icon=>!window.KaretaUIIcons.has(icon));
assert(missingIcons.length===0,'smart action SVG missing: '+missingIcons.join(','));
assert(hub.includes('anonymous:Object.freeze')&&hub.includes('organization:Object.freeze'),'More hub does not cover every navigation context');
assert((hub.match(/key:'cabinetSettings'/g)||[]).length>=7,'Settings is missing from an authenticated More context');
assert(!hub.includes('KaretaShellMenu?.open?.()'),'More hub still falls back to the burger drawer');
assert(hub.includes('KaretaShellMenu?.close?.()'),'More hub does not prevent drawer overlap');
assert(hub.includes('state.lastFocus?.focus?.({preventScroll:true})'),'More hub focus restoration is missing');
assert(hub.includes("MORE_WINDOW_CONTRACT='KARETA_MORE_WINDOW_V1_2'")&&hub.includes("layout:'honeycomb'"),'fixed More V1.2 contract is missing');

const nav=read('js/next/shell_nav.js');
assert(nav.includes("addEventListener('click',()=>window.KaretaSmartActionHub?.toggle?.())"),'More button is not directly bound to its own hub');
assert(!nav.includes('else window.KaretaShellMenu'),'More button is still coupled to the burger drawer');
assert(nav.includes('aria-controls="k-smart-action-hub"')&&nav.includes('aria-expanded="false"'),'More button accessibility state missing');

const drawer=read('js/next/shell_menu.js');
assert(drawer.includes('window.KaretaSmartActionHub?.close?.()'),'burger drawer does not close an overlapping More hub');
assert(drawer.includes('else if(wasOpen)toggle.focus'),'closing an already closed burger steals focus from More');
const routes=window.KaretaRouteRegistry;
assert(routes.has('notifications')&&routes.get('notifications').path==='#/notifications','notifications route is not registered');
assert(window.KaretaUIIcons.routeName('notifications')==='bell','notifications route SVG mapping missing');

const dynamic=read('js/next/dynamic_navigation.js');
assert(dynamic.includes("{ key:'notifications', section:'communication', menu:91"),'notifications missing from burger menu');
assert(dynamic.includes("{ key:'cabinetSettings', section:'account', menu:101"),'Settings missing from burger menu');
const app=read('js/next/app_next.js');
assert(app.includes("notifications:{global:'KaretaNotificationsPages',render:'renderNotifications',mount:'mountNotifications'}"),'notifications page is not connected to the router');

const css=read('css/next/navigation_more_accessibility.css');
assert(css.includes('#k-mobile-nav .k-nav-link.is-active')&&css.includes('#111827')&&css.includes('#fff'),'active mobile navigation contrast contract missing');
assert(css.includes('.k-nav-more[aria-expanded="true"]')&&css.includes('#ff3b12'),'More active-state accessibility contract missing');
const csp=read('index.php');assert(csp.includes("img-src 'self' data: blob: https://images.unsplash.com"),'Unsplash CSP source missing');
const realtime=read('js/next/core/realtime_client.js');
assert(realtime.includes('if(!identity.authenticated&&!legacyConfirmed)'),'realtime can still start before session verification');
assert(realtime.includes("window.addEventListener('kareta:identity-ready'"),'realtime does not resume after authoritative identity');
console.log('R188.5.3 More/navigation regression tests OK');
