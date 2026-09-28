'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),fail=[];
const expect=(v,m)=>{if(!v)fail.push(m)};
const config=read('config.php'),migration=read('api/migrations/117_master_requests_workplace_services.php'),workApi=read('api/master_workplace.php'),dispatch=read('api/production_dispatch.php'),db=read('api/db.php');
const workplace=read('js/next/pages/master_workplace.js'),workplaceClient=read('js/next/work_orders/master_workplace_api.js'),cabinet=read('js/next/pages/cabinet.js'),services=read('js/next/pages/service_management.js'),feed=read('js/next/pages/work_feed.js'),owner=read('js/next/pages/master_profile_owner.js');
const css=read('css/next/master_requests_workplace_services.css'),registry=read('inc/asset_registry.php'),asset=read('inc/asset_version.php'),sw=read('sw.js'),manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
const dbv=Number((/KARETA_DB_VERSION',\s*(\d+)/.exec(config)||[])[1]||0);expect(dbv===117,'R64 expected DB version 117');
for(const t of ["'version' => 117",'master_workplace_preferences','windows_json','params_json','PRIMARY KEY (`master_id`)'])expect(migration.includes(t),`migration missing ${t}`);
expect(!dispatch.includes("if(empty($score['eligible'])&&$tab==='new')continue"),'exchange must not hide zero service-match requests');
for(const t of ['Вне «Моих услуг» · заявку всё равно можно посмотреть и принять',"type IN ('service_order','request','service')"])expect(dispatch.includes(t),`dispatch missing ${t}`);
for(const t of ['serviceMatched','Вне «Моих услуг» — доступна для просмотра и отклика','kareta_master_workplace_preferences_defaults','kareta_master_workplace_preferences_get','kareta_master_workplace_preferences_save','if(count($leads)>=12)break'])expect(workApi.includes(t),`workplace API missing ${t}`);
expect(db.includes("case 'masterWorkplace.preferences.save'"),'db router missing master workplace preferences save');
expect(workplaceClient.includes('savePreferences'),'master workplace JS API missing savePreferences');
for(const t of ['ДОСТУПНЫЕ ЗАЯВКИ','Настроить окна',"#/services/manage','services','Мои услуги'",'workplacePreferences','autoRefreshSec','exchangeLimit','is-compact'])expect(workplace.includes(t),`master workplace UI missing ${t}`);
for(const t of ['masterWorkplaceSettings','master_window_${key}','master_exchange_limit','master_upcoming_limit','master_refresh_sec','master_compact_cards','savePreferences','Мои услуги'])expect(cabinet.includes(t),`master settings UI missing ${t}`);
for(const t of ['renderMasterServiceManagement','data-master-category-toggle','data-master-service-enabled','data-master-service-price','data-master-service-duration','Моя цена, ₸','Моё время, мин','Стандарт:','Сохранить Мои услуги','priceTouched','durationTouched','keepPrice','keepDuration','masterOfferEnabled(existing)'])expect(services.includes(t),`My Services matrix missing ${t}`);
expect(feed.includes('>Мои услуги</a>'),'exchange header must link to My Services');
expect(owner.includes('>Мои услуги</a>')&&owner.includes('<b>Мои услуги</b>'),'master owner profile labels must say My Services');
for(const t of ['.k-master-native-exchange','.k-master-workplace-settings','.k-master-window-options','.k-master-services-matrix','.k-master-service-category','.k-master-service-own-fields'])expect(css.includes(t),`R64 CSS missing ${t}`);
expect(!css.includes('#k-mobile-nav')&&!css.includes('#k-desktop-nav')&&!css.includes('#k-menu-toggle'),'R64 CSS must not alter Shell');
expect(registry.includes('css/next/master_requests_workplace_services.css'),'R64 stylesheet missing from registry');
expect(asset.includes('r1885624-master-requests-workplace-services')&&sw.includes('r1885624-master-requests-workplace-services'),'R64 release suffix missing from asset/SW');
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`)}
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.64 master requests + workplace settings + My Services + Shell Freeze 2 OK');
