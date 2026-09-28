<?php
declare(strict_types=1);

function kareta_master_weekly_shift_rows(PDO $pdo,string $masterId): array {
    $out=[];
    if(kareta_table_exists($pdo,'master_weekly_shifts')){
        $q=$pdo->prepare("SELECT weekday,start_time,end_time,is_day_off,note FROM master_weekly_shifts WHERE BINARY master_id=BINARY ? ORDER BY weekday");
        $q->execute([$masterId]);
        foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $row){
            $weekday=max(1,min(7,(int)($row['weekday']??1)));
            $out[$weekday]=['weekday'=>$weekday,'startTime'=>substr((string)($row['start_time']??'09:00'),0,5),'endTime'=>substr((string)($row['end_time']??'18:00'),0,5),'isDayOff'=>!empty($row['is_day_off']),'note'=>(string)($row['note']??'')];
        }
    }
    for($weekday=1;$weekday<=7;$weekday++)if(!isset($out[$weekday]))$out[$weekday]=['weekday'=>$weekday,'startTime'=>'09:00','endTime'=>'18:00','isDayOff'=>false,'note'=>''];
    ksort($out);return array_values($out);
}
function kareta_master_weekly_shift_for_date(PDO $pdo,string $masterId,string $date): array {
    try{$weekday=(int)(new DateTimeImmutable($date))->format('N');}catch(Throwable $_){$weekday=(int)date('N');}
    foreach(kareta_master_weekly_shift_rows($pdo,$masterId) as $row)if((int)$row['weekday']===$weekday)return $row;
    return ['weekday'=>$weekday,'startTime'=>'09:00','endTime'=>'18:00','isDayOff'=>false,'note'=>''];
}
function kareta_master_schedule_blocks_for_date(PDO $pdo,string $masterId,string $date,bool $activeOnly=true): array {
    if(!kareta_table_exists($pdo,'master_schedule_blocks'))return [];
    $sql="SELECT id,block_date,start_time,end_time,block_type,note,active FROM master_schedule_blocks WHERE BINARY master_id=BINARY ? AND block_date=?".($activeOnly?" AND active=1":"")." ORDER BY start_time,end_time";
    $q=$pdo->prepare($sql);$q->execute([$masterId,$date]);$out=[];
    foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $row){
        $out[]=['id'=>(string)$row['id'],'date'=>(string)$row['block_date'],'startTime'=>substr((string)$row['start_time'],0,5),'endTime'=>substr((string)$row['end_time'],0,5),'type'=>(string)$row['block_type'],'note'=>(string)$row['note'],'active'=>!empty($row['active'])];
    }
    return $out;
}
function kareta_master_shift_block_type_label(string $type): string {
    return ['lunch'=>'Обед','technical'=>'Технический перерыв','personal'=>'Личная блокировка','meeting'=>'Встреча'][strtolower($type)]??'Перерыв';
}
function kareta_master_schedule_blocked_intervals(PDO $pdo,string $masterId,string $date): array {
    $out=[];foreach(kareta_master_schedule_blocks_for_date($pdo,$masterId,$date,true) as $row){try{$start=new DateTimeImmutable($date.' '.$row['startTime']);$end=new DateTimeImmutable($date.' '.$row['endTime']);if($end>$start)$out[]=['type'=>'block','blockId'=>$row['id'],'title'=>kareta_master_shift_block_type_label($row['type']).($row['note']!==''?' · '.$row['note']:''),'start'=>$start,'end'=>$end,'blockType'=>$row['type']];}catch(Throwable $_){}}
    return $out;
}
function kareta_master_shift_merge_intervals(array $rows,?DateTimeImmutable $clipStart=null,?DateTimeImmutable $clipEnd=null): array {
    $items=[];foreach($rows as $row){$start=$row['start']??null;$end=$row['end']??null;if(!$start instanceof DateTimeImmutable||!$end instanceof DateTimeImmutable)continue;if($clipStart&&$start<$clipStart)$start=$clipStart;if($clipEnd&&$end>$clipEnd)$end=$clipEnd;if($end>$start)$items[]=['start'=>$start,'end'=>$end];}
    usort($items,static fn($a,$b)=>$a['start']<=>$b['start']);$merged=[];foreach($items as $item){$last=count($merged)-1;if($last>=0&&$item['start']<=$merged[$last]['end']){if($item['end']>$merged[$last]['end'])$merged[$last]['end']=$item['end'];}else $merged[]=$item;}return $merged;
}
function kareta_master_schedule_blocked_minutes(PDO $pdo,string $masterId,string $date,DateTimeImmutable $from,DateTimeImmutable $to): int {
    $sum=0;foreach(kareta_master_shift_merge_intervals(kareta_master_schedule_blocked_intervals($pdo,$masterId,$date),$from,$to) as $row)$sum+=(int)(($row['end']->getTimestamp()-$row['start']->getTimestamp())/60);return max(0,$sum);
}
function kareta_master_weekly_shift_save(PDO $pdo,array $body): void {
    if(!kareta_table_exists($pdo,'master_weekly_shifts'))kareta_json(['ok'=>false,'error'=>'migration_required','message'=>'Требуется миграция БД 122.'],503);
    $master=kareta_master_workplace_profile($pdo);$masterId=(string)$master['id'];$days=is_array($body['days']??null)?$body['days']:[];if(!$days)kareta_json(['ok'=>false,'error'=>'days_required'],422);
    $save=$pdo->prepare("INSERT INTO master_weekly_shifts(master_id,weekday,start_time,end_time,is_day_off,note) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE start_time=VALUES(start_time),end_time=VALUES(end_time),is_day_off=VALUES(is_day_off),note=VALUES(note),updated_at=CURRENT_TIMESTAMP");
    try{$pdo->beginTransaction();foreach($days as $row){if(!is_array($row))continue;$weekday=max(1,min(7,(int)($row['weekday']??0)));$dayOff=!empty($row['isDayOff']);$start=trim((string)($row['startTime']??'09:00'));$end=trim((string)($row['endTime']??'18:00'));$note=mb_substr(trim((string)($row['note']??'')),0,191);if(!preg_match('/^\d{2}:\d{2}$/',$start)||!preg_match('/^\d{2}:\d{2}$/',$end))throw new RuntimeException('Некорректное время недельного графика.');if(!$dayOff&&$end<=$start)throw new RuntimeException('Конец смены должен быть позже начала.');$save->execute([$masterId,$weekday,$start,$end,$dayOff?1:0,$note]);}$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'weekly_shift_save_failed','message'=>$e->getMessage()],422);}
    $recovery=function_exists('kareta_master_schedule_auto_recover')?kareta_master_schedule_auto_recover($pdo,$masterId,'weekly_shift_changed','','',false):[];
    kareta_json(['ok'=>true,'weekly'=>kareta_master_weekly_shift_rows($pdo,$masterId),'recovery'=>$recovery]);
}
function kareta_master_schedule_block_save(PDO $pdo,array $body): void {
    if(!kareta_table_exists($pdo,'master_schedule_blocks'))kareta_json(['ok'=>false,'error'=>'migration_required','message'=>'Требуется миграция БД 122.'],503);
    $master=kareta_master_workplace_profile($pdo);$masterId=(string)$master['id'];$id=trim((string)($body['id']??''));$date=trim((string)($body['date']??''));$start=trim((string)($body['startTime']??''));$end=trim((string)($body['endTime']??''));$type=strtolower(trim((string)($body['type']??'technical')));$note=mb_substr(trim((string)($body['note']??'')),0,191);
    if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date)||!preg_match('/^\d{2}:\d{2}$/',$start)||!preg_match('/^\d{2}:\d{2}$/',$end)||$end<=$start)kareta_json(['ok'=>false,'error'=>'invalid_block_interval','message'=>'Укажите корректный интервал перерыва.'],422);if(!in_array($type,['lunch','technical','personal','meeting'],true))$type='technical';
    $from=new DateTimeImmutable($date.' '.$start);$to=new DateTimeImmutable($date.' '.$end);$bounds=kareta_master_schedule_day_bounds($pdo,$masterId,$date);if($bounds['isDayOff'])kareta_json(['ok'=>false,'error'=>'day_off','message'=>'В выходной день отдельный перерыв не требуется.'],409);if($from<$bounds['start']||$to>$bounds['end'])kareta_json(['ok'=>false,'error'=>'outside_shift','message'=>'Перерыв должен находиться внутри рабочей смены.'],409);
    $id=$id!==''?$id:'msb_'.substr(hash('sha256',$masterId.'|'.$date.'|'.$start.'|'.$end.'|'.microtime(true)),0,24);$uid=(int)(kareta_session_user()['id']??0)?:null;
    $q=$pdo->prepare("INSERT INTO master_schedule_blocks(id,master_id,block_date,start_time,end_time,block_type,note,active,created_by_user_id) VALUES(?,?,?,?,?,?,?,1,?) ON DUPLICATE KEY UPDATE block_date=VALUES(block_date),start_time=VALUES(start_time),end_time=VALUES(end_time),block_type=VALUES(block_type),note=VALUES(note),active=1,updated_at=CURRENT_TIMESTAMP");$q->execute([$id,$masterId,$date,$start,$end,$type,$note,$uid]);
    $recovery=function_exists('kareta_master_schedule_auto_recover')?kareta_master_schedule_auto_recover($pdo,$masterId,'schedule_block_added',$date,'',false):[];
    kareta_json(['ok'=>true,'block'=>['id'=>$id,'date'=>$date,'startTime'=>$start,'endTime'=>$end,'type'=>$type,'note'=>$note],'recovery'=>$recovery]);
}
function kareta_master_schedule_block_delete(PDO $pdo,array $body): void {
    $master=kareta_master_workplace_profile($pdo);$masterId=(string)$master['id'];$id=trim((string)($body['id']??''));if($id==='')kareta_json(['ok'=>false,'error'=>'id_required'],422);$d=$pdo->prepare("SELECT block_date FROM master_schedule_blocks WHERE BINARY id=BINARY ? AND BINARY master_id=BINARY ? LIMIT 1");$d->execute([$id,$masterId]);$date=(string)($d->fetchColumn()?:'');$q=$pdo->prepare("UPDATE master_schedule_blocks SET active=0,updated_at=CURRENT_TIMESTAMP WHERE BINARY id=BINARY ? AND BINARY master_id=BINARY ?");$q->execute([$id,$masterId]);if($q->rowCount()<=0)kareta_json(['ok'=>false,'error'=>'block_not_found'],404);$recovery=function_exists('kareta_master_schedule_auto_recover')?kareta_master_schedule_auto_recover($pdo,$masterId,'schedule_block_removed',$date,'',false):[];kareta_json(['ok'=>true,'id'=>$id,'recovery'=>$recovery]);
}
function kareta_arrival_order_for_client(PDO $pdo,string $orderId): array {
    $user=kareta_session_user();$uid=(int)($user['id']??0);$phone=kareta_normalize_phone((string)($user['phone']??''));$q=$pdo->prepare("SELECT o.*,(SELECT c.id FROM chats c WHERE BINARY c.order_id=BINARY o.id ORDER BY c.created_at DESC LIMIT 1) chat_id FROM orders o WHERE BINARY o.id=BINARY ? AND (o.client_user_id=? OR (?<>'' AND o.client_phone=?)) LIMIT 1");$q->execute([$orderId,$uid?:-1,$phone,$phone]);return $q->fetch(PDO::FETCH_ASSOC)?:[];
}
function kareta_arrival_order_for_master(PDO $pdo,string $orderId): array {
    $master=kareta_master_workplace_profile($pdo);$mid=(string)$master['id'];$uid=(int)($master['user_id']??0);$q=$pdo->prepare("SELECT o.*,(SELECT c.id FROM chats c WHERE BINARY c.order_id=BINARY o.id ORDER BY c.created_at DESC LIMIT 1) chat_id FROM orders o WHERE BINARY o.id=BINARY ? AND (BINARY o.master_id=BINARY ? OR (COALESCE(o.master_id,'')='' AND o.master_user_id=?)) LIMIT 1");$q->execute([$orderId,$mid,$uid?:-1]);$order=$q->fetch(PDO::FETCH_ASSOC)?:[];if($order)$order['_resolved_master_id']=$mid;return $order;
}
function kareta_arrival_state_row(PDO $pdo,string $orderId): array {
    if(!kareta_table_exists($pdo,'order_arrival_states'))return [];$q=$pdo->prepare("SELECT * FROM order_arrival_states WHERE BINARY order_id=BINARY ? LIMIT 1");$q->execute([$orderId]);$r=$q->fetch(PDO::FETCH_ASSOC)?:[];if(!$r)return [];return ['orderId'=>(string)$r['order_id'],'status'=>(string)$r['status'],'etaMinutes'=>(int)$r['eta_minutes'],'etaAt'=>(string)($r['eta_at']??''),'arrivedAt'=>(string)($r['arrived_at']??''),'noShowAt'=>(string)($r['no_show_at']??''),'source'=>(string)$r['source'],'note'=>(string)$r['note'],'updatedAt'=>(string)$r['updated_at']];
}
function kareta_arrival_notify(PDO $pdo,array $order,string $status,int $etaMinutes,string $source,string $note=''): void {
    $orderId=(string)($order['id']??'');$chatId=(string)($order['chat_id']??'');$clientUid=(int)($order['client_user_id']??0);$masterId=(string)($order['master_id']??$order['_resolved_master_id']??'');$masterUid=0;if($masterId!==''&&kareta_table_exists($pdo,'masters')){$q=$pdo->prepare("SELECT user_id FROM masters WHERE BINARY id=BINARY ? LIMIT 1");$q->execute([$masterId]);$masterUid=(int)$q->fetchColumn();}
    $labels=['on_way'=>'Клиент сообщил: еду','arrived'=>'Клиент прибыл','late'=>'Клиент опаздывает','no_show'=>'Клиент не приехал'];$text=$labels[$status]??'Статус прибытия обновлён';if($etaMinutes>0&&in_array($status,['on_way','late'],true))$text.=' · ориентировочно через '.$etaMinutes.' мин.';if($note!=='')$text.=' · '.$note;
    if(function_exists('kareta_master_schedule_write_system_message'))kareta_master_schedule_write_system_message($pdo,$orderId,$chatId,$text,'arrival|'.$status.'|'.date('YmdHi').'|'.$etaMinutes);
    try{if($source==='client'&&$masterUid>0)kareta_notification_insert($pdo,['recipientUserId'=>$masterUid,'recipientRole'=>'master','eventType'=>'order.arrival.'.$status,'entityType'=>'order','entityId'=>$orderId,'title'=>$labels[$status]??'Статус клиента','body'=>$etaMinutes>0?'Ожидаем через '.$etaMinutes.' мин.':'Заказ '.$orderId,'actionUrl'=>'#/master/schedule','meta'=>['orderId'=>$orderId,'status'=>$status,'etaMinutes'=>$etaMinutes,'chatId'=>$chatId]]);elseif($source==='master'&&$clientUid>0)kareta_notification_insert($pdo,['recipientUserId'=>$clientUid,'recipientPhone'=>(string)($order['client_phone']??''),'recipientRole'=>'client','eventType'=>'order.arrival.'.$status,'entityType'=>'order','entityId'=>$orderId,'title'=>$labels[$status]??'Статус записи','body'=>$status==='no_show'?'Окно записи освобождено. Свяжитесь с Мастером для нового времени.':'Статус записи обновлён.','actionUrl'=>'#/orders/item/'.rawurlencode($orderId),'meta'=>['orderId'=>$orderId,'status'=>$status,'chatId'=>$chatId]]);}catch(Throwable $_){}
    try{kareta_write_event($pdo,$orderId,'arrival_'.$status,['source'=>$source,'etaMinutes'=>$etaMinutes,'note'=>$note]);}catch(Throwable $_){}
}
function kareta_arrival_upsert(PDO $pdo,array $order,string $status,int $etaMinutes,string $source,string $note=''): array {
    $orderId=(string)$order['id'];$clientUid=(int)($order['client_user_id']??0)?:null;$masterId=(string)($order['master_id']??$order['_resolved_master_id']??'');$uid=(int)(kareta_session_user()['id']??0)?:null;$etaAt=in_array($status,['on_way','late'],true)&&$etaMinutes>0?date('Y-m-d H:i:s',time()+$etaMinutes*60):null;$arrivedAt=$status==='arrived'?date('Y-m-d H:i:s'):null;$noShowAt=$status==='no_show'?date('Y-m-d H:i:s'):null;
    $q=$pdo->prepare("INSERT INTO order_arrival_states(order_id,client_user_id,master_id,status,eta_minutes,eta_at,arrived_at,no_show_at,source,note,updated_by_user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE client_user_id=VALUES(client_user_id),master_id=VALUES(master_id),status=VALUES(status),eta_minutes=VALUES(eta_minutes),eta_at=VALUES(eta_at),arrived_at=IF(VALUES(arrived_at) IS NULL,arrived_at,VALUES(arrived_at)),no_show_at=IF(VALUES(no_show_at) IS NULL,no_show_at,VALUES(no_show_at)),source=VALUES(source),note=VALUES(note),updated_by_user_id=VALUES(updated_by_user_id),updated_at=CURRENT_TIMESTAMP");$q->execute([$orderId,$clientUid,$masterId,$status,$etaMinutes,$etaAt,$arrivedAt,$noShowAt,$source,$note,$uid]);
    if($status==='no_show'&&kareta_table_exists($pdo,'master_order_plans'))$pdo->prepare("UPDATE master_order_plans SET status='no_show',updated_at=CURRENT_TIMESTAMP WHERE BINARY order_id=BINARY ?")->execute([$orderId]);
    kareta_arrival_notify($pdo,$order,$status,$etaMinutes,$source,$note);return kareta_arrival_state_row($pdo,$orderId);
}
function kareta_client_arrival_list(PDO $pdo): void {
    $user=kareta_session_user();$uid=(int)($user['id']??0);$phone=kareta_normalize_phone((string)($user['phone']??''));$q=$pdo->prepare("SELECT o.id,o.master_id,o.date,o.time,p.planned_start,p.planned_end,a.status,a.eta_minutes,a.eta_at,a.arrived_at,a.no_show_at,a.source,a.note,a.updated_at FROM orders o LEFT JOIN master_order_plans p ON BINARY p.order_id=BINARY o.id LEFT JOIN order_arrival_states a ON BINARY a.order_id=BINARY o.id WHERE (o.client_user_id=? OR (?<>'' AND o.client_phone=?)) AND COALESCE(o.master_id,'')<>'' AND LOWER(o.status) NOT IN ('completed','done','delivered','closed','cancelled') ORDER BY COALESCE(p.planned_start,CONCAT(o.date,' ',o.time)) DESC LIMIT 100");$q->execute([$uid?:-1,$phone,$phone]);$states=[];foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r){$states[]=['orderId'=>(string)$r['id'],'masterId'=>(string)$r['master_id'],'plannedStart'=>(string)($r['planned_start']??trim((string)$r['date'].' '.(string)$r['time'])),'plannedEnd'=>(string)($r['planned_end']??''),'status'=>(string)($r['status']??''),'etaMinutes'=>(int)($r['eta_minutes']??0),'etaAt'=>(string)($r['eta_at']??''),'arrivedAt'=>(string)($r['arrived_at']??''),'noShowAt'=>(string)($r['no_show_at']??''),'source'=>(string)($r['source']??''),'note'=>(string)($r['note']??''),'updatedAt'=>(string)($r['updated_at']??'')];}kareta_json(['ok'=>true,'states'=>$states]);
}
function kareta_client_arrival_set(PDO $pdo,array $body): void {
    if(!kareta_table_exists($pdo,'order_arrival_states'))kareta_json(['ok'=>false,'error'=>'migration_required','message'=>'Требуется миграция БД 122.'],503);$orderId=trim((string)($body['orderId']??''));$status=strtolower(trim((string)($body['status']??'')));$eta=max(0,min(360,(int)($body['etaMinutes']??0)));$note=mb_substr(trim((string)($body['note']??'')),0,255);if($orderId===''||!in_array($status,['on_way','arrived','late'],true))kareta_json(['ok'=>false,'error'=>'invalid_arrival_status'],422);$order=kareta_arrival_order_for_client($pdo,$orderId);if(!$order)kareta_json(['ok'=>false,'error'=>'order_not_found'],404);if((string)($order['master_id']??'')==='')kareta_json(['ok'=>false,'error'=>'master_not_assigned','message'=>'Сначала должен быть назначен Мастер.'],409);$existing=kareta_arrival_state_row($pdo,$orderId);if(($existing['status']??'')==='no_show')kareta_json(['ok'=>false,'error'=>'no_show_already_recorded','message'=>'Мастер уже отметил неявку. Согласуйте новую запись в чате.'],409);$state=kareta_arrival_upsert($pdo,$order,$status,$eta,'client',$note);kareta_json(['ok'=>true,'state'=>$state]);
}
function kareta_master_arrival_set(PDO $pdo,array $body): void {
    if(!kareta_table_exists($pdo,'order_arrival_states'))kareta_json(['ok'=>false,'error'=>'migration_required','message'=>'Требуется миграция БД 122.'],503);$orderId=trim((string)($body['orderId']??''));$status=strtolower(trim((string)($body['status']??'')));$eta=max(0,min(360,(int)($body['etaMinutes']??0)));$note=mb_substr(trim((string)($body['note']??'')),0,255);if($orderId===''||!in_array($status,['arrived','late','no_show'],true))kareta_json(['ok'=>false,'error'=>'invalid_arrival_status'],422);$order=kareta_arrival_order_for_master($pdo,$orderId);if(!$order)kareta_json(['ok'=>false,'error'=>'order_not_found'],404);$existing=kareta_arrival_state_row($pdo,$orderId);if(($existing['status']??'')==='no_show'&&$status!=='no_show')kareta_json(['ok'=>false,'error'=>'no_show_locked','message'=>'Неявка уже зафиксирована. Для новой даты используйте перенос записи.'],409);$state=kareta_arrival_upsert($pdo,$order,$status,$eta,'master',$note);kareta_json(['ok'=>true,'state'=>$state,'slotReleased'=>$status==='no_show']);
}
