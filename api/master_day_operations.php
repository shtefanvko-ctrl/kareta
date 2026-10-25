<?php
declare(strict_types=1);

/** R188.5.5.6.70 — daily master operations and automatic schedule recovery. */

function kareta_master_day_ops_preferences(PDO $pdo,string $masterId): array {
    $defaults=['autoRecoveryEnabled'=>true,'autoNotifyEnabled'=>true,'autoRecoveryMode'=>'auto','autoRecoveryHorizonDays'=>14,'autoRecoveryGraceMin'=>15];
    if(!kareta_table_exists($pdo,'master_schedule_preferences'))return $defaults;
    $cols=[];
    foreach(['auto_recovery_enabled','auto_notify_enabled','auto_recovery_mode','auto_recovery_horizon_days','auto_recovery_grace_min'] as $col)if(kareta_column_exists($pdo,'master_schedule_preferences',$col))$cols[]=$col;
    if(!$cols)return $defaults;
    $q=$pdo->prepare('SELECT '.implode(',',$cols).' FROM master_schedule_preferences WHERE BINARY master_id=BINARY ? LIMIT 1');$q->execute([$masterId]);$r=$q->fetch(PDO::FETCH_ASSOC)?:[];
    $mode=strtolower((string)($r['auto_recovery_mode']??'auto'));if(!in_array($mode,['off','notify','propose','auto'],true))$mode='auto';
    return [
      'autoRecoveryEnabled'=>array_key_exists('auto_recovery_enabled',$r)?!empty($r['auto_recovery_enabled']):true,
      'autoNotifyEnabled'=>array_key_exists('auto_notify_enabled',$r)?!empty($r['auto_notify_enabled']):true,
      'autoRecoveryMode'=>$mode,
      'autoRecoveryHorizonDays'=>max(1,min(30,(int)($r['auto_recovery_horizon_days']??14))),
      'autoRecoveryGraceMin'=>max(0,min(120,(int)($r['auto_recovery_grace_min']??15))),
    ];
}

function kareta_master_shift_extension_for_date(PDO $pdo,string $masterId,string $date): array {
    if(!kareta_table_exists($pdo,'master_shift_extensions'))return [];
    $q=$pdo->prepare("SELECT id,work_date,extended_end_time,note,active,created_at,updated_at FROM master_shift_extensions WHERE BINARY master_id=BINARY ? AND work_date=? AND active=1 ORDER BY updated_at DESC LIMIT 1");$q->execute([$masterId,$date]);$r=$q->fetch(PDO::FETCH_ASSOC)?:[];
    if(!$r)return [];
    return ['id'=>(string)$r['id'],'date'=>(string)$r['work_date'],'endTime'=>substr((string)$r['extended_end_time'],0,5),'note'=>(string)$r['note'],'active'=>!empty($r['active']),'updatedAt'=>(string)$r['updated_at']];
}

function kareta_master_day_ops_order(PDO $pdo,string $masterId,string $orderId): array {
    $q=$pdo->prepare("SELECT o.*,(SELECT c.id FROM chats c WHERE BINARY c.order_id=BINARY o.id ORDER BY c.created_at DESC LIMIT 1) chat_id FROM orders o WHERE BINARY o.id=BINARY ? AND BINARY o.master_id=BINARY ? LIMIT 1");$q->execute([$orderId,$masterId]);return $q->fetch(PDO::FETCH_ASSOC)?:[];
}

function kareta_master_day_ops_plan_valid(PDO $pdo,string $masterId,array $plan): array {
    $orderId=(string)($plan['order_id']??'');$startRaw=(string)($plan['planned_start']??'');$endRaw=(string)($plan['planned_end']??'');
    try{$start=new DateTimeImmutable($startRaw);$end=new DateTimeImmutable($endRaw);}catch(Throwable $_){return ['valid'=>false,'reasons'=>['invalid_time']];}
    if($end<=$start)return ['valid'=>false,'reasons'=>['invalid_time']];
    $conflicts=kareta_master_schedule_conflicts($pdo,$masterId,$start,$end,$orderId,false);
    $reasons=[];foreach($conflicts as $c)$reasons[]=(string)($c['type']??'conflict');
    return ['valid'=>count($conflicts)===0,'reasons'=>array_values(array_unique($reasons)),'conflicts'=>$conflicts,'start'=>$start,'end'=>$end];
}

function kareta_master_day_ops_running(PDO $pdo,string $orderId): bool {
    if(!kareta_table_exists($pdo,'work_order_timers'))return false;
    $q=$pdo->prepare("SELECT COUNT(*) FROM work_order_timers WHERE BINARY order_id=BINARY ? AND status='running'");$q->execute([$orderId]);return (int)$q->fetchColumn()>0;
}

function kareta_master_day_ops_sync_bay(PDO $pdo,string $orderId,string $masterId,string $start,string $end,int $duration): void {
    if(!kareta_table_exists($pdo,'sto_bay_assignments'))return;
    $bayId='';if(function_exists('kareta_master_recovery_bay_candidate')){try{$q=$pdo->prepare("SELECT sto_id FROM orders WHERE BINARY id=BINARY ? LIMIT 1");$q->execute([$orderId]);$stoId=(string)($q->fetchColumn()?:'');$candidate=kareta_master_recovery_bay_candidate($pdo,$orderId,$stoId,$start,$end);if(!empty($candidate['available']))$bayId=(string)($candidate['bayId']??'');}catch(Throwable $_){}}
    $sets=['master_id=?','planned_end=?','estimated_minutes=?','updated_at=NOW()'];$args=[$masterId,$end,$duration];if($bayId!==''){$sets[]='bay_id=?';$args[]=$bayId;}
    if(kareta_column_exists($pdo,'sto_bay_assignments','planned_start')){$sets[]='planned_start=?';$args[]=$start;}
    $args[]=$orderId;
    $sql="UPDATE sto_bay_assignments SET ".implode(',',$sets)." WHERE BINARY order_id=BINARY ? AND status='planned'";
    try{$pdo->prepare($sql)->execute($args);}catch(Throwable $_){}
}

function kareta_master_day_ops_notify_move(PDO $pdo,array $order,string $oldStart,string $newStart,string $reason,string $triggerType): int {
    $orderId=(string)($order['id']??'');if($orderId==='')return 0;$chatId=(string)($order['chat_id']??'');
    $oldHuman='';$newHuman='';try{$oldHuman=(new DateTimeImmutable($oldStart))->format('d.m.Y H:i');}catch(Throwable $_){}try{$newHuman=(new DateTimeImmutable($newStart))->format('d.m.Y H:i');}catch(Throwable $_){}
    $text='KARETA автоматически перенесла запись'.($oldHuman!==''?' с '.$oldHuman:'').' на '.$newHuman.' после изменения рабочего графика.'.($reason!==''?' Причина: '.$reason:'');
    if(function_exists('kareta_master_schedule_write_system_message'))kareta_master_schedule_write_system_message($pdo,$orderId,$chatId,$text,'auto-recovery|'.$newStart.'|'.$triggerType);
    try{kareta_notification_insert($pdo,[
      'recipientUserId'=>(int)($order['client_user_id']??0)?:null,'recipientPhone'=>(string)($order['client_phone']??''),'recipientRole'=>'client',
      'eventType'=>'order.schedule.auto_rescheduled','entityType'=>'order','entityId'=>$orderId,'title'=>'Запись автоматически перенесена','body'=>$newHuman.($reason!==''?' · '.$reason:''),
      'actionUrl'=>'#/orders/item/'.rawurlencode($orderId),'meta'=>['orderId'=>$orderId,'chatId'=>$chatId,'oldStart'=>$oldStart,'plannedStart'=>$newStart,'triggerType'=>$triggerType]
    ]);return 1;}catch(Throwable $_){return 0;}
}

function kareta_master_day_ops_log(PDO $pdo,string $masterId,string $triggerType,string $triggerRef,string $affectedDate,array $result): void {
    if(!kareta_table_exists($pdo,'master_schedule_recovery_events'))return;
    $id='rec_'.substr(hash('sha256',$masterId.'|'.$triggerType.'|'.$triggerRef.'|'.microtime(true)),0,28);
    try{$pdo->prepare("INSERT INTO master_schedule_recovery_events(id,master_id,trigger_type,trigger_ref,affected_date,moved_count,notified_count,result_json) VALUES(?,?,?,?,?,?,?,?)")->execute([$id,$masterId,$triggerType,$triggerRef,$affectedDate!==''?$affectedDate:null,(int)($result['movedCount']??0),(int)($result['notifiedCount']??0),json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);}catch(Throwable $_){}
}

function kareta_master_schedule_delay_recover(PDO $pdo,string $masterId,bool $force=false): array {
    $prefs=kareta_master_day_ops_preferences($pdo,$masterId);
    if(!$force&&(!$prefs['autoRecoveryEnabled']||$prefs['autoRecoveryMode']==='off'))return ['ok'=>true,'enabled'=>false,'triggerType'=>'delay_scan','movedCount'=>0,'notifiedCount'=>0,'items'=>[]];
    if(!kareta_table_exists($pdo,'work_order_timers')||!kareta_table_exists($pdo,'master_order_plans'))return ['ok'=>true,'enabled'=>true,'triggerType'=>'delay_scan','movedCount'=>0,'notifiedCount'=>0,'items'=>[]];
    $q=$pdo->prepare("SELECT p.order_id,p.planned_start,p.planned_end,p.estimated_repair_min,p.buffer_min,COALESCE(SUM(CASE WHEN t.status='running' THEN TIMESTAMPDIFF(SECOND,t.started_at,NOW()) ELSE t.duration_sec END),0) worked_sec FROM master_order_plans p JOIN work_order_timers t ON BINARY t.order_id=BINARY p.order_id WHERE BINARY p.master_id=BINARY ? AND t.master_id=? GROUP BY p.order_id,p.planned_start,p.planned_end,p.estimated_repair_min,p.buffer_min HAVING SUM(CASE WHEN t.status='running' THEN 1 ELSE 0 END)>0 ORDER BY p.planned_start LIMIT 1");$q->execute([$masterId,$masterId]);$running=$q->fetch(PDO::FETCH_ASSOC)?:[];
    if(!$running)return ['ok'=>true,'enabled'=>true,'triggerType'=>'delay_scan','movedCount'=>0,'notifiedCount'=>0,'items'=>[]];
    try{$plannedEnd=new DateTimeImmutable((string)$running['planned_end']);$now=new DateTimeImmutable('now');}catch(Throwable $_){return ['ok'=>true,'enabled'=>true,'triggerType'=>'delay_scan','movedCount'=>0,'notifiedCount'=>0,'items'=>[]];}
    $worked=max(0,(int)round(((int)$running['worked_sec'])/60));$estimate=max(15,(int)($running['estimated_repair_min']??120));$remaining=max(15,$estimate-$worked);$projected=$now->modify('+'.$remaining.' minutes');
    if($projected<=$plannedEnd)return ['ok'=>true,'enabled'=>true,'triggerType'=>'delay_scan','movedCount'=>0,'notifiedCount'=>0,'projectedEnd'=>$projected->format('Y-m-d H:i:s'),'items'=>[]];
    $date=$plannedEnd->format('Y-m-d');$q=$pdo->prepare("SELECT p.*,o.status order_status,o.client_user_id,o.client_phone,o.client_vehicle_id,o.vehicle_title,o.client_car,o.service_names,o.estimated_duration_min,o.sto_id,(SELECT c.id FROM chats c WHERE BINARY c.order_id=BINARY o.id ORDER BY c.created_at DESC LIMIT 1) chat_id FROM master_order_plans p JOIN orders o ON BINARY o.id=BINARY p.order_id WHERE BINARY p.master_id=BINARY ? AND DATE(p.planned_start)=? AND p.planned_start>? AND p.planned_start<? AND p.status NOT IN ('done','completed','cancelled','closed','no_show') AND LOWER(o.status) NOT IN ('completed','done','delivered','closed','cancelled') ORDER BY p.planned_start");$q->execute([$masterId,$date,$plannedEnd->format('Y-m-d H:i:s'),$projected->format('Y-m-d H:i:s')]);$impacted=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
    $moved=0;$notified=0;$items=[];$horizon=max(1,(int)$prefs['autoRecoveryHorizonDays']);
    foreach($impacted as $plan){$orderId=(string)$plan['order_id'];if($orderId===''||!empty($plan['auto_recovery_protected'])||kareta_master_day_ops_running($pdo,$orderId))continue;$order=$plan;$order['id']=$orderId;$slots=kareta_master_schedule_free_slots_for_order($pdo,$masterId,$order,$horizon)['slots']??[];$choice=null;$oldStart=(string)$plan['planned_start'];$minTs=$projected->getTimestamp();foreach($slots as $slot){$ts=strtotime((string)($slot['start']??''))?:0;if($ts>=$minTs){$choice=$slot;break;}}if(!$choice){foreach($slots as $slot){$ts=strtotime((string)($slot['start']??''))?:0;if($ts>strtotime($oldStart)){$choice=$slot;break;}}}if(!$choice){$items[]=['orderId'=>$orderId,'status'=>'unresolved','oldStart'=>$oldStart,'reason'=>'running_repair_delay'];continue;}
        $newStart=(string)$choice['start'];$newEnd=(string)$choice['end'];if(function_exists('kareta_tariff_master_intake_guard')){$guard=kareta_tariff_master_intake_guard($pdo,$masterId,substr($newStart,0,10),$orderId,false);if(empty($guard['canSchedule'])){$items[]=['orderId'=>$orderId,'status'=>'tariff_blocked','candidateStart'=>$newStart];continue;}}if(function_exists('kareta_master_recovery_bay_candidate')){$bay=kareta_master_recovery_bay_candidate($pdo,$orderId,(string)($plan['sto_id']??''),$newStart,$newEnd);if(empty($bay['available'])){$items[]=['orderId'=>$orderId,'status'=>'bay_blocked','candidateStart'=>$newStart];continue;}}
        $duration=max(15,(int)($plan['estimated_repair_min']??$choice['workMinutes']??120));$buffer=max(0,(int)($plan['buffer_min']??$choice['bufferMin']??0));try{$pdo->beginTransaction();$lock=$pdo->prepare("SELECT id FROM masters WHERE BINARY id=BINARY ? LIMIT 1 FOR UPDATE");$lock->execute([$masterId]);$conf=kareta_master_schedule_conflicts($pdo,$masterId,new DateTimeImmutable($newStart),new DateTimeImmutable($newEnd),$orderId,false);if($conf){$pdo->rollBack();$items[]=['orderId'=>$orderId,'status'=>'race_conflict','candidateStart'=>$newStart];continue;}$pdo->prepare("UPDATE master_order_plans SET planned_start=?,planned_end=?,source='auto_recovery',conflict_override=0,updated_at=NOW() WHERE BINARY order_id=BINARY ? AND BINARY master_id=BINARY ?")->execute([$newStart,$newEnd,$orderId,$masterId]);kareta_service_order_schedule_projection_update($pdo,$orderId,$newStart,null,'auto_recovery_delay');if(kareta_table_exists($pdo,'master_reschedule_proposals'))$pdo->prepare("UPDATE master_reschedule_proposals SET status='cancelled',decision_note='auto_recovery_delay',responded_at=NOW(),updated_at=NOW() WHERE BINARY order_id=BINARY ? AND status='pending'")->execute([$orderId]);kareta_master_day_ops_sync_bay($pdo,$orderId,$masterId,$newStart,$newEnd,$duration+$buffer);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();$items[]=['orderId'=>$orderId,'status'=>'error','message'=>$e->getMessage()];continue;}
        if($prefs['autoNotifyEnabled'])$notified+=kareta_master_day_ops_notify_move($pdo,$order,$oldStart,$newStart,'предыдущий ремонт задерживается','delay_scan');try{kareta_write_event($pdo,$orderId,'schedule_auto_recovered',['masterId'=>$masterId,'triggerType'=>'delay_scan','oldStart'=>$oldStart,'plannedStart'=>$newStart,'plannedEnd'=>$newEnd,'projectedPreviousEnd'=>$projected->format('Y-m-d H:i:s')]);}catch(Throwable $_){}$moved++;$items[]=['orderId'=>$orderId,'status'=>'moved','oldStart'=>$oldStart,'plannedStart'=>$newStart,'plannedEnd'=>$newEnd,'reason'=>'running_repair_delay'];
    }
    $result=['ok'=>true,'enabled'=>true,'mode'=>$prefs['autoRecoveryMode'],'triggerType'=>'delay_scan','movedCount'=>$moved,'notifiedCount'=>$notified,'projectedEnd'=>$projected->format('Y-m-d H:i:s'),'items'=>$items,'generatedAt'=>date(DATE_ATOM)];kareta_master_day_ops_log($pdo,$masterId,'delay_scan',(string)$running['order_id'],$date,$result);return $result;
}

function kareta_master_schedule_auto_recover(PDO $pdo,string $masterId,string $triggerType,string $affectedDate='',string $protectOrderId='',bool $force=false): array {
    if($triggerType==='delay_scan')return kareta_master_schedule_delay_recover($pdo,$masterId,$force);
    $prefs=kareta_master_day_ops_preferences($pdo,$masterId);
    if(!$force&&(!$prefs['autoRecoveryEnabled']||$prefs['autoRecoveryMode']==='off'))return ['ok'=>true,'enabled'=>false,'triggerType'=>$triggerType,'movedCount'=>0,'notifiedCount'=>0,'items'=>[]];
    if(!kareta_table_exists($pdo,'master_order_plans'))return ['ok'=>true,'enabled'=>true,'movedCount'=>0,'notifiedCount'=>0,'items'=>[]];
    $horizon=max(1,(int)$prefs['autoRecoveryHorizonDays']);$from=(new DateTimeImmutable('now'))->modify('-'.max(0,(int)$prefs['autoRecoveryGraceMin']).' minutes');$to=(new DateTimeImmutable('today'))->modify('+'.$horizon.' days')->setTime(23,59,59);
    $sql="SELECT p.*,o.status order_status,o.client_user_id,o.client_phone,o.client_vehicle_id,o.vehicle_title,o.client_car,o.service_names,o.estimated_duration_min,o.sto_id,(SELECT c.id FROM chats c WHERE BINARY c.order_id=BINARY o.id ORDER BY c.created_at DESC LIMIT 1) chat_id FROM master_order_plans p JOIN orders o ON BINARY o.id=BINARY p.order_id WHERE BINARY p.master_id=BINARY ? AND p.planned_start>=? AND p.planned_start<=? AND p.status NOT IN ('done','completed','cancelled','closed','no_show') AND LOWER(o.status) NOT IN ('completed','done','delivered','closed','cancelled') ORDER BY p.planned_start,p.created_at";
    $q=$pdo->prepare($sql);$q->execute([$masterId,$from->format('Y-m-d H:i:s'),$to->format('Y-m-d H:i:s')]);$plans=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
    $items=[];$moved=0;$notified=0;$kept=[];
    foreach($plans as $plan){$orderId=(string)$plan['order_id'];if($orderId===''||$orderId===$protectOrderId||!empty($plan['auto_recovery_protected']))continue;if(kareta_master_day_ops_running($pdo,$orderId))continue;
        $validation=kareta_master_day_ops_plan_valid($pdo,$masterId,$plan);$isAffected=$affectedDate===''||substr((string)$plan['planned_start'],0,10)===$affectedDate;
        if($validation['valid']&&!$isAffected){$kept[]=$orderId;continue;}
        // Auto-recovery never moves a valid future booking only because a scan was requested.
        // Delay recovery is handled by kareta_master_schedule_delay_recover() above.
        if($validation['valid'])continue;
        $order=$plan;$order['id']=$orderId;
        $slots=kareta_master_schedule_free_slots_for_order($pdo,$masterId,$order,$horizon)['slots']??[];$oldStart=(string)$plan['planned_start'];$oldTs=strtotime($oldStart)?:0;$choice=null;
        foreach($slots as $slot){$ts=strtotime((string)($slot['start']??''))?:0;if($ts<=0)continue;if($oldTs>0&&$ts<$oldTs)continue;$choice=$slot;break;}
        if(!$choice&&$slots)$choice=$slots[0];
        if(!$choice){$items[]=['orderId'=>$orderId,'status'=>'unresolved','oldStart'=>$oldStart,'reasons'=>$validation['reasons']??[]];continue;}
        $newStart=(string)$choice['start'];$newEnd=(string)$choice['end'];if($newStart===''||$newEnd===''||$newStart===$oldStart)continue;
        if(function_exists('kareta_tariff_master_intake_guard')){$guard=kareta_tariff_master_intake_guard($pdo,$masterId,substr($newStart,0,10),$orderId,false);if(empty($guard['canSchedule'])){$items[]=['orderId'=>$orderId,'status'=>'tariff_blocked','oldStart'=>$oldStart,'candidateStart'=>$newStart,'tariff'=>$guard];continue;}}if(function_exists('kareta_master_recovery_bay_candidate')){$bay=kareta_master_recovery_bay_candidate($pdo,$orderId,(string)($plan['sto_id']??''),$newStart,$newEnd);if(empty($bay['available'])){$items[]=['orderId'=>$orderId,'status'=>'bay_blocked','oldStart'=>$oldStart,'candidateStart'=>$newStart];continue;}}
        $duration=max(15,(int)($plan['estimated_repair_min']??$choice['workMinutes']??120));$buffer=max(0,(int)($plan['buffer_min']??$choice['bufferMin']??0));
        try{$pdo->beginTransaction();$lock=$pdo->prepare("SELECT id FROM masters WHERE BINARY id=BINARY ? LIMIT 1 FOR UPDATE");$lock->execute([$masterId]);$conf=kareta_master_schedule_conflicts($pdo,$masterId,new DateTimeImmutable($newStart),new DateTimeImmutable($newEnd),$orderId,false);if($conf){$pdo->rollBack();$items[]=['orderId'=>$orderId,'status'=>'race_conflict','candidateStart'=>$newStart];continue;}
            $pdo->prepare("UPDATE master_order_plans SET planned_start=?,planned_end=?,estimated_repair_min=?,buffer_min=?,status=IF(status IN ('done','completed'),status,'planned'),source='auto_recovery',conflict_override=0,updated_at=NOW() WHERE BINARY order_id=BINARY ? AND BINARY master_id=BINARY ?")->execute([$newStart,$newEnd,$duration,$buffer,$orderId,$masterId]);
            kareta_service_order_schedule_projection_update($pdo,$orderId,$newStart,$duration,'auto_recovery');
            if(kareta_table_exists($pdo,'master_reschedule_proposals'))$pdo->prepare("UPDATE master_reschedule_proposals SET status='cancelled',decision_note='auto_recovery_applied',responded_at=NOW(),updated_at=NOW() WHERE BINARY order_id=BINARY ? AND status='pending'")->execute([$orderId]);
            kareta_master_day_ops_sync_bay($pdo,$orderId,$masterId,$newStart,$newEnd,$duration+$buffer);$pdo->commit();
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();$items[]=['orderId'=>$orderId,'status'=>'error','message'=>$e->getMessage()];continue;}
        $reason=implode(', ',array_map(static fn($r)=>['day_off'=>'выходной','outside_hours'=>'изменена смена','blocked'=>'добавлен перерыв','order'=>'пересечение с другой записью'][$r]??$r,$validation['reasons']??[]));
        if($prefs['autoNotifyEnabled'])$notified+=kareta_master_day_ops_notify_move($pdo,$order,$oldStart,$newStart,$reason,$triggerType);
        try{kareta_write_event($pdo,$orderId,'schedule_auto_recovered',['masterId'=>$masterId,'triggerType'=>$triggerType,'oldStart'=>$oldStart,'plannedStart'=>$newStart,'plannedEnd'=>$newEnd,'reason'=>$reason]);}catch(Throwable $_){}
        $moved++;$items[]=['orderId'=>$orderId,'status'=>'moved','oldStart'=>$oldStart,'plannedStart'=>$newStart,'plannedEnd'=>$newEnd,'reason'=>$reason];
    }
    $result=['ok'=>true,'enabled'=>true,'mode'=>$prefs['autoRecoveryMode'],'triggerType'=>$triggerType,'affectedDate'=>$affectedDate,'protectOrderId'=>$protectOrderId,'movedCount'=>$moved,'notifiedCount'=>$notified,'items'=>$items,'generatedAt'=>date(DATE_ATOM)];
    kareta_master_day_ops_log($pdo,$masterId,$triggerType,$protectOrderId,$affectedDate,$result);return $result;
}

function kareta_master_schedule_recovery_run(PDO $pdo,array $body): void {
    $master=kareta_master_workplace_profile($pdo);$mid=(string)$master['id'];$trigger=trim((string)($body['triggerType']??'manual_recovery'))?:'manual_recovery';$date=trim((string)($body['date']??''));if($date!==''&&!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date))$date='';
    kareta_json(['ok'=>true,'recovery'=>kareta_master_schedule_auto_recover($pdo,$mid,$trigger,$date,'',true)]);
}

function kareta_master_shift_extension_save(PDO $pdo,array $body): void {
    if(!kareta_table_exists($pdo,'master_shift_extensions'))kareta_json(['ok'=>false,'error'=>'migration_required','message'=>'Требуется миграция БД 124.'],503);
    $master=kareta_master_workplace_profile($pdo);$mid=(string)$master['id'];$date=trim((string)($body['date']??''));$end=trim((string)($body['endTime']??''));$note=mb_substr(trim((string)($body['note']??'')),0,191);
    if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date)||!preg_match('/^\d{2}:\d{2}$/',$end))kareta_json(['ok'=>false,'error'=>'invalid_extension'],422);
    $base=kareta_master_schedule_day_bounds($pdo,$mid,$date);if(!empty($base['isDayOff']))kareta_json(['ok'=>false,'error'=>'day_off','message'=>'Сначала включите рабочий день, затем продлевайте смену.'],409);
    if($end<=$base['start']->format('H:i'))kareta_json(['ok'=>false,'error'=>'invalid_extension_end','message'=>'Конец продления должен быть позже начала смены.'],422);
    $id='ext_'.substr(hash('sha256',$mid.'|'.$date),0,24);$uid=(int)(kareta_session_user()['id']??0)?:null;
    $pdo->prepare("INSERT INTO master_shift_extensions(id,master_id,work_date,extended_end_time,note,active,created_by_user_id) VALUES(?,?,?,?,?,1,?) ON DUPLICATE KEY UPDATE extended_end_time=VALUES(extended_end_time),note=VALUES(note),active=1,created_by_user_id=VALUES(created_by_user_id),updated_at=NOW()")->execute([$id,$mid,$date,$end,$note,$uid]);
    $recovery=kareta_master_schedule_auto_recover($pdo,$mid,'shift_extended',$date,'',false);kareta_json(['ok'=>true,'extension'=>kareta_master_shift_extension_for_date($pdo,$mid,$date),'recovery'=>$recovery]);
}

function kareta_master_shift_extension_delete(PDO $pdo,array $body): void {
    $master=kareta_master_workplace_profile($pdo);$mid=(string)$master['id'];$date=trim((string)($body['date']??''));if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date))kareta_json(['ok'=>false,'error'=>'invalid_date'],422);
    $pdo->prepare("UPDATE master_shift_extensions SET active=0,updated_at=NOW() WHERE BINARY master_id=BINARY ? AND work_date=? AND active=1")->execute([$mid,$date]);
    $recovery=kareta_master_schedule_auto_recover($pdo,$mid,'shift_extension_removed',$date,'',false);kareta_json(['ok'=>true,'date'=>$date,'recovery'=>$recovery]);
}

function kareta_master_day_ops_recent_recovery(PDO $pdo,string $masterId,int $limit=10): array {
    if(!kareta_table_exists($pdo,'master_schedule_recovery_events'))return [];$q=$pdo->prepare("SELECT trigger_type,trigger_ref,affected_date,moved_count,notified_count,result_json,created_at FROM master_schedule_recovery_events WHERE BINARY master_id=BINARY ? ORDER BY created_at DESC LIMIT ".max(1,min(30,$limit)));$q->execute([$masterId]);$out=[];foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r){$out[]=['triggerType'=>(string)$r['trigger_type'],'affectedDate'=>(string)($r['affected_date']??''),'movedCount'=>(int)$r['moved_count'],'notifiedCount'=>(int)$r['notified_count'],'createdAt'=>(string)$r['created_at']];}return $out;
}
