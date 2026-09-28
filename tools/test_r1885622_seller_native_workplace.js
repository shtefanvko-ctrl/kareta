'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const page=read('js/next/pages/seller.js'),api=read('api/seller_shop.php'),css=read('css/next/seller_native_workplace.css'),registry=read('inc/asset_registry.php'),asset=read('inc/asset_version.php'),sw=read('sw.js'),config=read('config.php'),manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
const dbv=Number((/KARETA_DB_VERSION',\s*(\d+)/.exec(config)||[])[1]||0);expect(dbv===115,'R62 must not add a DB migration; expected DB version 115');
for(const t of ['data-seller-edit','data-seller-visibility','data-seller-archive','data-seller-product-filter','data-seller-order-filter','data-seller-order-action','data-seller-order-open','data-seller-order-dialog','data-seller-category-search','data-seller-attention','k-seller-quick-actions','condition_code','exchange_available','fitment_text','orderActionButtons','orderDetailContent','categoryChoices','effectiveProductStatus','#/parts/item/','Редактировать товар','Передать в доставку','Оформить возврат','Нет в наличии'])expect(page.includes(t),`seller native UI missing ${t}`);
expect(!/<select\b/i.test(page),'seller workplace must not contain select/dropdown controls');expect(!/swiper/i.test(page),'seller workplace must not use Swiper');
for(const t of ['fitment_json','seller_order_items','delivery_address','delivery_price','comment',"$order['items']"])expect(api.includes(t),`seller dashboard payload missing ${t}`);
for(const t of ['.k-seller-filter-row','.k-seller-choice-row','.k-seller-category-grid','.k-seller-category-search','.k-seller-attention-grid','.k-seller-quick-actions','.k-seller-order-card','.k-seller-order-dialog','.k-seller-order-actions','.k-seller-product-actions','height:100dvh'])expect(css.includes(t),`R62 CSS missing ${t}`);
expect(!css.includes('#k-mobile-nav')&&!css.includes('#k-desktop-nav')&&!css.includes('#k-menu-toggle'),'R62 CSS must not alter frozen Shell');
expect(registry.includes('css/next/seller_native_workplace.css'),'R62 stylesheet missing from asset registry');
expect(asset.includes('r1885622-seller-native-workplace')&&sw.includes('r1885622-seller-native-workplace'),'R62 release suffix missing from asset version / SW');
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`)}
if(fail.length){console.error(fail.join('\n'));process.exit(1)}console.log('R188.5.5.6.62 seller native workplace + editable products + button lifecycle + Shell Freeze 2 OK');
