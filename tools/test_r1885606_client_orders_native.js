'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const failures=[];const expect=(v,m)=>{if(!v)failures.push(m)};
const page=read('js/next/pages/orders.js');
const css=read('css/next/client_orders_native.css');
const registry=read('inc/asset_registry.php');
const manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
for(const token of ['k-client-orders-native','k-client-orders-status-grid','data-client-order-status-filter="offers"','data-client-orders-filter-open','data-client-order-offers','data-client-order-actions','k-client-orders-dialog','data-client-bid-choose','data-client-bid-confirm','data-client-bid-decline','data-client-exchange-republish'])expect(page.includes(token),`client orders native token missing: ${token}`);
const clientStart=page.indexOf('function renderClientOrders');
const clientEnd=page.indexOf('function renderOrders',clientStart+10);
const clientBlock=page.slice(clientStart,clientEnd);
expect(clientStart>=0&&clientEnd>clientStart,'client render block missing');
expect(!clientBlock.includes('k-client-exchange-board'),'legacy separate exchange board must be removed from client orders');
expect(!clientBlock.includes('<select'),'client orders must not use select/dropdown');
expect(!clientBlock.includes('swiper'),'client orders must not use sliders');
for(const token of ['grid-template-columns:repeat(2,minmax(0,1fr))','@media(max-width:760px)','k-client-orders-dialog','k-client-native-bid','@media(min-width:1900px)'])expect(css.includes(token),`client orders CSS missing: ${token}`);
for(const shellSelector of ['#k-mobile-nav','#k-desktop-nav','#k-shell-header','.k-menu-drawer','.k-context-switch'])expect(!css.includes(shellSelector),`client orders CSS targets frozen shell ${shellSelector}`);
expect(registry.includes('client_orders_native.css'),'client orders native CSS not registered');
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`);}
for(const file of ['inc/asset_version.php','sw.js'])expect(read(file).includes('r1885606-client-orders-native'),`${file} release tag missing`);
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('R188.5.5.6.46 client orders native + shell freeze: OK');
