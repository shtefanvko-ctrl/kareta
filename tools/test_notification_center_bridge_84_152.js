'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const db=read('api/db.php');
const domain=read('api/domain.php');
const backfill=read('tools/backfill_notification_center_from_legacy.php');

const fnStart=db.indexOf('function kareta_notification_insert');
const fnEnd=db.indexOf('\nfunction ',fnStart+20);
const fn=db.slice(fnStart,fnEnd>0?fnEnd:fnStart+16000);

assert(fnStart>=0,'kareta_notification_insert missing');
assert(fn.includes("$notificationId=(int)$pdo->lastInsertId();"),'legacy notification id must be captured');
assert(fn.indexOf("$notificationId=(int)$pdo->lastInsertId();") < fn.indexOf('INSERT INTO notification_center'),'legacy id must be captured before center mirror insert');
assert(fn.includes("'source'=>'legacy_notifications'"),'notification center mirror source marker missing');
assert(fn.includes("'legacyNotificationId'=>$notificationId"),'legacy notification id link missing');
assert(fn.includes("$notificationKey='legacy:'.$notificationId.':user:'.$centerUserId;"),'stable notification bridge key missing');
assert(fn.includes("kareta_messaging_enqueue_notification($pdo,$notificationId,$row)"),'messaging must keep legacy notification id');
assert(fn.includes("eventType !== 'message.new'"),'message.new duplicate external fan-out guard missing');

assert(domain.includes("SELECT payload_json FROM notification_center WHERE id=? AND user_id=? LIMIT 1"),'canonical read ownership lookup missing');
assert(domain.includes("$legacyNotificationId=(int)($payload['legacyNotificationId']??0);"),'canonical-to-legacy read sync id missing');
assert(domain.includes("UPDATE notifications SET is_read=1,read_at=COALESCE(read_at,NOW()) WHERE id=?"),'single read legacy sync missing');
assert(domain.includes("UPDATE notification_center SET status='read',read_at=COALESCE(read_at,NOW()) WHERE user_id=? AND status<>'read'"),'canonical readAll missing');
assert(domain.includes("recipient_user_id=?"),'legacy readAll user sync missing');

assert(backfill.includes("$apply=in_array('--apply',$argv,true);"),'backfill must default to dry-run');
assert(backfill.includes("'mode'=>$apply?'APPLY':'DRY_RUN'"),'backfill mode report missing');
assert(backfill.includes("'unresolvedRoleOnly'"),'role-only ambiguity must be reported');
assert(backfill.includes("'legacy:'.$legacyId.':user:'.$userId"),'backfill stable key mismatch');

console.log('NOTIFICATION_CENTER_BRIDGE_84_152: PASS');
