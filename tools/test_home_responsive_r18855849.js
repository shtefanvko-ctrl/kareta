'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const core=read('js/next/pages/core.js');
const index=read('index.php');
const shellCss=read('css/next/shell_header_restoration.css');
const css=read('css/next/home_responsive.css');
const registry=read('inc/asset_registry.php');
const services=read('js/next/pages/services.js');
const version=read('inc/asset_version.php');
const sw=read('sw.js');

assert(version.includes("'188.5.5.6.84.14'"),'Home release version mismatch');
assert(sw.includes("const RELEASE = '188.5.5.6.84.14';"),'Home service-worker version mismatch');
assert(registry.includes("'css/next/home_responsive.css'"),'Home CSS is not registered');
assert(registry.indexOf('home_responsive.css')>registry.indexOf('kflow_primary_pages.css'),'Home CSS must load after shared page layers');

for(const text of ['Здравствуйте','Что нужно вашему автомобилю?','Создать заявку','Опишите проблему —','Начать','Эвакуатор','Диагностика','Ремонт','Мой автомобиль','Рядом с вами','Смотреть все','Популярные услуги','Замена масла','Шиномонтаж']){
  assert(core.includes(text),`Approved home copy is missing: ${text}`);
}
for(const marker of ['data-home-responsive','data-home-search','data-home-action="request"','data-home-nearby-list','data-home-popular-list']){
  assert(core.includes(marker),`Home runtime marker is missing: ${marker}`);
}
for(const marker of ['id="k-shell-header"','data-shell-location','data-shell-notification-badge','id="k-menu-toggle"','id="k-desktop-nav"']) assert(index.includes(marker),`Shell header marker is missing: ${marker}`);
assert(index.includes('assets/onboarding/kareta_logo_full.png'),'Approved logo path is missing from global Shell');
assert(shellCss.includes('@media (min-width:861px)')&&shellCss.includes('#k-desktop-nav.k-desktop-nav'),'Desktop top navigation restoration is missing');
assert(core.includes('city-calm-mobile.png')&&core.includes('city-calm-desktop-standard.png'),'Responsive request visual is missing');
assert(core.includes("getMastersCatalog({type:'sto',city}"),'Nearby STO API is not connected to the resolved profile city');
assert(core.includes("KaretaCatalogState.subscribe(paintPopular)"),'Popular service catalog state is not connected');
assert(core.includes("signal.aborted||error?.name==='AbortError'||error?.code==='ABORT_ERR'"),'Expected abort classification is missing');
assert(core.includes("controller.abort()")&&core.includes("removeEventListener('kareta:notification-unread'"),'Home cleanup contract is missing');
assert(core.includes('data-request-service-name="Диагностика"')&&core.includes('data-request-source="home_popular"'),'Request prefill metadata is missing from Home actions');
assert(core.includes('data-home-station-image')&&core.includes('onImageError'),'Station image recovery is missing');
assert(core.includes("data.state='loading'")||core.includes("dataset.state='loading'"),'Home state model is missing');
const requestWindow=read('js/next/request_window.js');
assert(requestWindow.includes('requestServiceName')&&requestWindow.includes("sessionStorage.setItem('kareta.request.prefill'"),'Request window must persist prefill before opening');
assert(services.includes("sessionStorage.getItem('kareta.services.search')"),'Home search is not handed to the real services route');

for(const contract of ['width:min(calc(100% - 40px),1280px)','grid-template-columns:repeat(2,minmax(0,1fr))','grid-template-columns:minmax(0,1.35fr) minmax(360px,.95fr)','grid-template-columns:minmax(0,1.25fr) minmax(440px,1fr)','@media(max-width:359px)','@media(min-width:768px)','@media(min-width:900px)','@media(min-width:1200px)','@media(prefers-reduced-motion:reduce)']){
  assert(css.includes(contract),`Responsive home CSS contract is missing: ${contract}`);
}
assert(!css.includes('.k-mobile-nav'),'Frozen bottom navigation must remain untouched');
assert(!core.includes('class="k-home-header"'),'Home must not duplicate the global Shell header');
assert(css.includes('body.k-home-route-active #k-shell-header{display:grid}'),'Home must keep the global Shell visible');
assert(!core.includes('REAL_'),'Unresolved specification placeholder returned');

console.log('R188.5.5.6.84.14 audited responsive home contract: OK');
