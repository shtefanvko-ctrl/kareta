'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const page=read('js/next/pages/seller.js');
const css=read('css/next/seller_workspace_windows.css');
const reg=read('inc/asset_registry.php'),asset=read('inc/asset_version.php'),sw=read('sw.js'),config=read('config.php');
const manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
const dbv=Number((/define\('KARETA_DB_VERSION',\s*(\d+)\)/.exec(config)||[])[1]||0);
expect(dbv>=127,`R83 baseline was UX-only on DB 127; current schema may be newer (got ${dbv})`);
for(const marker of ["SELLER_WORKSPACE_R83_CONTRACT='R188.5.5.6.83'",'k-seller-r83-workspace','k-seller-r83-commandbar','k-seller-r83-operations','data-seller-operations','k-seller-r83-window','data-seller-profile-tab="profile"','data-seller-profile-tab="delivery"','data-seller-profile-tab="returns"','#/parts/used'])expect(page.includes(marker),`R83 seller page missing ${marker}`);
for(const forbidden of ['k-page-hero k-seller-hero','k-seller-grid ${','k-seller-quick-actions'])expect(!page.includes(forbidden),`R83 still contains old seller page surface ${forbidden}`);
expect(page.includes('href="#/parts">Новые запчасти</a><a href="#/parts/used">Биржа БУ</a>'),'R83 must keep new and used markets separate');
expect(page.includes('href="#/parts/item/${encodeURIComponent(String(product.id||\'\'))}">Открыть</a>'),'product detail must continue through entity-route/window');
expect(!page.includes('<select'),'seller active renderer must not contain select');
for(const token of ['dialog.k-seller-r83-window','.k-seller-r83-product-row','.k-seller-r83-order-row','.k-seller-r83-window-tabs','height:100dvh'])expect(css.includes(token),`R83 CSS missing ${token}`);
for(const frozen of ['#k-mobile-nav','#k-desktop-nav','#k-shell-header','.k-menu-drawer','.k-context-switch'])expect(!css.includes(frozen),`R83 CSS targets frozen shell ${frozen}`);
expect(reg.includes('css/next/seller_workspace_windows.css'),'R83 CSS not registered');
expect(asset.includes('r1885643-seller-marketplace-window-architecture')&&sw.includes('r1885643-seller-marketplace-window-architecture'),'R83 release suffix missing');
expect(asset.includes('r1885642-sto-workspace-window-architecture'),'R82 must precede R83');
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`)}
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.83 Seller & Marketplace Window Architecture: seller workspace + large seller windows + separate new/used markets + Shell Freeze 2 OK');
