'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),fail=[];
const expect=(v,m)=>{if(!v)fail.push(m)};
const config=read('config.php'),migration=read('api/migrations/124_master_day_operations_auto_recovery.php'),ops=read('api/master_day_operations.php'),workplace=read('api/master_workplace.php'),shift=read('api/master_shift_arrival.php'),db=read('api/db.php');
const js=read('js/next/pages/master_schedule.js'),api=read('js/next/work_orders/master_schedule_api.js'),css=read('css/next/master_day_operations_auto_recovery.css'),registry=read('inc/asset_registry.php'),asset=read('inc/asset_version.php'),sw=read('sw.js'),manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
const dbv=Number((/define\('KARETA_DB_VERSION',\s*(\d+)\)/.exec(config)||[])[1]||0);expect(dbv===124,'R70 expected DB version 124');
for(const t of ["'version'=>124",'auto_recovery_enabled','auto_notify_enabled','auto_recovery_horizon_days','auto_recovery_grace_min','master_shift_extensions','master_schedule_recovery_events'])expect(migration.includes(t),`migration missing ${t}`);
for(const t of ['kareta_master_schedule_auto_recover','kareta_master_schedule_delay_recover','kareta_master_day_ops_notify_move','order.schedule.auto_rescheduled','schedule_auto_recovered','source=\'auto_recovery\'','kareta_tariff_master_intake_guard','if($validation[\'valid\'])continue','kareta_master_shift_extension_save','kareta_master_shift_extension_delete'])expect(ops.includes(t),`auto recovery engine missing ${t}`);
for(const t of ["'weekly_shift_changed'","'schedule_block_added'","'schedule_block_removed'"])expect(shift.includes(t),`shift recovery trigger missing ${t}`);
for(const t of ["'extra_booking'",'autoRecoveryEnabled','autoNotifyEnabled','autoRecoveryHorizonDays','autoRecoveryGraceMin','kareta_master_shift_extension_for_date'])expect(workplace.includes(t),`workplace R70 integration missing ${t}`);
for(const t of ["'date_schedule_changed'",'masterSchedule.recovery.run','masterShift.extension.save','masterShift.extension.delete'])expect(db.includes(t),`DB R70 route/trigger missing ${t}`);
for(const t of ['MASTER_DAY_OPS_R70_CONTRACT','Автоуведомления и автоперенос','Оперативная лента дня','data-run-recovery','data-shift-extension-save','autoRecoveryEnabled','autoNotifyEnabled','triggerType:\'delay_scan\'','setInterval(scanDelay,60000)','data-arrival-countdown'])expect(js.includes(t),`R70 UI missing ${t}`);
for(const t of ['runRecovery','saveExtension','deleteExtension'])expect(api.includes(t),`R70 schedule API missing ${t}`);
for(const t of ['.k-master-r70-recovery','.k-master-r70-timeline','.k-master-r70-extension','.k-master-r70-toggle'])expect(css.includes(t),`R70 CSS missing ${t}`);
expect(!css.includes('#k-mobile-nav')&&!css.includes('#k-desktop-nav')&&!css.includes('#k-menu-toggle'),'R70 CSS must not alter Shell');
expect(registry.includes('css/next/master_day_operations_auto_recovery.css'),'R70 stylesheet missing from registry');
expect(asset.includes('r1885630-master-day-operations-auto-recovery')&&sw.includes('r1885630-master-day-operations-auto-recovery'),'R70 release suffix missing');
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`)}
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.70 master day operations + auto recovery + Shell Freeze 2 OK');
