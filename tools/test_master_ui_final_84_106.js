'use strict';
const fs=require('fs'),path=require('path');
const {read,routePlan,styleOrder}=require('./master_route_contract_utils');
const root=path.resolve(__dirname,'..');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};
const plan=routePlan();
const registry=read('inc/asset_registry.php');
const foundation=read('css/next/master_ui_foundation.css');
const roleSkin=read('css/next/master_role_skin.css');
const surface=read('css/next/master_surface_contract.css');
const mobile=read('css/next/master_mobile_nav.css');
const boot=read('css/runtime_boot_bundle.css');

// route -> role: shared pages remain their own routes, with a late Master role skin.
expect(!styleOrder(plan,['cabinetSettings']).includes('css/routes/master_runtime.css'),'cabinet/settings still loads Master route runtime instead of role skin');
for(const key of ['parts','cabinet','cabinetSettings','orders','chats','community']){
  const order=styleOrder(plan,[key]);
  const guard=order.indexOf('css/routes/client_guard_postlude.css');
  const role=order.indexOf('css/next/master_role_skin.css');
  const final=order.indexOf('css/next/master_surface_contract.css');
  expect(role>=0&&final>=0,`${key}: Master role/page layers missing`);
  expect(guard<role&&role<final,`${key}: client guard can outrank Master role skin`);
}
expect(registry.includes("'css/next/master_ui_foundation.css','css/next/master_role_skin.css','css/next/master_surface_contract.css'"),'Master cascade layers are not registered in component -> role -> page order');

// component foundation: one token language, one button API, one dialog geometry.
for(const token of ['--k-master-bg','--k-master-surface','--k-master-line','--k-master-text','--k-master-muted','--k-master-accent','--k-master-success','--k-master-warning','--k-master-danger','--k-master-info','--k-master-title','--k-master-section-title','--k-master-card-title','--k-master-body','--k-master-caption','--k-master-eyebrow']) expect(foundation.includes(token),`missing Master token ${token}`);
expect(foundation.includes(':is(.k-btn,.k-button)'),'Master button compatibility bridge missing');
expect(foundation.includes('.k-btn--primary')&&foundation.includes('.k-btn--secondary')&&foundation.includes('.k-btn--danger')&&foundation.includes('.k-btn--ghost'),'Master button states incomplete');
expect(foundation.includes('.k-master-dialog')&&foundation.includes('height:100dvh')&&foundation.includes('env(safe-area-inset-bottom'),'Master dialog/mobile safe-area contract incomplete');
expect(foundation.includes('.k-state--error')&&foundation.includes('.k-state--offline'),'Master state system incomplete');

// mobile nav has a single owner and never falls back to five columns/8px labels.
expect(mobile.includes('--k-mobile-nav-count:6;')&&mobile.includes('repeat(6,minmax(0,1fr))'),'Master bottom nav is not six-slot');
expect(mobile.includes('font-size:10px')&&mobile.includes('font-size:9px')&&!mobile.includes('font-size:8px'),'Master bottom-nav label scale regressed');
expect(!mobile.includes('!important'),'Master bottom nav still fights the cascade');
expect(!registry.includes("'css/next/master_orders_dedup.css'"),'retired five-column dedup layer is still active');
expect(!boot.includes('SOURCE: css/next/master_orders_dedup.css'),'retired five-column dedup layer remains in boot CSS');
const marker='/* ===== SOURCE: css/next/master_mobile_nav.css ===== */';
const start=boot.indexOf(marker); expect(start>=0,'Master mobile nav missing from boot CSS');
const next=boot.indexOf('/* ===== SOURCE:',start+marker.length);
const embedded=boot.slice(start+marker.length,next<0?boot.length:next).trim();
expect(embedded===mobile.trim(),'boot Master mobile nav is stale versus source');

// page wrappers and role-aware shared routes.
const pageUi=read('js/next/page_ui.js');
expect(pageUi.includes("rootRole === 'master' || navContext === 'master'"),'shared page wrapper is not role-aware');
expect(read('js/next/pages/community.js').includes("isMasterRole()?' k-master-page k-master-surface-page':''"),'community lacks Master role wrapper');
for(const selector of ['.k-shop-page','.k-staff-cabinet--master','.k-page[data-page="chats"]','.k-community-page']) expect(roleSkin.includes(selector),`shared Master role skin missing ${selector}`);

// Master components use the central icon registry for system actions.
const uiIcons=read('js/next/ui_icons.js'); expect(uiIcons.includes("cart:'")&&uiIcons.includes("camera:'"),'central icon registry lacks shared Master route icons');
const masterJs=['master_workplace.js','master_schedule.js','master_profile_owner.js','master_wall.js','master_works.js','master_reviews.js','service_management.js','parts.js','chats.js','orders.js','cabinet.js','community.js'].map(f=>'js/next/pages/'+f);
for(const file of masterJs){const src=read(file);expect(!/[×⌕]/.test(src),`${file}: literal close/search UI glyph remains`);}
expect(!read('js/next/pages/master_schedule.js').includes('k-button'),'Schedule still emits the second button API');

// Owner pages no longer define a second wide/hero design language.
const owner=read('css/next/master_owner_profile.css'),reviews=read('css/next/master_reviews_social.css'),wall=read('css/next/master_social_wall.css'),works=read('css/next/master_works_portfolio.css');
expect(!reviews.includes('max-width:2400px'),'Reviews still owns a 2400px page contour');
for(const [name,css] of [['owner',owner],['reviews',reviews],['wall',wall],['works',works]]) expect(!/font-size:clamp\(28px/.test(css),`${name}: independent owner-page H1 scale remains`);
expect(!wall.includes('padding-inline:0'),'Wall still makes the whole mobile page edge-to-edge');
expect(works.includes('var(--k-master-success')&&works.includes('var(--k-master-warning')&&works.includes('var(--k-master-info'),'Works still hardcodes business status colors');

// Final page bridge should remain lean and not re-own mobile navigation.
expect(surface.includes('.k-master-page-header')&&surface.includes("content:'МАСТЕР'"),'Master page/shell bridge missing');
expect(!surface.includes('--k-mobile-nav-count'),'page layer has taken ownership of mobile navigation again');
console.log('OK MASTER UI FINAL 84.106 route -> role -> component -> page');
