'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),fail=[];
const expect=(v,m)=>{if(!v)fail.push(m)};
const config=read('config.php'),migration=read('api/migrations/119_master_order_communication_scheduling.php'),db=read('api/db.php'),workApi=read('api/master_workplace.php'),dispatch=read('api/production_dispatch.php');
const workplace=read('js/next/pages/master_workplace.js'),workplaceApi=read('js/next/work_orders/master_workplace_api.js'),ordersApi=read('js/next/orders/orders_api.js'),orders=read('js/next/pages/orders.js'),schedule=read('js/next/pages/master_schedule.js'),cabinet=read('js/next/pages/cabinet.js');
const css=read('css/next/master_order_communication_scheduling.css'),registry=read('inc/asset_registry.php'),asset=read('inc/asset_version.php'),sw=read('sw.js'),manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
const dbv=Number((/KARETA_DB_VERSION',\s*(\d+)/.exec(config)||[])[1]||0);expect(dbv===119,'R66 expected DB version 119');
for(const t of ["'version' => 119",'accepted_at','response_sla_min','source','conflict_override'])expect(migration.includes(t),`migration missing ${t}`);
for(const t of ["case 'clientExchange.schedulePreview'","case 'masterSchedule.orderPlan.save'",'confirmScheduleConflict','schedule_conflict','accepted_at=COALESCE','kareta_master_schedule_apply_exchange_plan','schedulePreview'])expect(db.includes(t),`db R66 missing ${t}`);
for(const t of ['kareta_master_schedule_conflicts','FOR UPDATE','kareta_master_schedule_exchange_preview','kareta_master_schedule_write_system_message','INSERT IGNORE','master_adjustment','newAccepted','replySlaMin','replyState','plannedStart'])expect(workApi.includes(t),`workplace API R66 missing ${t}`);
for(const t of ["['exchange_accept','master_adjustment']",'preservedSchedule','sto_bay_assignments','planned_start<? AND planned_end>?'])expect(dispatch.includes(t),`dispatch R66 missing ${t}`);
for(const t of ['MASTER_SCHEDULING_R66_CONTRACT','Новые принятые','data-master-plan-open','data-master-plan-force','saveOrderPlan','replyState','scheduleDialog'])expect(workplace.includes(t),`workplace UI R66 missing ${t}`);
expect(workplaceApi.includes("masterSchedule.orderPlan.save"),'master workplace API must save order plan');
for(const t of ['previewExchangeSchedule','clientExchange.schedulePreview','confirmScheduleConflict'])expect(ordersApi.includes(t),`orders api R66 missing ${t}`);
for(const t of ['acceptConfirmDialog(orderId,responseId,schedulePreview={})','Есть пересечение в расписании','data-schedule-conflict','previewExchangeSchedule','КОНФЛИКТ ВРЕМЕНИ'])expect(orders.includes(t),`client accept UI R66 missing ${t}`);
for(const t of ['responseSla','responseSlaMin'])expect(schedule.includes(t),`schedule SLA UI missing ${t}`);
for(const t of ['newAccepted','Новые принятые'])expect(cabinet.includes(t),`workplace settings R66 missing ${t}`);
for(const t of ['.k-master-r66-accepted-section','.k-master-r66-sla','.k-master-r66-conflict','.k-client-r66-schedule'])expect(css.includes(t),`R66 CSS missing ${t}`);
expect(!css.includes('#k-mobile-nav')&&!css.includes('#k-desktop-nav')&&!css.includes('#k-menu-toggle'),'R66 CSS must not alter Shell');
expect(registry.includes('css/next/master_order_communication_scheduling.css'),'R66 stylesheet missing from registry');
expect(asset.includes('r1885626-master-order-communication-scheduling')&&sw.includes('r1885626-master-order-communication-scheduling'),'R66 release suffix missing');
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`)}
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.66 master order communication scheduling + Shell Freeze 2 OK');
