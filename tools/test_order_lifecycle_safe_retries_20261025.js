'use strict';
const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const db=fs.readFileSync(path.join(root,'api/db.php'),'utf8');
const master=fs.readFileSync(path.join(root,'api/master_order_lifecycle.php'),'utf8');

function sourceOf(source,name){
  const start=source.indexOf('function '+name+'(');
  assert(start>=0, 'missing function '+name);
  const end=source.indexOf('\n}\n',start);
  assert(end>start,'missing function end '+name);
  return source.slice(start,end+2);
}
const confirm=sourceOf(db,'orders_confirm_done_by_client');
const complete=sourceOf(db,'orders_complete_by_master');
const accept=sourceOf(master,'kareta_master_order_accept');

assert(confirm.indexOf('if (!$owned)')>=0);
assert(confirm.indexOf('if (!$owned)')<confirm.indexOf("if(function_exists('kareta_client_order_handover_confirm')"),
  'handover must not run before client ownership check');
assert(confirm.indexOf("if(function_exists('kareta_client_order_handover_confirm')")<
       confirm.indexOf("if (!in_array((string)$order['status'], ['done_pending_client']"),
  'native handover remains supported before legacy-status fallback');

assert(complete.includes("if (empty($tx['skipped'])) {\n        try {\n            kareta_notification_insert"),
  'completion notification should be conditional on a new transition');
assert(confirm.includes("if (empty($tx['skipped'])) {\n        try {\n            $mid = (string)($order['master_id'] ?? '');"),
  'confirmation notification should be conditional on a new transition');

assert(complete.includes("if ((string)$order['status'] === 'done_pending_client')"),
  'completion retry should return success after already moving to pending');
assert(complete.indexOf("if ((string)$order['status'] === 'done_pending_client')")<
       complete.indexOf("if (!in_array((string)$order['status'], ['process']"),
  'retry should be accepted before rejecting an invalid master status');
assert(confirm.includes("if ((string)$order['status'] === 'done')"),
  'client retry should return success after completed order');
assert(confirm.indexOf('if (!$owned)')<confirm.indexOf("if ((string)$order['status'] === 'done')"),
  'client ownership must be checked before replying to completed retries');

assert(accept.includes("$firstAcceptance=(string)($workflow['current_stage']??'intake')==='intake'"));
assert(accept.includes("if($firstAcceptance) {\n        kareta_write_event"),
  'acceptance event must not repeat on diagnostics-stage retries');
assert(accept.includes("'idempotent'=>!$firstAcceptance"),
  'response should indicate a repeated acceptance');
assert(accept.includes("kareta_master_order_lifecycle_order($pdo,$orderId,true)"),
  'master order access control must remain enforced');

console.log('PASS: 13 order lifecycle retry/authorization source guards');
// Static contract only. PHP lint, integration and concurrent-request QA remain required.
