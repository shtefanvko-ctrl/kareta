'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};

const foundation=read('css/next/master_ui_foundation.css');
const surface=read('css/next/master_surface_contract.css');
const shell=read('css/next/master_shell_canonical_84_143.css');
const geometry=read('css/next/page_geometry_canonical_84_146.css');
const clientGuard=read('css/routes/client_guard_postlude.css');
const app=read('js/next/app_next.js');
const hub=read('js/next/smart_action_hub.js');
const registry=read('inc/asset_registry.php');

expect(foundation.includes('--k-master-content-max:var(--k-route-frame-max,1280px);'),
  'Master foundation still owns a divergent content width');
expect(surface.includes('--k-master-content-max:var(--k-route-frame-max,1280px);'),
  'Master surface still owns a divergent content width');

expect(shell.includes('grid-template-columns:repeat(2,44px)!important'),
  'Master quick FABs are not a compact horizontal rail');
expect(shell.includes('#k-mobile-fab-stack[hidden]')&&shell.includes('display:none!important'),
  'Master quick FAB rail can override the hidden state');
expect(shell.includes(':is(.k-smart-action-open,.k-menu-open) #k-mobile-fab-stack'),
  'Master quick FAB rail is not suppressed under navigation overlays');
expect(shell.includes('.k-smart-action-open #k-mobile-nav .k-nav-link:not(.k-nav-more).is-active'),
  'Master More state does not neutralize the underlying route visual state');
expect(shell.includes('.k-nav-more:is(.is-active,[aria-expanded="true"])'),
  'Master More trigger has no authoritative open visual state');
expect(shell.includes('+ 66px)!important'),
  'Master page does not reserve clearance for the quick FAB rail');

expect(hub.includes("document.documentElement.classList.add('k-smart-action-open')"),
  'Smart Action Hub does not expose the open state required by Master nav');
expect(hub.includes("button.classList.toggle('is-active',active)"),
  'Smart Action Hub does not synchronize the More button state');

expect(clientGuard.includes('R188.5.5.6.84.150 — narrow WebView Masters filter rail'),
  'Masters narrow-WebView filter rail correction missing');
expect(clientGuard.includes('scroll-padding-left:var(--k-client-mobile-gutter,12px)!important'),
  'Masters filter rail left scroll padding missing');
expect(clientGuard.includes('scroll-padding-right:var(--k-client-mobile-gutter,12px)!important'),
  'Masters filter rail right scroll padding missing');

const errStart=app.indexOf('function routeLoadErrorHtml');
const errEnd=app.indexOf('function renderResolvedRoute',errStart);
const errBlock=app.slice(errStart,errEnd);
expect(errStart>=0&&errEnd>errStart,'routeLoadErrorHtml block missing');
expect(errBlock.includes('data-route-load-error'),'route error does not use compact fail-soft surface');
expect(errBlock.includes("offline?'offline':'asset'"),'route error kind is not normalized');
expect(!errBlock.includes('${message}'),'raw loader message is exposed in route error UI');
expect(!errBlock.includes("error?.message||'Не удалось загрузить файлы раздела'"),
  'legacy raw loader error rendering remains');
expect(app.includes("'route.assets.failed',{route:key,message:String(error?.message||error)"),
  'technical route failure detail is not retained in runtime diagnostics');
expect(app.includes("routeRuntime.onAction('route-assets-back'"),
  'route error Back action missing');
expect(geometry.includes('84.150 — compact fail-soft route surface'),
  'compact route error geometry missing');

const masterPlan=registry.match(/'masterSurfaceContract'\s*=>\s*\[[\s\S]*?'styles'\s*=>\s*\[([^\]]+)\]/);
expect(masterPlan&&masterPlan[1].lastIndexOf("'css/next/master_shell_canonical_84_143.css'")>=0,
  'Master canonical shell is not retained in the last-cascade route contract');

console.log('MASTER_UI_84_150: PASS frame=1280 more=single fab=horizontal errors=sanitized filters=scroll-safe');
