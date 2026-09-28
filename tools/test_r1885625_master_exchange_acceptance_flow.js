'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),fail=[];
const expect=(v,m)=>{if(!v)fail.push(m)};
const config=read('config.php'),migration=read('api/migrations/118_master_exchange_acceptance_flow.php'),db=read('api/db.php'),dispatch=read('api/production_dispatch.php'),workApi=read('api/master_workplace.php');
const feed=read('js/next/pages/work_feed.js'),workplace=read('js/next/pages/master_workplace.js'),orders=read('js/next/pages/orders.js');
const css=read('css/next/master_exchange_acceptance_flow.css'),registry=read('inc/asset_registry.php'),asset=read('inc/asset_version.php'),sw=read('sw.js'),manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
const dbv=Number((/KARETA_DB_VERSION',\s*(\d+)/.exec(config)||[])[1]||0);expect(dbv===118,'R65 expected DB version 118');
for(const t of ["'version' => 118",'payload_hash','master_exchange_notification_receipts','PRIMARY KEY (`master_id`,`request_id`,`event_type`)'])expect(migration.includes(t),`migration missing ${t}`);
for(const t of ["case 'masterExchange.saveResponse'",'kareta_idempotency_begin($pdo,$action,$body)','LIMIT 1 FOR UPDATE','exchange_response_limit_reached','duplicate_response','payload_hash','nextAction',"'type'=>'order_chat'",'chatId'])expect(db.includes(t),`exchange server contract missing ${t}`);
expect(db.includes("'actionUrl' => '#/orders/item/'.rawurlencode($orderId)"),'accepted notification must target order');
for(const t of ['service_scope','kareta_master_exchange_offer_ids','kareta_master_exchange_notify_matching_items','master_exchange_notification_receipts','__baseline__','exchange.matching_request.new','chat_id'])expect(dispatch.includes(t),`dispatch R65 missing ${t}`);
for(const t of ['suggestedPrice','suggestedDurationMin','kareta_master_exchange_notify_matching_items'])expect(workApi.includes(t),`workplace API R65 missing ${t}`);
for(const t of ['serviceScope','data-exchange-scope="mine"','Только Мои услуги','data-exchange-request','applyExchangeFocus','data-quick-duration','data-exchange-chat','service_scope'])expect(feed.includes(t),`exchange UI R65 missing ${t}`);
expect(feed.includes('type="text" value="${esc(o.myResponse?.start_time||\'\')}" data-quick-start'),'quick start must be native text input');
for(const t of ['MASTER_EXCHANGE_R65_CONTRACT','data-workplace-exchange-quick','data-workplace-lead-price','data-workplace-lead-start','data-workplace-lead-duration','#/master/exchange?focus='])expect(workplace.includes(t),`workplace R65 missing ${t}`);
for(const t of ['acceptedExchangeNextAction','ЗАЯВКА ПРИНЯТА','Открыть заказ','Перейти в чат','onSuccess:result=>acceptedExchangeNextAction'])expect(orders.includes(t),`client accept UI missing ${t}`);
for(const t of ['.k-exchange-service-scope','.k-exchange-card.is-focused','.k-exchange-quick-response--r65','.k-master-native-lead__quick','.k-client-exchange-next'])expect(css.includes(t),`R65 CSS missing ${t}`);
expect(!css.includes('#k-mobile-nav')&&!css.includes('#k-desktop-nav')&&!css.includes('#k-menu-toggle'),'R65 CSS must not alter Shell');
expect(registry.includes('css/next/master_exchange_acceptance_flow.css'),'R65 stylesheet missing from registry');
expect(asset.includes('r1885625-master-exchange-acceptance-flow')&&sw.includes('r1885625-master-exchange-acceptance-flow'),'R65 release suffix missing from asset/SW');
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`)}
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.65 master exchange acceptance flow + Shell Freeze 2 OK');
