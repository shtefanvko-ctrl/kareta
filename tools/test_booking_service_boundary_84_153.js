'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const fail=[];
const expect=(ok,msg)=>{if(!ok)fail.push(msg);};

const workOrders=read('api/work_orders.php');
const masterDay=read('api/master_day_operations.php');
const masterWorkplace=read('api/master_workplace.php');
const recoveryControl=read('api/master_recovery_control.php');
const db=read('api/db.php');

expect(workOrders.includes('function kareta_service_order_schedule_projection_update'),'Service schedule projection contract missing');
expect(workOrders.includes('service_schedule_non_service_order'),'Service schedule contract must reject parts_request');
expect(workOrders.includes('UPDATE orders SET \`date\`=?,\`time\`=?'),'Service contract must remain the owner of legacy schedule projection writes');
expect(!workOrders.includes('beginTransaction()') || workOrders.indexOf('function kareta_service_order_schedule_projection_update')>workOrders.lastIndexOf('beginTransaction()'),'Service schedule helper must not own caller transaction boundaries');

const bookingFiles=[
  ['api/master_day_operations.php',masterDay],
  ['api/master_workplace.php',masterWorkplace],
  ['api/master_recovery_control.php',recoveryControl],
];

for(const [file,content] of bookingFiles){
  expect(!/UPDATE\s+\`?orders\`?\s+SET\s+(?:\`?date\`?|date)\s*=\s*\?/i.test(content),file+' must not directly mutate Service orders.date');
}

expect((masterDay.match(/kareta_service_order_schedule_projection_update\(/g)||[]).length===2,'auto recovery must use Service schedule contract twice');
expect((masterWorkplace.match(/kareta_service_order_schedule_projection_update\(/g)||[]).length===2,'manual/order-plan + client-reschedule paths must use Service schedule contract twice');
expect((recoveryControl.match(/kareta_service_order_schedule_projection_update\(/g)||[]).length===1,'recovery control must use Service schedule contract once');

const workOrdersLoad=db.indexOf("require_once __DIR__ . '/work_orders.php';");
const workplaceLoad=db.indexOf("require_once __DIR__ . '/master_workplace.php';");
const dayLoad=db.indexOf("require_once __DIR__ . '/master_day_operations.php';");
const recoveryLoad=db.indexOf("require_once __DIR__ . '/master_recovery_control.php';");
expect(workOrdersLoad>=0,'work_orders module must be loaded');
expect(workOrdersLoad<workplaceLoad && workOrdersLoad<dayLoad && workOrdersLoad<recoveryLoad,'Service schedule contract must load before Booking/Master callers');

expect(masterDay.includes("'schedule_auto_recovered'"),'auto-recovery event contract must survive boundary refactor');
expect(masterWorkplace.includes("'reschedule_accepted'"),'client reschedule event contract must survive boundary refactor');
expect(recoveryControl.includes("'schedule_recovery_control_applied'"),'recovery-control event contract must survive boundary refactor');

if(fail.length){
  console.error(fail.join('\n'));
  process.exit(1);
}
console.log('BOOKING_SERVICE_BOUNDARY_84_153: PASS');
