'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),fail=[];
const expect=(v,m)=>{if(!v)fail.push(m)};
const config=read('config.php'),migration=read('api/migrations/120_master_capacity_reschedule.php'),db=read('api/db.php'),workApi=read('api/master_workplace.php'),dispatch=read('api/production_dispatch.php');
const workplace=read('js/next/pages/master_workplace.js'),schedule=read('js/next/pages/master_schedule.js'),scheduleApi=read('js/next/work_orders/master_schedule_api.js'),workplaceApi=read('js/next/work_orders/master_workplace_api.js'),orders=read('js/next/pages/orders.js'),ordersApi=read('js/next/orders/orders_api.js');
const css=read('css/next/master_capacity_reschedule.css'),registry=read('inc/asset_registry.php'),asset=read('inc/asset_version.php'),sw=read('sw.js'),manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
const dbv=Number((/define\('KARETA_DB_VERSION',\s*(\d+)\)/.exec(config)||[])[1]||0);expect(dbv===120,'R67 expected DB version 120');
for(const t of ["'version' => 120",'slot_step_min','capacity_warn_pct','master_reschedule_proposals','proposed_start','proposed_end','decision_note'])expect(migration.includes(t),`migration missing ${t}`);
for(const t of ["case 'masterSchedule.freeSlots'","case 'masterSchedule.reschedule.propose'","case 'clientSchedule.reschedule.list'","case 'clientSchedule.reschedule.respond'","'requests.update'"])expect(db.includes(t),`db R67 missing ${t}`);
for(const t of ['kareta_master_schedule_order_duration','service_offers','duration_min','intakeBufferMin','kareta_master_schedule_free_slots_for_order','projectedLoadPct','capacityWarning','kareta_master_schedule_reschedule_propose','status=\'pending\'','kareta_client_schedule_reschedule_respond','client_reschedule_accept','slot_no_longer_available','master_changed','master_reassigned','freeIntervals','latenessMin'])expect(workApi.includes(t),`master schedule R67 missing ${t}`);
expect(workApi.includes("status='declined'")&&workApi.includes("status='accepted'"),'R67 must have explicit client decisions');
expect(dispatch.includes('client_reschedule_accept'),'dispatch must preserve accepted reschedule time');
expect(dispatch.includes('master_reschedule_proposals')&&dispatch.includes('master_reassigned'),'reassignment must cancel stale reschedule proposals');
expect(dispatch.includes("['exchange_accept','master_adjustment']"),'R66 preserved-schedule compatibility marker missing');
for(const t of ['MASTER_CAPACITY_R67_CONTRACT','data-plan-reschedule','apiModule.freeSlots','apiModule.proposeReschedule','Перенос отправлен клиенту на подтверждение'])expect(workplace.includes(t),`workplace R67 missing ${t}`);
for(const t of ['MASTER_CAPACITY_R67_CONTRACT','data-schedule-reschedule','data-schedule-free-slot','Загрузка дня','Свободные окна','slotStepMin','capacityWarnPct','apiModule.proposeReschedule'])expect(schedule.includes(t),`schedule R67 missing ${t}`);
expect(!schedule.includes('<select'),'R67 master schedule should not use select dropdowns');
for(const t of ['masterSchedule.freeSlots','masterSchedule.reschedule.propose'])expect(scheduleApi.includes(t)&&workplaceApi.includes(t),`master API wrapper missing ${t}`);
for(const t of ['rescheduleProposals','respondReschedule','clientSchedule.reschedule.list','clientSchedule.reschedule.respond'])expect(ordersApi.includes(t),`orders API R67 missing ${t}`);
for(const t of ['R67_CLIENT_RESCHEDULE_CONTRACT','clientReschedulePanel','data-client-reschedule-accept','data-client-reschedule-decline','loadReschedules','Новое время подтверждено','Текущее время сохранено'])expect(orders.includes(t),`client UI R67 missing ${t}`);
for(const t of ['.k-schedule-capacity','.k-master-r67-reschedule','.k-master-r67-free-slot','.k-client-r67-reschedule'])expect(css.includes(t),`R67 CSS missing ${t}`);
expect(!css.includes('#k-mobile-nav')&&!css.includes('#k-desktop-nav')&&!css.includes('#k-menu-toggle'),'R67 CSS must not alter Shell');
expect(registry.includes('css/next/master_capacity_reschedule.css'),'R67 stylesheet missing from registry');
expect(asset.includes('r1885627-master-capacity-reschedule')&&sw.includes('r1885627-master-capacity-reschedule'),'R67 release suffix missing');
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`)}
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.67 master capacity + client-confirmed reschedule + Shell Freeze 2 OK');
