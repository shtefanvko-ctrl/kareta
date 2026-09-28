'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),failures=[];const expect=(v,m)=>{if(!v)failures.push(m)};
const config=read('config.php'),migration=read('api/migrations/114_parts_native_marketplace.php'),page=read('js/next/pages/parts.js'),used=read('api/used_market.php'),seller=read('api/seller_shop.php'),details=read('api/catalog_details.php'),order=read('js/next/pages/work_order.js'),css=read('css/next/parts_native_marketplace.css'),registry=read('inc/asset_registry.php'),manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json')),r59=read('inc/asset_version.php').includes('r1885619-parts-window-lists-product-detail');
const dbv=Number((/KARETA_DB_VERSION',\s*(\d+)/.exec(config)||[])[1]||0);expect(dbv>=114,'DB version must be >=114');
for(const t of ["'version' => 114",'condition_code','exchange_available','exchange_note','listing_type','source_vehicle_id'])expect(migration.includes(t),`migration 114 missing ${t}`);
for(const t of ["new:{label:'Новые'","used:{label:'БУ'","restored:{label:'Восстановленные'","exchange:{label:'Обмен'",'data-parts-filter-dialog','data-parts-vehicle-dialog','data-used-form-dialog','data-parts-categories','clientCabinet.get','explicitCompatibility','sourceVehicleId','exchangeNote'])expect(page.includes(t),`parts native contract missing ${t}`);if(r59){expect(page.includes('data-parts-market-list-dialog'),'R59 list window missing');expect(!page.includes('data-parts-types'),'R59 must remove main type selector');}else expect(page.includes('data-parts-types'),'R58 type selector missing');
expect(!/<select\b/i.test(page),'active #/parts must not contain <select>');expect(!/swiper/i.test(page),'active #/parts must not contain Swiper');
for(const t of ['listing_type','source_vehicle_id','exchange_note','parts.browse','kareta_require_api_capability','exchange_note_required'])expect(used.includes(t),`used marketplace backend missing ${t}`);
for(const t of ['condition_code','exchange_available','exchange_note']){expect(seller.includes(t),`seller catalog missing ${t}`);expect(details.includes(t),`product detail missing ${t}`)}
expect(order.includes('#/parts?orderId=')&&order.includes('Найти в Marketplace'),'work order must link parts reservation to marketplace');
for(const t of ['.k-parts-native-types','.k-parts-native-categories','grid-template-columns:repeat(2,minmax(0,1fr))','grid-template-columns:1fr','height:100dvh'])expect(css.includes(t),`native parts CSS missing ${t}`);
expect(!css.includes('#k-mobile-nav')&&!css.includes('#k-desktop-nav')&&!css.includes('#k-menu-toggle'),'parts stylesheet must not modify Shell');
expect(registry.includes('css/next/parts_native_marketplace.css'),'R58 CSS missing from registry');
for(const f of ['inc/asset_version.php','sw.js'])expect(read(f).includes('r1885618-parts-native-marketplace'),`${f} release suffix missing`);
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`)}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('R188.5.5.6.58 parts: unified new/used/restored/exchange + native mobile + repair/garage bridge + Shell Freeze 2 OK');
