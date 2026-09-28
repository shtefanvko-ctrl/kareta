'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const exists=f=>fs.existsSync(path.join(root,f));
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const routes=read('js/next/route_registry.js');
const engine=read('js/next/window_engine.js');
const app=read('js/next/app_next.js');
const dialogs=read('js/next/native_dialogs.js');
const css=read('css/next/ux_cleanup.css');
const reg=read('inc/asset_registry.php'),asset=read('inc/asset_version.php'),sw=read('sw.js'),config=read('config.php');
const manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
const dbv=Number((/define\('KARETA_DB_VERSION',\s*(\d+)\)/.exec(config)||[])[1]||0);
expect(dbv>=127,`R84 baseline was UX-only on DB 127; current schema may be newer (got ${dbv})`);
for(const marker of ['UX_SURFACE_BY_KEY','UX_SURFACE_TYPES','surfaceForKey','uxAudit',"'workspace','entity-window','work-dialog','deep-link-fallback'"])expect(routes.includes(marker),`route UX audit missing ${marker}`);
for(const marker of ["workDetail:'entity-window'","profile:'entity-window'","requestNew:'work-dialog'","masterNewsCreate:'work-dialog'","masterNewsEdit:'work-dialog'","cabinetData:'deep-link-fallback'","usedParts:'workspace'","parts:'workspace'"])expect(routes.includes(marker),`route surface classification missing ${marker}`);
expect(routes.includes("usedParts:Object.freeze({ path:'#/parts/used'")&&routes.includes("parts:Object.freeze({ path:'#/parts'"),'new and used parts must remain separate route surfaces');
expect(engine.includes('providerReviews')&&engine.includes('#\\/masters\\/reviews\\/(master|sto)'), 'provider reviews must open through Entity Window');
expect(dialogs.includes('window.KaretaNativeDialogs')&&dialogs.includes('showModal')&&dialogs.includes('Promise'),'native confirm dialog contract missing');
expect(reg.includes('css/next/ux_cleanup.css'),'R84 CSS not registered');
expect(reg.includes('js/next/native_dialogs.js'),'native_dialogs.js not registered');
expect(!exists('js/next/pages/role_dashboards.js'),'dead role_dashboards.js must be physically removed');
expect(!reg.includes('role_dashboards.js')&&!app.includes('KaretaRoleDashboardPages'),'dead role dashboard dependency still active');
expect(!exists('js/next/master_surface_runtime.js'),'legacy master surface injector must be physically removed');
expect(!reg.includes('master_surface_runtime.js'),'legacy master surface injector must be unregistered');
const noSelect=[
 'js/next/pages/masters.js','js/next/pages/services.js','js/next/pages/work_feed.js','js/next/pages/seller.js',
 'js/next/pages/calendar_booking.js','js/next/pages/crm.js','js/next/pages/assistant.js','js/next/pages/work_order.js',
 'js/next/pages/request.js','js/next/pages/sto_workplace.js','js/next/pages/master_workplace.js','js/next/pages/master_schedule.js',
 'js/next/pages/chats.js','js/next/account_window.js','js/next/request_window.js'
];
for(const f of noSelect)expect(!read(f).includes('<select'),`active UX still contains legacy <select>: ${f}`);
for(const f of ['js/next/pages/work_feed.js','js/next/pages/seller.js','js/next/pages/news.js']){
 const s=read(f); expect(!s.includes('window.confirm(')&&!s.includes('window.prompt('),`user-facing browser dialog remains in ${f}`);
}
expect(read('js/next/pages/work_feed.js').includes('KaretaNativeDialogs?.confirm'),'work feed destructive action must use native confirm');
expect(read('js/next/pages/seller.js').includes('KaretaNativeDialogs?.confirm?.'),'seller destructive actions must use native confirm');
expect(read('js/next/pages/news.js').includes('KaretaNativeDialogs?.confirm?.'),'master news destructive action must use native confirm');
const news=read('js/next/pages/news.js');expect(news.includes('data-master-news-editor-dialog')&&news.includes('k-r84-work-dialog')&&news.includes('data-master-news-create')&&news.includes('data-master-news-edit'),'master news create/edit must use native work-dialog');
expect(!read('js/next/pages/assistant.js').includes('k-page-hero'),'assistant must use compact workspace header');
for(const f of ['js/next/pages/masters.js','js/next/pages/work_feed.js','js/next/pages/calendar_booking.js','js/next/pages/crm.js','js/next/pages/assistant.js'])expect(read(f).includes('k-r84-workspace-head'),`R84 workspace header missing in ${f}`);
for(const f of ['js/next/pages/calendar_booking.js','js/next/pages/crm.js'])expect(read(f).includes('k-r84-'),`R84 professional cleanup marker missing in ${f}`);
for(const frozen of ['#k-mobile-nav','#k-desktop-nav','#k-shell-header','.k-menu-drawer','.k-context-switch'])expect(!css.includes(frozen),`R84 CSS targets frozen shell ${frozen}`);
const current=(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/.exec(asset)||[])[1]||'';
expect(/^188\.5\.5\.6\.84\.[0-9]+$/.test(current),'short current asset version missing');
expect(sw.includes(`const RELEASE = '${current}';`),'short current SW version missing');
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`)}
// R84 closes legacy browser controls globally in the active js/next runtime.
function walk(dir){let out=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out=out.concat(walk(p));else if(e.isFile()&&p.endsWith('.js'))out.push(p);}return out;}
for(const abs of walk(path.join(root,'js/next'))){
 const rel=path.relative(root,abs).replaceAll('\\','/'),body=fs.readFileSync(abs,'utf8');
 if(body.includes('<select'))fail.push(`legacy <select> returned: ${rel}`);
 if(body.includes('window.confirm(')||body.includes('window.prompt('))fail.push(`browser modal returned: ${rel}`);
 const lines=body.split(/\r?\n/);for(let i=0;i<lines.length;i++){const line=lines[i];if(/(?:^|[^.\w])prompt\s*\(/.test(line))fail.push(`bare prompt returned: ${rel}:${i+1}`);if(/(?:^|[^.\w])confirm\s*\(/.test(line)&&!/(?:async\s+)?function\s+confirm\s*\(/.test(line))fail.push(`bare confirm returned: ${rel}:${i+1}`);}
}
expect(!read('js/next/onboarding/onboarding_form_ui.js').includes('profileForm'),'dead onboarding profile form must be removed');
expect(read('js/next/pages/admin_workspaces.js').includes('data-admin-choice'),'admin actions must use native choice controls');
expect(read('js/next/pages/news.js').includes('Новости теперь в Сообществе'),'legacy news route must be a compatibility bridge');

const market=read('js/next/pages/market.js');
expect(market.includes('k-r84-workspace-head')&&market.includes("workDialog('cart'")&&market.includes("workDialog('orders'")&&market.includes("workDialog('warehouses'")&&market.includes("workDialog('product'"),'seller warehouse must be one workspace with large work dialogs');
expect(!market.includes('k-market-hero')&&!market.includes('k-market-layout'),'legacy R184 warehouse site layout must be removed');
const cabinet=read('js/next/pages/cabinet.js');
expect(cabinet.includes("'#/seller/products'")&&cabinet.includes("'#/seller/orders'"),'seller cabinet must link to seller product/order workspaces');
const vehicle=read('js/next/pages/vehicle.js');
expect(vehicle.includes('<b>Новые запчасти</b>')&&vehicle.includes('href="#/parts/used"'),'vehicle parts actions must keep new and used markets distinct');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84 Global UX Cleanup: route UX map + native dialogs + active select cleanup + dead dashboard removal + separate parts markets + Shell Freeze 2 OK');
