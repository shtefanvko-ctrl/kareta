'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),fail=[];
const expect=(v,m)=>{if(!v)fail.push(m)};
const config=read('config.php'),migration=read('api/migrations/122_master_shift_breaks_arrival.php'),arrival=read('api/master_shift_arrival.php'),schedule=read('api/master_workplace.php'),db=read('api/db.php');
const scheduleJs=read('js/next/pages/master_schedule.js'),ordersJs=read('js/next/pages/orders.js'),scheduleApi=read('js/next/work_orders/master_schedule_api.js'),ordersApi=read('js/next/orders/orders_api.js'),css=read('css/next/master_shift_breaks_arrival.css'),registry=read('inc/asset_registry.php'),asset=read('inc/asset_version.php'),sw=read('sw.js'),manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
const dbv=Number((/define\('KARETA_DB_VERSION',\s*(\d+)\)/.exec(config)||[])[1]||0);expect(dbv===122,'R69 expected DB version 122');
for(const t of ["'version'=>122",'master_weekly_shifts','master_schedule_blocks','order_arrival_states','block_type','eta_minutes','no_show_at'])expect(migration.includes(t),`migration missing ${t}`);
for(const t of ['kareta_master_weekly_shift_rows','kareta_master_weekly_shift_for_date','kareta_master_schedule_blocks_for_date','kareta_master_schedule_blocked_minutes','kareta_master_weekly_shift_save','kareta_master_schedule_block_save','kareta_client_arrival_set','kareta_master_arrival_set','status=\'no_show\''])expect(arrival.includes(t),`arrival engine missing ${t}`);
for(const t of ['kareta_master_weekly_shift_for_date','kareta_master_schedule_blocked_intervals','blockedMinutes',"status NOT IN ('done','completed','cancelled','closed','no_show')",'delayImpact','weekForecast','order_arrival_states'])expect(schedule.includes(t),`schedule integration missing ${t}`);
for(const t of ['masterShift.weekly.save','masterSchedule.block.save','masterSchedule.block.delete','masterSchedule.arrival.set','clientSchedule.arrival.list','clientSchedule.arrival.set'])expect(db.includes(t),`db route missing ${t}`);
for(const t of ['MASTER_SHIFT_R69_CONTRACT','Шаблон недели','Мои смены','ПЕРЕРЫВЫ И БЛОКИРОВКИ','ПРИЕЗД КЛИЕНТА','Не приехал','РИСК СДВИГА','Прогноз загрузки','data-block-open','data-master-arrival'])expect(scheduleJs.includes(t),`master schedule UI missing ${t}`);
for(const t of ['saveWeekly','saveBlock','deleteBlock','setArrival'])expect(scheduleApi.includes(t),`schedule api missing ${t}`);
for(const t of ['R69_CLIENT_ARRIVAL_CONTRACT','clientArrivalPanel','ПРИЕЗД НА ЗАПИСЬ','Еду','Прибыл','Опаздываю','data-client-arrival-status'])expect(ordersJs.includes(t),`client arrival UI missing ${t}`);
for(const t of ['arrivalStates','setArrival','clientSchedule.arrival.list','clientSchedule.arrival.set'])expect(ordersApi.includes(t),`orders api missing ${t}`);
for(const t of ['.k-master-r69-forecast','.k-master-r69-weekly','.k-master-r69-blocks','.k-master-r69-arrival','.k-master-r69-delay','.k-client-r69-arrival'])expect(css.includes(t),`R69 CSS missing ${t}`);
expect(!css.includes('#k-mobile-nav')&&!css.includes('#k-desktop-nav')&&!css.includes('#k-menu-toggle'),'R69 CSS must not alter Shell');
expect(registry.includes('css/next/master_shift_breaks_arrival.css'),'R69 stylesheet missing from registry');
expect(asset.includes('r1885629-master-shift-breaks-arrival')&&sw.includes('r1885629-master-shift-breaks-arrival'),'R69 release suffix missing');
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`)}
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.69 master shifts + breaks + arrival + Shell Freeze 2 OK');
