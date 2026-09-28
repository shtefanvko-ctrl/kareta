'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const home=read('js/next/pages/core.js');
const homeCss=read('css/next/home_simple.css');
const hub=read('js/next/smart_action_hub.js');
const hubCss=read('css/next/smart_action_hub.css');
const nav=read('js/next/shell_nav.js');
const registry=read('inc/asset_registry.php');
const cabinet=read('js/next/pages/cabinet.js');
const account=read('js/next/account_window.js');

for(const marker of [
  'k-home-reference','k-home-ref-location','k-home-ref-heading','k-home-location-dialog',
  'k-home-ref-search','k-home-ref-hero','k-home-ref-steps','k-home-ref-actions',
  'data-home-nearby','k-home-ref-chips','data-home-greeting','data-home-location-detect',
  'Что нужно вашему автомобилю?','Создать заявку','Популярные услуги'
]) assert(home.includes(marker),`home reference marker missing: ${marker}`);
assert(!home.includes('k-home-ref-topbar')&&!home.includes('k-home-ref-bell'),'Home must rely on frozen shell header instead of duplicating logo/bell');
assert(home.includes('/media/kareta_create_request_vehicle_background_r188_5_5_6_84_31.png'),'home hero must use approved request vehicle reference art');
assert(home.includes('aria-label="4 шага заявки"')&&home.includes('<span>4</span>'),'home hero must expose the four-step request preview');
assert(home.includes('<picture>'),'home hero must use responsive picture markup instead of a fragile CSS-only background');
assert(home.includes("route:'#/tow-truck'"),'tow quick action route must use canonical tow-truck route');
assert(home.includes("api/db.php?action=masters.catalog"),'nearby providers must come from real masters catalog');
assert(home.includes('navigator.geolocation')&&home.includes('haversine'),'Home location/distance contract missing');
assert(!home.includes('Здравствуйте, <span data-home-greeting-name>Константин'),'hard-coded greeting returned');
assert(!home.includes('AutoPro Service')&&!home.includes('Drive Center'),'hard-coded demo nearby providers returned');
for(const action of ['Эвакуатор','Диагностика','Ремонт','Мой автомобиль'])assert(home.includes(action),`home action missing: ${action}`);

assert(hub.includes("MORE_WINDOW_CONTRACT='KARETA_MORE_WINDOW_V1_2'"),'More V1.2 contract missing');
assert(hub.includes("layout:'honeycomb'"),'More must use fixed honeycomb layout');
for(const marker of ['class="k-more-window"','class="k-more-window-profile"','class="k-more-window-hub"','class="k-more-window-core"','class="k-more-window-support"','Быстрый доступ','Поддержка KARETA.KZ'])assert(hub.includes(marker),`More marker missing: ${marker}`);
assert(!hub.includes("new Set(['grid','arc','hex'])"),'legacy More variants returned');
assert(!hub.includes("layout:'arc'")&&!hub.includes("layout:'grid'")&&!hub.includes("layout:'hex'"),'legacy More layout state returned');
assert(!hub.includes('<nav'),'More must not render a second bottom navigation');
assert(!hub.includes('data-more-contexts')&&!hub.includes('k-more-window-header'),'More must rely on shell header and shell context switch without duplicate visual rows');
assert(!hubCss.includes('k-more-window-backdrop'),'More V1.2 must be a clean shell-contained surface, not a backdrop card overlay');
assert((hub.match(/k-more-window-action--\$\{index\+1\}/g)||[]).length===1,'More must render one six-cell action system');
for(const marker of ['width:min(430px','--hex-w:118px','--hex-h:104px','width:52px','height:46px','#ff3b12','bottom:calc(var(--k-mobile-nav-h,72px)'])assert(hubCss.includes(marker),`More visual token missing: ${marker}`);
assert(nav.includes('data-mobile-more')&&nav.includes('KaretaSmartActionHub?.toggle?.()'),'shell More button is not connected to single hub');
assert(!fs.existsSync(path.join(root,'css/next/smart_action_account.css')),'duplicate smart_action_account.css returned');
assert(!registry.includes('smart_action_account.css'),'duplicate smart_action_account.css is registered');
assert(cabinet.includes('value="honeycomb"')&&!cabinet.includes('Вариант №1')&&!cabinet.includes('Полукруг'),'cabinet still exposes legacy More layouts');
assert(account.includes('value="honeycomb"')&&!account.includes('Вариант №1'),'account window still exposes legacy More layouts');

console.log('Home reference + More V1.2 contract: OK');
