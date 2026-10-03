<?php
declare(strict_types=1);

require_once __DIR__.'/geo_core.php';

function kareta_sto_workplace_profile(PDO $pdo): array {
    if (class_exists('KaretaAuthResolver')) {
        try {
            $auth=(new KaretaAuthResolver($pdo))->resolve(false);
            $context=$auth?->context??[];
            $organizationKey=trim((string)($context['organizationKey']??''));
            if (($context['type']??'')==='organization' && $organizationKey!=='') {
                $q=$pdo->prepare("SELECT s.* FROM organizations o JOIN sto_profiles s ON o.legacy_entity_type='sto_profile' AND BINARY o.legacy_entity_id=BINARY CAST(s.id AS CHAR) WHERE BINARY o.id=BINARY ? AND o.type IN ('service_station','sto','service') LIMIT 1");
                $q->execute([$organizationKey]);$sto=$q->fetch(PDO::FETCH_ASSOC);
                if($sto){$sto['_context_key']=(string)($context['key']??'');$sto['_organization_key']=$organizationKey;return $sto;}
            }
        } catch (Throwable $_e) {}
    }
    $u = kareta_session_user();
    $uid = (int)($u['id'] ?? 0);
    $phone = kareta_normalize_phone((string)($u['phone'] ?? ''));
    $q = $pdo->prepare("SELECT * FROM sto_profiles WHERE user_id=? OR user_phone=? OR contact_phone=? LIMIT 1");
    $q->execute([$uid ?: -1, $phone, $phone]);
    $sto = $q->fetch(PDO::FETCH_ASSOC);
    if (!$sto) kareta_json(['ok'=>false,'error'=>'sto_profile_not_found'],404);
    $sto['_context_key']='';$sto['_organization_key']='org_sto_'.(string)$sto['id'];return $sto;
}

function kareta_sto_order_card(array $o, ?array $assignment = null): array {
    return [
        'id'=>(string)($o['id']??''),
        'status'=>(string)($o['status']??''),
        'vehicleTitle'=>(string)($o['vehicleTitle']??$o['vehicle_title']??$o['clientCar']??$o['client_car']??'Автомобиль'),
        'clientName'=>(string)($o['clientName']??$o['client_name']??''),
        'serviceNames'=>(string)($o['serviceNames']??$o['service_names']??''),
        'masterId'=>(string)($o['masterId']??$o['master_id']??''),
        'masterName'=>(string)($o['masterName']??$o['master_name']??''),
        'date'=>(string)($o['date']??''),
        'time'=>(string)($o['time']??''),
        'total'=>(float)($o['total']??$o['price']??0),
        'createdAt'=>(string)($o['createdAt']??$o['created_at']??''),
        'completedAt'=>(string)($o['completedAt']??$o['completed_at']??''),
        'workflowStage'=>(string)($o['workflowStage']??$o['workflow_stage']??''),
        'workflowRevision'=>(int)($o['workflowRevision']??$o['workflow_revision']??0),
        'workflowUpdatedAt'=>(string)($o['workflowUpdatedAt']??$o['workflow_updated_at']??''),
        'overdue'=>(bool)($o['overdue']??false),
        'assignment'=>$assignment
    ];
}

function kareta_sto_workplace_get(PDO $pdo): void {
    $sto = kareta_sto_workplace_profile($pdo);
    $stoId = (string)$sto['id'];

    $bays = [];
    if (kareta_table_exists($pdo,'sto_service_bays')) {
        $q=$pdo->prepare("SELECT id,name,code,capacity,active,sort_order AS sortOrder FROM sto_service_bays WHERE sto_id=? AND active=1 ORDER BY sort_order,name");
        $q->execute([$stoId]);
        $bays=$q->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    $masters=[];
    if (kareta_table_exists($pdo,'sto_master_links')) {
        $q=$pdo->prepare("SELECT m.id,m.name,m.spec,m.color,m.active FROM sto_master_links l JOIN masters m ON BINARY m.id=BINARY l.master_id WHERE BINARY l.sto_id=BINARY ? AND l.status='active' ORDER BY m.name");
        $q->execute([$stoId]);
        $masters=$q->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    $orders=[];
    $q=$pdo->prepare("SELECT o.*,w.current_stage AS workflow_stage,w.revision AS workflow_revision,w.updated_at AS workflow_updated_at FROM orders o LEFT JOIN sto_workflows w ON BINARY w.order_id=BINARY o.id WHERE BINARY o.sto_id=BINARY ? ORDER BY o.created_at DESC LIMIT 500");
    $q->execute([$stoId]);
    foreach($q->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row){
        $formatted=function_exists('_fmt_order')?_fmt_order($row):$row;
        $formatted['workflowStage']=(string)($row['workflow_stage']??'');
        $formatted['workflowRevision']=(int)($row['workflow_revision']??0);
        $formatted['workflowUpdatedAt']=(string)($row['workflow_updated_at']??'');
        $orders[]=$formatted;
    }

    $assignments=[];
    if (kareta_table_exists($pdo,'sto_bay_assignments')) {
        $q=$pdo->prepare("SELECT id,bay_id AS bayId,order_id AS orderId,master_id AS masterId,status,started_at AS startedAt,planned_end AS plannedEnd,updated_at AS updatedAt FROM sto_bay_assignments WHERE BINARY sto_id=BINARY ? AND status IN ('planned','active')");
        $q->execute([$stoId]);
        foreach($q->fetchAll(PDO::FETCH_ASSOC) ?: [] as $a) $assignments[(string)$a['orderId']]=$a;
    }

    $bayMap=[];
    foreach($bays as $b){ $b['orders']=[]; $bayMap[(string)$b['id']]=$b; }
    $queue=[];
    $recent=[];
    $today = date('Y-m-d');
    $month = date('Y-m');
    $activeStatuses=['accepted','in_progress','work','waiting_parts','waiting_approval'];
    $doneStatuses=['completed','done','delivered','closed','cancelled'];
    $metrics=[
        'bays'=>count($bays),'occupied'=>0,'queue'=>0,'masters'=>count($masters),'activeOrders'=>0,
        'todayOrders'=>0,'todayRevenue'=>0,'monthOrders'=>0,'monthRevenue'=>0,'completedMonth'=>0,'avgTicket'=>0
    ];
    $masterStats=[];
    $alerts=['overdue'=>[],'waitingApproval'=>[],'waitingParts'=>[]];
    foreach($masters as $m){
        $id=(string)$m['id'];
        $masterStats[$id]=array_merge($m,[
            'todayOrders'=>0,'activeOrders'=>0,'monthOrders'=>0,'completedMonth'=>0,'monthRevenue'=>0,'avgTicket'=>0,'kpi'=>0,'recentOrders'=>[]
        ]);
    }

    foreach($orders as $o){
        $id=(string)($o['id']??'');
        $a=$assignments[$id]??null;
        $card=kareta_sto_order_card($o,$a);
        $status=strtolower((string)$card['status']);
        $created=substr((string)$card['createdAt'],0,10);
        $completed=substr((string)$card['completedAt'],0,10);
        $orderDate=substr((string)$card['date'],0,10);
        $effectiveDate=$orderDate ?: $created;
        $revenueDate=$completed ?: $effectiveDate;
        $isToday=$effectiveDate===$today;
        $isMonth=str_starts_with($effectiveDate,$month);
        $isRevenueToday=$revenueDate===$today;
        $isRevenueMonth=str_starts_with($revenueDate,$month);
        $isDone=in_array($status,$doneStatuses,true);
        $isActive=in_array($status,$activeStatuses,true);
        $workflowStage=strtolower((string)$card['workflowStage']);
        $price=(float)$card['total'];
        $dueDate=$orderDate?:$created;
        $card['overdue']=$isActive&&$dueDate!==''&&$dueDate<$today;

        if($a && isset($bayMap[(string)$a['bayId']])) $bayMap[(string)$a['bayId']]['orders'][]=$card;
        elseif(!$isDone) $queue[]=$card;

        if(count($recent)<12) $recent[]=$card;
        if($card['overdue'])$alerts['overdue'][]=$card;
        if($status==='waiting_approval'||$workflowStage==='approval')$alerts['waitingApproval'][]=$card;
        if($status==='waiting_parts'||$workflowStage==='parts_reservation')$alerts['waitingParts'][]=$card;
        if($isActive) $metrics['activeOrders']++;
        if($isToday) $metrics['todayOrders']++;
        if($isDone && $isRevenueToday) $metrics['todayRevenue']+=$price;
        if($isMonth) $metrics['monthOrders']++;
        if($isDone && $isRevenueMonth){ $metrics['completedMonth']++; $metrics['monthRevenue']+=$price; }

        $masterId=(string)$card['masterId'];
        if($masterId!=='' && isset($masterStats[$masterId])){
            $ms=&$masterStats[$masterId];
            if($isToday)$ms['todayOrders']++;
            if($isActive)$ms['activeOrders']++;
            if($isMonth) $ms['monthOrders']++;
            if($isDone && $isRevenueMonth){ $ms['completedMonth']++; $ms['monthRevenue']+=$price; }
            if(count($ms['recentOrders'])<5)$ms['recentOrders'][]=$card;
            unset($ms);
        }
    }

    foreach($bayMap as $bay){ if(!empty($bay['orders']))$metrics['occupied']++; }
    $metrics['queue']=count($queue);
    $metrics['avgTicket']=$metrics['completedMonth']>0 ? round($metrics['monthRevenue']/$metrics['completedMonth']) : 0;

    foreach($masterStats as &$ms){
        $ms['avgTicket']=$ms['completedMonth']>0 ? round($ms['monthRevenue']/$ms['completedMonth']) : 0;
        $ms['kpi']=$ms['monthOrders']>0 ? min(100,round(($ms['completedMonth']/$ms['monthOrders'])*100)) : 0;
    }
    unset($ms);

    $recoveryControl=function_exists('kareta_sto_recovery_preview_data')?kareta_sto_recovery_preview_data($pdo,$stoId):['items'=>[],'summary'=>['conflicts'=>0,'safe'=>0,'protected'=>0,'blocked'=>0]];
    $recoveryNotifications=function_exists('kareta_sto_recovery_notification_history')?kareta_sto_recovery_notification_history($pdo,$stoId,24):[];
    $jointSchedule=function_exists('kareta_sto_joint_schedule')?kareta_sto_joint_schedule($pdo,$stoId,31):[];
    $schedulePreferences=kareta_sto_schedule_preferences($pdo,$stoId);
    $scheduleCommand=kareta_sto_schedule_command_data($pdo,$stoId,31);

    $calendar=[];
    if(kareta_table_exists($pdo,'calendar_events')){
        $organizationKey=(string)($sto['_organization_key']??('org_sto_'.$stoId));
        $q=$pdo->prepare("SELECT id,title,starts_at AS startsAt,ends_at AS endsAt,status,entity_type AS entityType,entity_key AS orderId FROM calendar_events WHERE (BINARY organization_id=BINARY ? OR BINARY organization_id=BINARY ?) AND status NOT IN ('cancelled','completed') AND ends_at>=NOW() ORDER BY starts_at LIMIT 20");
        $q->execute([$organizationKey,$stoId]);$calendar=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
    }

    $geoPoints=kareta_table_exists($pdo,'geo_points')?kareta_geo_owner_points($pdo,'sto',$stoId,false):[];
    $geoPoint=null;foreach($geoPoints as $point){if(in_array((string)($point['kind']??''),['service','branch'],true)){$geoPoint=$point;break;}}
    kareta_json(['ok'=>true,'data'=>[
        'sto'=>['id'=>$stoId,'name'=>(string)($sto['name']??'СТО'),'city'=>(string)($sto['city']??''),'address'=>(string)($sto['address']??''),'workHours'=>(string)($sto['work_hours']??''),'geoPoint'=>$geoPoint],
        'bays'=>array_values($bayMap),
        'queue'=>$queue,
        'masters'=>array_values($masterStats),
        'recentOrders'=>$recent,
        'alerts'=>$alerts,
        'calendar'=>$calendar,
        'metrics'=>$metrics,
        'contextKey'=>(string)($sto['_context_key']??''),
        'dispatch'=>function_exists('kareta_dispatch_dashboard_data')?kareta_dispatch_dashboard_data($pdo,$stoId):[],
        'recoveryControl'=>$recoveryControl,
        'recoveryNotifications'=>$recoveryNotifications,
        'jointSchedule'=>$jointSchedule,
        'schedulePreferences'=>$schedulePreferences,
        'scheduleCommand'=>$scheduleCommand,
        'generatedAt'=>date(DATE_ATOM)
    ]]);
}

function kareta_sto_master_assign(PDO $pdo,array $b): void {
    $sto=kareta_sto_workplace_profile($pdo);$stoId=(string)$sto['id'];
    $orderId=trim((string)($b['orderId']??''));$masterId=trim((string)($b['masterId']??''));
    if($orderId===''||$masterId==='')kareta_json(['ok'=>false,'error'=>'order_and_master_required'],422);
    $q=$pdo->prepare("SELECT id,status,master_id,`date` FROM orders WHERE BINARY id=BINARY ? AND BINARY sto_id=BINARY ? LIMIT 1");$q->execute([$orderId,$stoId]);$order=$q->fetch(PDO::FETCH_ASSOC);if(!$order)kareta_json(['ok'=>false,'error'=>'order_not_found'],404);if(in_array(strtolower((string)$order['status']),['completed','done','delivered','closed','cancelled'],true))kareta_json(['ok'=>false,'error'=>'completed_order_assignment_forbidden'],409);
    $q=$pdo->prepare("SELECT m.id,m.name,m.user_id FROM sto_master_links l JOIN masters m ON BINARY m.id=BINARY l.master_id WHERE BINARY l.sto_id=BINARY ? AND BINARY l.master_id=BINARY ? AND l.status='active' AND COALESCE(m.active,1)=1 LIMIT 1");$q->execute([$stoId,$masterId]);$master=$q->fetch(PDO::FETCH_ASSOC);if(!$master)kareta_json(['ok'=>false,'error'=>'sto_master_not_found'],404);
    $pdo->beginTransaction();
    try{
        $lock=$pdo->prepare("SELECT id,status,master_id,`date` FROM orders WHERE BINARY id=BINARY ? AND BINARY sto_id=BINARY ? LIMIT 1 FOR UPDATE");$lock->execute([$orderId,$stoId]);$lockedOrder=$lock->fetch(PDO::FETCH_ASSOC);if(!$lockedOrder){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'order_not_found'],404);}
        $currentMaster=trim((string)($lockedOrder['master_id']??''));$newAssignment=$currentMaster!==$masterId;
        if($newAssignment){$targetDate=preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)($lockedOrder['date']??''))?(string)$lockedOrder['date']:date('Y-m-d');kareta_tariff_master_guard($pdo,$masterId,$targetDate,$orderId,true);}
        $pdo->prepare('UPDATE orders SET master_id=?,master_user_id=?,master_name=?,accepted_at=COALESCE(accepted_at,NOW()) WHERE id=? AND sto_id=?')->execute([$masterId,(int)($master['user_id']??0)?:null,(string)$master['name'],$orderId,$stoId]);
        if($newAssignment)kareta_tariff_record_master_acceptance($pdo,$masterId,$orderId,date('Y-m-d'),'sto_workplace_assign');
        if(function_exists('kareta_dispatch_plan_order')) kareta_dispatch_plan_order($pdo,$stoId,$orderId,$masterId);
        if(kareta_table_exists($pdo,'sto_bay_assignments'))$pdo->prepare("UPDATE sto_bay_assignments SET master_id=?,updated_at=NOW() WHERE BINARY sto_id=BINARY ? AND BINARY order_id=BINARY ? AND status IN ('planned','active')")->execute([$masterId,$stoId,$orderId]);
        if(function_exists('kareta_log_audit'))kareta_log_audit($pdo,'sto.order.assign_master',['stoId'=>$stoId,'orderId'=>$orderId,'masterId'=>$masterId]);
        $pdo->commit();kareta_json(['ok'=>true,'orderId'=>$orderId,'masterId'=>$masterId,'masterName'=>(string)$master['name']]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function kareta_sto_bay_assign(PDO $pdo,array $b): void {
    $sto=kareta_sto_workplace_profile($pdo); $stoId=(string)$sto['id'];
    $orderId=trim((string)($b['orderId']??'')); $bayId=trim((string)($b['bayId']??''));
    if($orderId===''||$bayId==='')kareta_json(['ok'=>false,'error'=>'order_and_bay_required'],422);
    $q=$pdo->prepare("SELECT id FROM sto_service_bays WHERE BINARY id=BINARY ? AND BINARY sto_id=BINARY ? AND active=1 LIMIT 1");$q->execute([$bayId,$stoId]);if(!$q->fetchColumn())kareta_json(['ok'=>false,'error'=>'bay_not_found'],404);
    $q=$pdo->prepare("SELECT id,master_id FROM orders WHERE BINARY id=BINARY ? AND BINARY sto_id=BINARY ? LIMIT 1");$q->execute([$orderId,$stoId]);$order=$q->fetch(PDO::FETCH_ASSOC);if(!$order)kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    $pdo->beginTransaction();
    try{
        $lock=$pdo->prepare("SELECT id FROM sto_service_bays WHERE BINARY id=BINARY ? AND BINARY sto_id=BINARY ? AND active=1 LIMIT 1 FOR UPDATE");$lock->execute([$bayId,$stoId]);if(!$lock->fetchColumn()){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'bay_not_found'],404);}
        $busy=$pdo->prepare("SELECT id FROM sto_bay_assignments WHERE BINARY sto_id=BINARY ? AND BINARY bay_id=BINARY ? AND BINARY order_id<>BINARY ? AND status='active' LIMIT 1 FOR UPDATE");$busy->execute([$stoId,$bayId,$orderId]);if($busy->fetchColumn()){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'bay_busy','message'=>'Пост уже занят другой машиной.'],409);}
        $id='sba_'.bin2hex(random_bytes(8));
        $q=$pdo->prepare("INSERT INTO sto_bay_assignments(id,sto_id,bay_id,order_id,master_id,status,started_at,planned_end) VALUES(?,?,?,?,?,'active',NOW(),DATE_ADD(NOW(),INTERVAL 3 HOUR)) ON DUPLICATE KEY UPDATE bay_id=VALUES(bay_id),master_id=VALUES(master_id),status='active',started_at=COALESCE(started_at,NOW()),updated_at=CURRENT_TIMESTAMP");
        $q->execute([$id,$stoId,$bayId,$orderId,(string)($order['master_id']??'')]);$pdo->commit();kareta_json(['ok'=>true]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function kareta_sto_bay_release(PDO $pdo,array $b): void {
    $sto=kareta_sto_workplace_profile($pdo);$orderId=trim((string)($b['orderId']??''));
    $q=$pdo->prepare("UPDATE sto_bay_assignments SET status='released',released_at=NOW(),updated_at=CURRENT_TIMESTAMP WHERE BINARY sto_id=BINARY ? AND BINARY order_id=BINARY ? AND status IN ('planned','active')");
    $q->execute([(string)$sto['id'],$orderId]); kareta_json(['ok'=>true]);
}

/** R188.5.5.6.73 — STO recovery/native operations helpers. */
function kareta_sto_linked_master_rows(PDO $pdo,string $stoId): array {
    if(!kareta_table_exists($pdo,'sto_master_links'))return [];
    $q=$pdo->prepare("SELECT m.id,m.name,m.spec,m.user_id,m.rating,m.active FROM sto_master_links l JOIN masters m ON BINARY m.id=BINARY l.master_id WHERE BINARY l.sto_id=BINARY ? AND l.status='active' AND COALESCE(m.active,1)=1 ORDER BY m.name");
    $q->execute([$stoId]);return $q->fetchAll(PDO::FETCH_ASSOC)?:[];
}

/** R188.5.5.6.74 — STO schedule/capacity command center. */
function kareta_sto_schedule_preferences(PDO $pdo,string $stoId): array {
    $defaults=['defaultRange'=>'day','showMasterLanes'=>true,'showBayLanes'=>true,'showCapacitySummary'=>true,'compactDensity'=>false];
    if(!kareta_table_exists($pdo,'sto_schedule_preferences'))return $defaults;
    $q=$pdo->prepare("SELECT default_range,show_master_lanes,show_bay_lanes,show_capacity_summary,compact_density FROM sto_schedule_preferences WHERE BINARY sto_id=BINARY ? LIMIT 1");
    $q->execute([$stoId]);$r=$q->fetch(PDO::FETCH_ASSOC);if(!$r)return $defaults;
    $range=in_array((string)$r['default_range'],['day','week','month'],true)?(string)$r['default_range']:'day';
    return ['defaultRange'=>$range,'showMasterLanes'=>!empty($r['show_master_lanes']),'showBayLanes'=>!empty($r['show_bay_lanes']),'showCapacitySummary'=>!empty($r['show_capacity_summary']),'compactDensity'=>!empty($r['compact_density'])];
}

function kareta_sto_schedule_preferences_save(PDO $pdo,array $body): void {
    if(!kareta_table_exists($pdo,'sto_schedule_preferences'))kareta_json(['ok'=>false,'error'=>'migration_required','message'=>'Требуется миграция БД 127.'],503);
    $sto=kareta_sto_workplace_profile($pdo);$stoId=(string)$sto['id'];$current=kareta_sto_schedule_preferences($pdo,$stoId);
    $range=(string)($body['defaultRange']??$current['defaultRange']);if(!in_array($range,['day','week','month'],true))$range='day';
    $master=array_key_exists('showMasterLanes',$body)?!empty($body['showMasterLanes']):$current['showMasterLanes'];
    $bay=array_key_exists('showBayLanes',$body)?!empty($body['showBayLanes']):$current['showBayLanes'];
    $summary=array_key_exists('showCapacitySummary',$body)?!empty($body['showCapacitySummary']):$current['showCapacitySummary'];
    $compact=array_key_exists('compactDensity',$body)?!empty($body['compactDensity']):$current['compactDensity'];
    $uid=(int)(kareta_session_user()['id']??0)?:null;
    $q=$pdo->prepare("INSERT INTO sto_schedule_preferences(sto_id,default_range,show_master_lanes,show_bay_lanes,show_capacity_summary,compact_density,updated_by_user_id) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE default_range=VALUES(default_range),show_master_lanes=VALUES(show_master_lanes),show_bay_lanes=VALUES(show_bay_lanes),show_capacity_summary=VALUES(show_capacity_summary),compact_density=VALUES(compact_density),updated_by_user_id=VALUES(updated_by_user_id),updated_at=CURRENT_TIMESTAMP");
    $q->execute([$stoId,$range,$master?1:0,$bay?1:0,$summary?1:0,$compact?1:0,$uid]);
    kareta_json(['ok'=>true,'preferences'=>kareta_sto_schedule_preferences($pdo,$stoId)]);
}

function kareta_sto_bay_incident_conflicts(PDO $pdo,string $stoId,string $bayId,string $start,string $end): int {
    if($stoId===''||$bayId===''||!kareta_table_exists($pdo,'sto_capacity_incidents'))return 0;
    $q=$pdo->prepare("SELECT COUNT(*) FROM sto_capacity_incidents WHERE BINARY sto_id=BINARY ? AND lane_type='bay' AND BINARY lane_id=BINARY ? AND status='active' AND starts_at<? AND ends_at>?");
    $q->execute([$stoId,$bayId,$end,$start]);return (int)$q->fetchColumn();
}

function kareta_sto_find_available_bay(PDO $pdo,string $stoId,string $orderId,string $start,string $end,string $excludeBayId=''): array {
    if(!kareta_table_exists($pdo,'sto_service_bays')||!kareta_table_exists($pdo,'sto_bay_assignments'))return ['available'=>false,'bayId'=>'','bayName'=>''];
    $q=$pdo->prepare("SELECT id,name,code FROM sto_service_bays WHERE BINARY sto_id=BINARY ? AND active=1 ORDER BY sort_order,name");$q->execute([$stoId]);
    foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $bay){$bid=(string)$bay['id'];if($excludeBayId!==''&&$bid===$excludeBayId)continue;$c=$pdo->prepare("SELECT COUNT(*) FROM sto_bay_assignments WHERE BINARY sto_id=BINARY ? AND BINARY bay_id=BINARY ? AND BINARY order_id<>BINARY ? AND status IN ('planned','active') AND planned_start<? AND planned_end>?");$c->execute([$stoId,$bid,$orderId,$end,$start]);if((int)$c->fetchColumn()>0)continue;if(kareta_sto_bay_incident_conflicts($pdo,$stoId,$bid,$start,$end)>0)continue;return ['available'=>true,'bayId'=>$bid,'bayName'=>(string)($bay['name']??$bay['code']??'Бокс'),'bayCode'=>(string)($bay['code']??'')];}
    return ['available'=>false,'bayId'=>'','bayName'=>''];
}

function kareta_sto_active_incidents(PDO $pdo,string $stoId,int $limit=30): array {
    if(!kareta_table_exists($pdo,'sto_capacity_incidents'))return [];$limit=max(1,min(100,$limit));
    $q=$pdo->prepare("SELECT id,lane_type,lane_id,starts_at,ends_at,reason,status,created_at FROM sto_capacity_incidents WHERE BINARY sto_id=BINARY ? AND status='active' ORDER BY starts_at LIMIT $limit");
    $q->execute([$stoId]);$out=[];foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r)$out[]=['id'=>(string)$r['id'],'laneType'=>(string)$r['lane_type'],'laneId'=>(string)$r['lane_id'],'startsAt'=>(string)$r['starts_at'],'endsAt'=>(string)$r['ends_at'],'reason'=>(string)$r['reason'],'status'=>(string)$r['status'],'createdAt'=>(string)$r['created_at']];return $out;
}

function kareta_sto_schedule_command_data(PDO $pdo,string $stoId,int $days=31): array {
    $days=max(1,min(31,$days));$items=kareta_sto_joint_schedule($pdo,$stoId,$days);$masters=kareta_sto_linked_master_rows($pdo,$stoId);$bays=[];
    if(kareta_table_exists($pdo,'sto_service_bays')){$q=$pdo->prepare("SELECT id,name,code,capacity,sort_order FROM sto_service_bays WHERE BINARY sto_id=BINARY ? AND active=1 ORDER BY sort_order,name");$q->execute([$stoId]);$bays=$q->fetchAll(PDO::FETCH_ASSOC)?:[];}
    $today=new DateTimeImmutable('today');$daily=[];
    for($i=0;$i<$days;$i++){$date=$today->modify("+$i day")->format('Y-m-d');$daily[$date]=['date'=>$date,'masterCapacityMinutes'=>0,'masterBookedMinutes'=>0,'bayCapacityMinutes'=>0,'bayBookedMinutes'=>0,'orders'=>0,'conflicts'=>0];}
    $masterLanes=[];foreach($masters as $m){$mid=(string)$m['id'];$lane=['id'=>$mid,'type'=>'master','name'=>(string)($m['name']??'Мастер'),'subtitle'=>(string)($m['spec']??''),'items'=>[],'capacityMinutes'=>0,'bookedMinutes'=>0];for($i=0;$i<$days;$i++){$date=$today->modify("+$i day")->format('Y-m-d');$cap=480;if(function_exists('kareta_master_schedule_day_bounds')){try{$b=kareta_master_schedule_day_bounds($pdo,$mid,$date);if(!empty($b['isDayOff']))$cap=0;else{$cap=max(0,(int)(($b['end']->getTimestamp()-$b['start']->getTimestamp())/60));if(function_exists('kareta_master_schedule_blocked_minutes'))$cap=max(0,$cap-kareta_master_schedule_blocked_minutes($pdo,$mid,$date,$b['start'],$b['end']));}}catch(Throwable $_){}}$lane['capacityMinutes']+=$cap;$daily[$date]['masterCapacityMinutes']+=$cap;} $masterLanes[$mid]=$lane;}
    $bayLanes=[];foreach($bays as $b){$bid=(string)$b['id'];$cap=max(60,(int)($b['capacity']??1)*480);$bayLanes[$bid]=['id'=>$bid,'type'=>'bay','name'=>(string)($b['name']??$b['code']??'Бокс'),'subtitle'=>(string)($b['code']??''),'items'=>[],'capacityMinutes'=>$cap*$days,'bookedMinutes'=>0];foreach($daily as &$row)$row['bayCapacityMinutes']+=$cap;unset($row);}
    foreach($items as $item){$start=(string)($item['plannedStart']??'');$end=(string)($item['plannedEnd']??'');$date=substr($start,0,10);$duration=0;try{$duration=max(0,(int)(((new DateTimeImmutable($end))->getTimestamp()-(new DateTimeImmutable($start))->getTimestamp())/60));}catch(Throwable $_){}$item['durationMin']=$duration;$mid=(string)($item['masterId']??'');$bid=(string)($item['bayId']??'');if(isset($masterLanes[$mid])){$masterLanes[$mid]['items'][]=$item;$masterLanes[$mid]['bookedMinutes']+=$duration;}if(isset($bayLanes[$bid])){$bayLanes[$bid]['items'][]=$item;$bayLanes[$bid]['bookedMinutes']+=$duration;}if(isset($daily[$date])){$daily[$date]['masterBookedMinutes']+=$duration;$daily[$date]['bayBookedMinutes']+=$duration;$daily[$date]['orders']++;}}
    $recovery=kareta_sto_recovery_preview_data($pdo,$stoId);foreach($recovery['items']??[] as $r){$date=substr((string)($r['oldStart']??''),0,10);if(isset($daily[$date]))$daily[$date]['conflicts']++;}
    foreach($masterLanes as &$lane)$lane['loadPct']=$lane['capacityMinutes']>0?round($lane['bookedMinutes']*100/$lane['capacityMinutes'],1):0;unset($lane);foreach($bayLanes as &$lane)$lane['loadPct']=$lane['capacityMinutes']>0?round($lane['bookedMinutes']*100/$lane['capacityMinutes'],1):0;unset($lane);
    return ['days'=>array_values($daily),'masterLanes'=>array_values($masterLanes),'bayLanes'=>array_values($bayLanes),'items'=>$items,'incidents'=>kareta_sto_active_incidents($pdo,$stoId,40),'preferences'=>kareta_sto_schedule_preferences($pdo,$stoId),'generatedAt'=>date(DATE_ATOM)];
}

function kareta_sto_order_alternative_pairs(PDO $pdo,array $body): void {
    $sto=kareta_sto_workplace_profile($pdo);$stoId=(string)$sto['id'];$orderId=trim((string)($body['orderId']??''));if($orderId==='')kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    $q=$pdo->prepare("SELECT * FROM orders WHERE BINARY id=BINARY ? AND BINARY sto_id=BINARY ? LIMIT 1");$q->execute([$orderId,$stoId]);$order=$q->fetch(PDO::FETCH_ASSOC);if(!$order)kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    $start='';$end='';if(kareta_table_exists($pdo,'master_order_plans')){$p=$pdo->prepare("SELECT planned_start,planned_end FROM master_order_plans WHERE BINARY order_id=BINARY ? LIMIT 1");$p->execute([$orderId]);$plan=$p->fetch(PDO::FETCH_ASSOC)?:[];$start=(string)($plan['planned_start']??'');$end=(string)($plan['planned_end']??'');}
    if($start===''){$date=preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)($order['date']??''))?(string)$order['date']:date('Y-m-d');$time=preg_match('/^\d{2}:\d{2}/',(string)($order['time']??''))?substr((string)$order['time'],0,5):date('H:i');$start=$date.' '.$time.':00';}$duration=max(30,(int)($order['estimated_duration_min']??120));if($end==='')$end=(new DateTimeImmutable($start))->modify('+'.$duration.' minutes')->format('Y-m-d H:i:s');
    $bays=[];$q=$pdo->prepare("SELECT id,name,code,capacity FROM sto_service_bays WHERE BINARY sto_id=BINARY ? AND active=1 ORDER BY sort_order,name");$q->execute([$stoId]);$bays=$q->fetchAll(PDO::FETCH_ASSOC)?:[];$pairs=[];
    foreach(kareta_sto_linked_master_rows($pdo,$stoId) as $m){$mid=(string)$m['id'];$score=function_exists('kareta_dispatch_score_master_for_order')?kareta_dispatch_score_master_for_order($pdo,$mid,$order):['score'=>0,'serviceMatch'=>0,'loadPct'=>0,'tariffBlocked'=>false];if(empty($score['eligible']))continue;$conf=[];if(function_exists('kareta_master_schedule_conflicts'))try{$conf=kareta_master_schedule_conflicts($pdo,$mid,new DateTimeImmutable($start),new DateTimeImmutable($end),$orderId,false);}catch(Throwable $_){$conf=[['type'=>'invalid_time']];}if($conf)continue;
        foreach($bays as $b){$bid=(string)$b['id'];$cq=$pdo->prepare("SELECT COUNT(*) FROM sto_bay_assignments WHERE BINARY sto_id=BINARY ? AND BINARY bay_id=BINARY ? AND BINARY order_id<>BINARY ? AND status IN ('planned','active') AND planned_start<? AND planned_end>?");$cq->execute([$stoId,$bid,$orderId,$end,$start]);if((int)$cq->fetchColumn()>0||kareta_sto_pair_interval_conflicts($pdo,$stoId,$mid,$bid,$orderId,$start,$end,false))continue;$pairs[]=['masterId'=>$mid,'masterName'=>(string)($m['name']??'Мастер'),'masterSpec'=>(string)($m['spec']??''),'serviceMatch'=>(int)($score['serviceMatch']??0),'masterLoadPct'=>(float)($score['loadPct']??0),'score'=>(float)($score['score']??0),'bayId'=>$bid,'bayName'=>(string)($b['name']??$b['code']??'Бокс'),'bayCode'=>(string)($b['code']??''),'plannedStart'=>$start,'plannedEnd'=>$end];break;}
    }
    usort($pairs,static fn($a,$b)=>((float)$b['score']<=>(float)$a['score'])?:((float)$a['masterLoadPct']<=>(float)$b['masterLoadPct']));kareta_json(['ok'=>true,'data'=>['orderId'=>$orderId,'plannedStart'=>$start,'plannedEnd'=>$end,'pairs'=>array_slice($pairs,0,12)]]);
}

function kareta_sto_pair_reject(PDO $pdo,array $payload,int $status): void {
    if($pdo->inTransaction())$pdo->rollBack();
    kareta_json($payload,$status);
}
function kareta_sto_pair_interval_conflicts(PDO $pdo,string $stoId,string $masterId,string $bayId,string $orderId,string $start,string $end,bool $locked=false): array {
    if($locked&&!$pdo->inTransaction())throw new LogicException('pair_validation_requires_transaction');
    try{$startDt=new DateTimeImmutable($start);$endDt=new DateTimeImmutable($end);}catch(Throwable $e){return [['type'=>'invalid_time']];}
    if($endDt<=$startDt)return [['type'=>'invalid_time']];
    if(!function_exists('kareta_master_schedule_conflicts')||!kareta_table_exists($pdo,'master_order_plans')||!kareta_table_exists($pdo,'sto_bay_assignments'))return [['type'=>'schedule_unavailable']];
    $conflicts=kareta_master_schedule_conflicts($pdo,$masterId,$startDt,$endDt,$orderId,$locked);
    $sql="SELECT id FROM sto_bay_assignments WHERE BINARY sto_id=BINARY ? AND BINARY bay_id=BINARY ? AND BINARY order_id<>BINARY ? AND status IN ('planned','active') AND planned_start<? AND planned_end>?";
    if($locked)$sql.=' FOR UPDATE';
    $q=$pdo->prepare($sql);$q->execute([$stoId,$bayId,$orderId,$end,$start]);
    if($q->fetchColumn()!==false)$conflicts[]=['type'=>'bay_busy'];
    if(kareta_sto_bay_incident_conflicts($pdo,$stoId,$bayId,$start,$end)>0)$conflicts[]=['type'=>'bay_incident'];
    return $conflicts;
}
function kareta_sto_assign_pair(PDO $pdo,array $body): void {
    $sto=kareta_sto_workplace_profile($pdo);$stoId=(string)$sto['id'];$orderId=trim((string)($body['orderId']??''));$masterId=trim((string)($body['masterId']??''));$bayId=trim((string)($body['bayId']??''));if($orderId===''||$masterId===''||$bayId==='')kareta_sto_pair_reject($pdo,['ok'=>false,'error'=>'order_master_bay_required'],422);
    $pdo->beginTransaction();
    try {
    $q=$pdo->prepare("SELECT * FROM orders WHERE BINARY id=BINARY ? AND BINARY sto_id=BINARY ? LIMIT 1 FOR UPDATE");$q->execute([$orderId,$stoId]);$order=$q->fetch(PDO::FETCH_ASSOC);if(!$order)kareta_sto_pair_reject($pdo,['ok'=>false,'error'=>'order_not_found'],404);if(in_array(strtolower((string)($order['status']??'')),['completed','done','delivered','closed','cancelled'],true))kareta_sto_pair_reject($pdo,['ok'=>false,'error'=>'completed_order_assignment_forbidden'],409);
    $q=$pdo->prepare("SELECT m.* FROM sto_master_links l JOIN masters m ON BINARY m.id=BINARY l.master_id WHERE BINARY l.sto_id=BINARY ? AND BINARY l.master_id=BINARY ? AND l.status='active' AND COALESCE(m.active,1)=1 LIMIT 1 FOR UPDATE");$q->execute([$stoId,$masterId]);$master=$q->fetch(PDO::FETCH_ASSOC);if(!$master)kareta_sto_pair_reject($pdo,['ok'=>false,'error'=>'sto_master_not_found'],404);$q=$pdo->prepare("SELECT id,name FROM sto_service_bays WHERE BINARY sto_id=BINARY ? AND BINARY id=BINARY ? AND active=1 LIMIT 1 FOR UPDATE");$q->execute([$stoId,$bayId]);$bay=$q->fetch(PDO::FETCH_ASSOC);if(!$bay)kareta_sto_pair_reject($pdo,['ok'=>false,'error'=>'bay_not_found'],404);
    $start='';$end='';$plan=[];if(kareta_table_exists($pdo,'master_order_plans')){$q=$pdo->prepare("SELECT * FROM master_order_plans WHERE BINARY order_id=BINARY ? LIMIT 1 FOR UPDATE");$q->execute([$orderId]);$plan=$q->fetch(PDO::FETCH_ASSOC)?:[];$start=(string)($plan['planned_start']??'');$end=(string)($plan['planned_end']??'');}$duration=max(30,(int)($order['estimated_duration_min']??$plan['estimated_repair_min']??120));if($start===''){$date=preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)($order['date']??''))?(string)$order['date']:date('Y-m-d');$time=preg_match('/^\d{2}:\d{2}/',(string)($order['time']??''))?substr((string)$order['time'],0,5):date('H:i');$start=$date.' '.$time.':00';}if($end==='')$end=(new DateTimeImmutable($start))->modify('+'.$duration.' minutes')->format('Y-m-d H:i:s');
    $score=kareta_dispatch_score_master_for_order($pdo,$masterId,$order);
    if(empty($score['eligible']))kareta_sto_pair_reject($pdo,['ok'=>false,'error'=>'master_ineligible','reason'=>$score['eligibilityReason']??'master_unavailable'],409);
    $newMaster=(string)($order['master_id']??'')!==$masterId;
    if($newMaster){$quota=kareta_tariff_master_guard($pdo,$masterId,substr($start,0,10),$orderId,false);if(empty($quota['canAccept']))kareta_sto_pair_reject($pdo,['ok'=>false,'error'=>'tariff_limit_reached'],409);}
    $conf=kareta_sto_pair_interval_conflicts($pdo,$stoId,$masterId,$bayId,$orderId,$start,$end,true);
    if($conf)kareta_sto_pair_reject($pdo,['ok'=>false,'error'=>'assignment_interval_conflict','conflicts'=>$conf],409);
    $lock=$pdo->prepare("SELECT id,master_id FROM orders WHERE BINARY id=BINARY ? AND BINARY sto_id=BINARY ? LIMIT 1 FOR UPDATE");$lock->execute([$orderId,$stoId]);$locked=$lock->fetch(PDO::FETCH_ASSOC);if(!$locked){$pdo->rollBack();kareta_sto_pair_reject($pdo,['ok'=>false,'error'=>'order_not_found'],404);}$pdo->prepare("UPDATE orders SET master_id=?,master_user_id=?,master_name=?,date=?,time=?,accepted_at=COALESCE(accepted_at,NOW()) WHERE BINARY id=BINARY ? AND BINARY sto_id=BINARY ?")->execute([$masterId,(int)($master['user_id']??0)?:null,(string)$master['name'],substr($start,0,10),substr($start,11,5),$orderId,$stoId]);if($newMaster)kareta_tariff_record_master_acceptance($pdo,$masterId,$orderId,date('Y-m-d'),'sto_capacity_assign_pair');
      if(kareta_table_exists($pdo,'master_order_plans')){if($plan)$pdo->prepare("UPDATE master_order_plans SET master_id=?,planned_start=?,planned_end=?,status=IF(status IN ('done','completed'),status,'planned'),source='sto_command_pair',updated_at=NOW() WHERE BINARY order_id=BINARY ?")->execute([$masterId,$start,$end,$orderId]);else{$pid='mop_'.bin2hex(random_bytes(8));$pdo->prepare("INSERT INTO master_order_plans(id,order_id,master_id,planned_start,planned_end,estimated_repair_min,buffer_min,status,source) VALUES(?,?,?,?,?,?,0,'planned','sto_command_pair')")->execute([$pid,$orderId,$masterId,$start,$end,$duration]);}}
      $q=$pdo->prepare("SELECT id FROM sto_bay_assignments WHERE BINARY order_id=BINARY ? LIMIT 1");$q->execute([$orderId]);$aid=(string)($q->fetchColumn()?:'');if($aid!=='')$pdo->prepare("UPDATE sto_bay_assignments SET sto_id=?,bay_id=?,master_id=?,status='planned',planned_start=?,planned_end=?,estimated_minutes=?,updated_at=NOW() WHERE BINARY id=BINARY ?")->execute([$stoId,$bayId,$masterId,$start,$end,$duration,$aid]);else{$aid='sba_'.bin2hex(random_bytes(8));$pdo->prepare("INSERT INTO sto_bay_assignments(id,sto_id,bay_id,order_id,master_id,status,planned_start,planned_end,estimated_minutes,priority_score) VALUES(?,?,?,?,?,'planned',?,?,?,0)")->execute([$aid,$stoId,$bayId,$orderId,$masterId,$start,$end,$duration]);}$pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    if(function_exists('kareta_log_audit'))kareta_log_audit($pdo,'sto.capacity.assign_pair',['stoId'=>$stoId,'orderId'=>$orderId,'masterId'=>$masterId,'bayId'=>$bayId,'plannedStart'=>$start]);kareta_json(['ok'=>true,'orderId'=>$orderId,'masterId'=>$masterId,'masterName'=>(string)$master['name'],'bayId'=>$bayId,'bayName'=>(string)$bay['name'],'plannedStart'=>$start,'plannedEnd'=>$end]);
}

function kareta_sto_capacity_incident_preview_data(PDO $pdo,string $stoId,string $laneType,string $laneId,string $start,string $end): array {
    $items=[];$summary=['affected'=>0,'safe'=>0,'blocked'=>0];if(!in_array($laneType,['master','bay'],true))return ['items'=>[],'summary'=>$summary];
    $field=$laneType==='master'?'a.master_id':'a.bay_id';$q=$pdo->prepare("SELECT a.order_id,a.master_id,a.bay_id,a.planned_start,a.planned_end,o.vehicle_title,o.client_car,o.service_names,o.sto_id FROM sto_bay_assignments a JOIN orders o ON BINARY o.id=BINARY a.order_id WHERE BINARY a.sto_id=BINARY ? AND BINARY $field=BINARY ? AND a.status IN ('planned','active') AND a.planned_start<? AND a.planned_end>? ORDER BY a.planned_start");$q->execute([$stoId,$laneId,$end,$start]);
    foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r){$summary['affected']++;$orderId=(string)$r['order_id'];$masterId=(string)$r['master_id'];$candidate=null;
      if($laneType==='bay'){$bay=kareta_sto_find_available_bay($pdo,$stoId,$orderId,(string)$r['planned_start'],(string)$r['planned_end'],$laneId);if(!empty($bay['available']))$candidate=['orderId'=>$orderId,'masterId'=>$masterId,'candidateStart'=>(string)$r['planned_start'],'candidateEnd'=>(string)$r['planned_end'],'bay'=>array_merge(['required'=>true,'changed'=>true],$bay),'durationMin'=>max(15,(int)(((strtotime((string)$r['planned_end'])?:0)-(strtotime((string)$r['planned_start'])?:0))/60)),'bufferMin'=>0];}
      else{$order=$r;$order['id']=$orderId;$order['estimated_duration_min']=max(30,(int)(((strtotime((string)$r['planned_end'])?:0)-(strtotime((string)$r['planned_start'])?:0))/60));$slots=function_exists('kareta_master_schedule_free_slots_for_order')?(kareta_master_schedule_free_slots_for_order($pdo,$masterId,$order,14)['slots']??[]):[];foreach($slots as $slot){$ss=(string)($slot['start']??'');$se=(string)($slot['end']??'');if($ss===''||$se===''||($ss<$end&&$se>$start))continue;$bay=kareta_master_recovery_bay_candidate($pdo,$orderId,$stoId,$ss,$se);if(empty($bay['available']))continue;$candidate=['orderId'=>$orderId,'masterId'=>$masterId,'candidateStart'=>$ss,'candidateEnd'=>$se,'bay'=>$bay,'durationMin'=>max(15,(int)($slot['workMinutes']??$order['estimated_duration_min'])),'bufferMin'=>max(0,(int)($slot['bufferMin']??0))];break;}}
      $safe=$candidate!==null;if($safe)$summary['safe']++;else $summary['blocked']++;$items[]=['orderId'=>$orderId,'masterId'=>$masterId,'bayId'=>(string)$r['bay_id'],'vehicleTitle'=>(string)($r['vehicle_title']??$r['client_car']??'Автомобиль'),'serviceNames'=>(string)($r['service_names']??''),'oldStart'=>(string)$r['planned_start'],'oldEnd'=>(string)$r['planned_end'],'safe'=>$safe,'candidate'=>$candidate,'status'=>$safe?'safe':'blocked'];}
    return ['items'=>$items,'summary'=>$summary,'laneType'=>$laneType,'laneId'=>$laneId,'startsAt'=>$start,'endsAt'=>$end,'generatedAt'=>date(DATE_ATOM)];
}

function kareta_sto_capacity_incident_preview(PDO $pdo,array $body): void {
    $sto=kareta_sto_workplace_profile($pdo);$stoId=(string)$sto['id'];$type=strtolower(trim((string)($body['laneType']??'')));$id=trim((string)($body['laneId']??''));$start=trim((string)($body['startsAt']??''));$end=trim((string)($body['endsAt']??''));if(!in_array($type,['master','bay'],true)||$id===''||strtotime($start)===false||strtotime($end)===false||strtotime($end)<=strtotime($start))kareta_json(['ok'=>false,'error'=>'invalid_incident'],422);kareta_json(['ok'=>true,'preview'=>kareta_sto_capacity_incident_preview_data($pdo,$stoId,$type,$id,$start,$end)]);
}

function kareta_sto_capacity_incident_apply(PDO $pdo,array $body): void {
    if(!kareta_table_exists($pdo,'sto_capacity_incidents'))kareta_json(['ok'=>false,'error'=>'migration_required','message'=>'Требуется миграция БД 127.'],503);$sto=kareta_sto_workplace_profile($pdo);$stoId=(string)$sto['id'];$type=strtolower(trim((string)($body['laneType']??'')));$id=trim((string)($body['laneId']??''));$start=trim((string)($body['startsAt']??''));$end=trim((string)($body['endsAt']??''));$reason=mb_substr(trim((string)($body['reason']??'Изменение мощности СТО')),0,191);$autoMove=!empty($body['autoMove']);$notify=!array_key_exists('notify',$body)||!empty($body['notify']);if(!in_array($type,['master','bay'],true)||$id===''||strtotime($start)===false||strtotime($end)===false||strtotime($end)<=strtotime($start))kareta_json(['ok'=>false,'error'=>'invalid_incident'],422);
    if($type==='master'){$q=$pdo->prepare("SELECT COUNT(*) FROM sto_master_links WHERE BINARY sto_id=BINARY ? AND BINARY master_id=BINARY ? AND status='active'");$q->execute([$stoId,$id]);if((int)$q->fetchColumn()!==1)kareta_json(['ok'=>false,'error'=>'master_scope_forbidden'],404);}else{$q=$pdo->prepare("SELECT COUNT(*) FROM sto_service_bays WHERE BINARY sto_id=BINARY ? AND BINARY id=BINARY ? AND active=1");$q->execute([$stoId,$id]);if((int)$q->fetchColumn()!==1)kareta_json(['ok'=>false,'error'=>'bay_not_found'],404);}
    $preview=kareta_sto_capacity_incident_preview_data($pdo,$stoId,$type,$id,$start,$end);$uid=(int)(kareta_session_user()['id']??0)?:null;$incidentId='sci_'.bin2hex(random_bytes(10));$q=$pdo->prepare("INSERT INTO sto_capacity_incidents(id,sto_id,lane_type,lane_id,starts_at,ends_at,reason,status,created_by_user_id) VALUES(?,?,?,?,?,?,?,'active',?)");$q->execute([$incidentId,$stoId,$type,$id,$start,$end,$reason,$uid]);
    if($type==='master'&&kareta_table_exists($pdo,'master_schedule_blocks')){$from=new DateTimeImmutable($start);$to=new DateTimeImmutable($end);$cursor=$from->setTime(0,0);$last=$to->setTime(0,0);while($cursor<=$last){$date=$cursor->format('Y-m-d');$s=$date===$from->format('Y-m-d')?$from->format('H:i'):'00:00';$e=$date===$to->format('Y-m-d')?$to->format('H:i'):'23:59';if($e>$s){$bid='msb_'.substr(hash('sha256','sto|'.$incidentId.'|'.$date),0,24);$pdo->prepare("INSERT INTO master_schedule_blocks(id,master_id,block_date,start_time,end_time,block_type,note,active,created_by_user_id) VALUES(?,?,?,?,?,'technical',?,1,?) ON DUPLICATE KEY UPDATE active=1,note=VALUES(note),updated_at=CURRENT_TIMESTAMP")->execute([$bid,$id,$date,$s,$e,'СТО#'.$incidentId.': '.$reason,$uid]);}$cursor=$cursor->modify('+1 day');}}
    $moved=0;$notified=0;$results=[];if($autoMove){foreach($preview['items'] as $item){$candidate=$item['candidate']??null;if(!$candidate||empty($item['safe'])){$results[]=['orderId'=>$item['orderId'],'status'=>'blocked'];continue;}$r=kareta_master_recovery_apply_one($pdo,(string)$candidate['masterId'],$candidate,$notify);$results[]=$r;if(($r['status']??'')==='moved'){$moved++;$notified+=(int)($r['notified']??0);}}}
    if(function_exists('kareta_log_audit'))kareta_log_audit($pdo,'sto.capacity.incident.apply',['stoId'=>$stoId,'incidentId'=>$incidentId,'laneType'=>$type,'laneId'=>$id,'affected'=>$preview['summary']['affected'],'moved'=>$moved]);kareta_json(['ok'=>true,'incident'=>['id'=>$incidentId,'laneType'=>$type,'laneId'=>$id,'startsAt'=>$start,'endsAt'=>$end,'reason'=>$reason],'preview'=>$preview,'recovery'=>['movedCount'=>$moved,'notifiedCount'=>$notified,'items'=>$results]]);
}

function kareta_sto_capacity_incident_resolve(PDO $pdo,array $body): void {
    $sto=kareta_sto_workplace_profile($pdo);$stoId=(string)$sto['id'];$id=trim((string)($body['id']??''));if($id==='')kareta_json(['ok'=>false,'error'=>'id_required'],422);$q=$pdo->prepare("SELECT lane_type,lane_id FROM sto_capacity_incidents WHERE BINARY id=BINARY ? AND BINARY sto_id=BINARY ? AND status='active' LIMIT 1");$q->execute([$id,$stoId]);$r=$q->fetch(PDO::FETCH_ASSOC);if(!$r)kareta_json(['ok'=>false,'error'=>'incident_not_found'],404);$uid=(int)(kareta_session_user()['id']??0)?:null;$pdo->prepare("UPDATE sto_capacity_incidents SET status='resolved',resolved_by_user_id=?,resolved_at=NOW(),updated_at=CURRENT_TIMESTAMP WHERE BINARY id=BINARY ? AND BINARY sto_id=BINARY ?")->execute([$uid,$id,$stoId]);if((string)$r['lane_type']==='master'&&kareta_table_exists($pdo,'master_schedule_blocks'))$pdo->prepare("UPDATE master_schedule_blocks SET active=0,updated_at=CURRENT_TIMESTAMP WHERE BINARY master_id=BINARY ? AND note LIKE ? AND active=1")->execute([(string)$r['lane_id'],'СТО#'.$id.':%']);kareta_json(['ok'=>true,'id'=>$id]);
}

function kareta_sto_recovery_preview_data(PDO $pdo,string $stoId): array {
    $items=[];$summary=['conflicts'=>0,'safe'=>0,'protected'=>0,'blocked'=>0,'tariffBlocked'=>0,'bayBlocked'=>0,'unresolved'=>0];
    if(!function_exists('kareta_master_recovery_preview_data'))return ['items'=>$items,'summary'=>$summary,'generatedAt'=>date(DATE_ATOM)];
    foreach(kareta_sto_linked_master_rows($pdo,$stoId) as $master){
        $masterId=(string)($master['id']??'');if($masterId==='')continue;
        $preview=kareta_master_recovery_preview_data($pdo,$masterId,'sto_control_center','');
        foreach($preview['items']??[] as $item){
            if((string)($item['stoId']??'')!==$stoId)continue;
            $item['masterId']=$masterId;$item['masterName']=(string)($master['name']??'Мастер');$items[]=$item;$summary['conflicts']++;
            $status=(string)($item['status']??'');
            if(!empty($item['safe']))$summary['safe']++;
            elseif($status==='protected'||!empty($item['protected']))$summary['protected']++;
            else $summary['blocked']++;
            if($status==='tariff_blocked')$summary['tariffBlocked']++;
            if($status==='bay_blocked')$summary['bayBlocked']++;
            if($status==='unresolved')$summary['unresolved']++;
        }
    }
    usort($items,static fn($a,$b)=>strcmp((string)($a['oldStart']??''),(string)($b['oldStart']??'')));
    return ['items'=>$items,'summary'=>$summary,'generatedAt'=>date(DATE_ATOM)];
}

function kareta_sto_recovery_notification_history(PDO $pdo,string $stoId,int $limit=24): array {
    if(!kareta_table_exists($pdo,'notifications'))return [];
    $limit=max(1,min(60,$limit));
    $q=$pdo->prepare("SELECT n.id,n.entity_id,n.title,n.body,n.is_read,n.read_at,n.created_at,n.action_url,o.master_id,o.master_name,o.vehicle_title,o.client_car FROM notifications n JOIN orders o ON BINARY o.id=BINARY n.entity_id WHERE BINARY o.sto_id=BINARY ? AND n.event_type IN ('order.schedule.auto_rescheduled','order.schedule.auto_rescheduled.resend') ORDER BY n.created_at DESC LIMIT $limit");
    $q->execute([$stoId]);$out=[];
    foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r)$out[]=['id'=>(int)$r['id'],'orderId'=>(string)$r['entity_id'],'title'=>(string)$r['title'],'body'=>(string)$r['body'],'isRead'=>!empty($r['is_read']),'readAt'=>(string)($r['read_at']??''),'createdAt'=>(string)$r['created_at'],'actionUrl'=>(string)$r['action_url'],'masterId'=>(string)($r['master_id']??''),'masterName'=>(string)($r['master_name']??''),'vehicleTitle'=>(string)($r['vehicle_title']??$r['client_car']??'Автомобиль')];
    return $out;
}

function kareta_sto_joint_schedule(PDO $pdo,string $stoId,int $days=7): array {
    if(!kareta_table_exists($pdo,'sto_bay_assignments'))return [];$days=max(1,min(31,$days));
    $startExpr=kareta_column_exists($pdo,'sto_bay_assignments','planned_start')?'COALESCE(a.planned_start,a.started_at)':'a.started_at';
    $endExpr=kareta_column_exists($pdo,'sto_bay_assignments','planned_end')?'COALESCE(a.planned_end,DATE_ADD(COALESCE(a.started_at,NOW()),INTERVAL 120 MINUTE))':'DATE_ADD(COALESCE(a.started_at,NOW()),INTERVAL 120 MINUTE)';
    $until=(new DateTimeImmutable('today'))->modify('+'.$days.' days')->format('Y-m-d H:i:s');
    $q=$pdo->prepare("SELECT a.order_id,a.master_id,a.bay_id,a.status assignment_status,$startExpr planned_start,$endExpr planned_end,b.name bay_name,b.code bay_code,o.status order_status,o.vehicle_title,o.client_car,o.service_names,o.master_name,m.name linked_master_name FROM sto_bay_assignments a JOIN orders o ON BINARY o.id=BINARY a.order_id LEFT JOIN sto_service_bays b ON BINARY b.id=BINARY a.bay_id LEFT JOIN masters m ON BINARY m.id=BINARY a.master_id WHERE BINARY a.sto_id=BINARY ? AND a.status IN ('planned','active') AND COALESCE($endExpr,NOW())>=CURDATE() AND COALESCE($startExpr,NOW())<? ORDER BY COALESCE($startExpr,a.started_at),b.sort_order,b.name");
    $q->execute([$stoId,$until]);$out=[];
    foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r)$out[]=['orderId'=>(string)$r['order_id'],'masterId'=>(string)($r['master_id']??''),'masterName'=>(string)($r['linked_master_name']??$r['master_name']??'Мастер'),'bayId'=>(string)($r['bay_id']??''),'bayName'=>(string)($r['bay_name']??$r['bay_code']??'Бокс'),'plannedStart'=>(string)($r['planned_start']??''),'plannedEnd'=>(string)($r['planned_end']??''),'assignmentStatus'=>(string)($r['assignment_status']??''),'orderStatus'=>(string)($r['order_status']??''),'vehicleTitle'=>(string)($r['vehicle_title']??$r['client_car']??'Автомобиль'),'serviceNames'=>(string)($r['service_names']??'')];
    return $out;
}

function kareta_sto_order_master_candidates(PDO $pdo,array $body): void {
    $sto=kareta_sto_workplace_profile($pdo);$stoId=(string)$sto['id'];$orderId=trim((string)($body['orderId']??''));if($orderId==='')kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    $q=$pdo->prepare("SELECT * FROM orders WHERE BINARY id=BINARY ? AND BINARY sto_id=BINARY ? LIMIT 1");$q->execute([$orderId,$stoId]);$order=$q->fetch(PDO::FETCH_ASSOC);if(!$order)kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    $items=[];foreach(kareta_sto_linked_master_rows($pdo,$stoId) as $master){$mid=(string)$master['id'];$score=function_exists('kareta_dispatch_score_master_for_order')?kareta_dispatch_score_master_for_order($pdo,$mid,$order):['score'=>0,'eligible'=>true,'loadPct'=>0,'etaStart'=>'','serviceMatch'=>0,'tariffBlocked'=>false];$tariff=$score['tariff']??null;$blocked=!empty($score['tariffBlocked']);$serviceMatch=(int)($score['serviceMatch']??0);$reason=$blocked?'Лимит тарифа исчерпан':($serviceMatch<=0?'Вне выбранных услуг Мастера':(!empty($score['overloaded'])?'Высокая текущая загрузка':'Доступен для назначения'));$items[]=['id'=>$mid,'name'=>(string)($master['name']??'Мастер'),'spec'=>(string)($master['spec']??''),'rating'=>(float)($master['rating']??0),'score'=>(float)($score['score']??0),'serviceMatch'=>$serviceMatch,'loadPct'=>(float)($score['loadPct']??0),'etaStart'=>(string)($score['etaStart']??''),'overloaded'=>!empty($score['overloaded']),'tariffBlocked'=>$blocked,'assignable'=>!$blocked,'reason'=>$reason,'tariff'=>$tariff];}
    usort($items,static fn($a,$b)=>((int)$b['assignable']<=>(int)$a['assignable'])?:((float)$b['score']<=>(float)$a['score'])?:((float)$a['loadPct']<=>(float)$b['loadPct']));
    kareta_json(['ok'=>true,'data'=>['orderId'=>$orderId,'currentMasterId'=>(string)($order['master_id']??''),'items'=>$items]]);
}

function kareta_sto_order_bay_candidates(PDO $pdo,array $body): void {
    $sto=kareta_sto_workplace_profile($pdo);$stoId=(string)$sto['id'];$orderId=trim((string)($body['orderId']??''));if($orderId==='')kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    $q=$pdo->prepare("SELECT id,master_id,`date`,`time`,estimated_duration_min FROM orders WHERE BINARY id=BINARY ? AND BINARY sto_id=BINARY ? LIMIT 1");$q->execute([$orderId,$stoId]);$order=$q->fetch(PDO::FETCH_ASSOC);if(!$order)kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    $start='';$end='';if(kareta_table_exists($pdo,'master_order_plans')){$p=$pdo->prepare("SELECT planned_start,planned_end FROM master_order_plans WHERE BINARY order_id=BINARY ? LIMIT 1");$p->execute([$orderId]);$plan=$p->fetch(PDO::FETCH_ASSOC)?:[];$start=(string)($plan['planned_start']??'');$end=(string)($plan['planned_end']??'');}
    if($start===''){$date=preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)($order['date']??''))?(string)$order['date']:date('Y-m-d');$time=preg_match('/^\d{2}:\d{2}/',(string)($order['time']??''))?substr((string)$order['time'],0,5):date('H:i');$start=$date.' '.$time.':00';}
    if($end===''){$duration=max(30,(int)($order['estimated_duration_min']??120));$end=(new DateTimeImmutable($start))->modify('+'.$duration.' minutes')->format('Y-m-d H:i:s');}
    $current='';if(kareta_table_exists($pdo,'sto_bay_assignments')){$c=$pdo->prepare("SELECT bay_id FROM sto_bay_assignments WHERE BINARY order_id=BINARY ? AND status IN ('planned','active') LIMIT 1");$c->execute([$orderId]);$current=(string)($c->fetchColumn()?:'');}
    $q=$pdo->prepare("SELECT id,name,code,capacity,sort_order FROM sto_service_bays WHERE BINARY sto_id=BINARY ? AND active=1 ORDER BY sort_order,name");$q->execute([$stoId]);$items=[];
    foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $bay){$bid=(string)$bay['id'];$conflicts=0;$booked=0;if(kareta_table_exists($pdo,'sto_bay_assignments')&&kareta_column_exists($pdo,'sto_bay_assignments','planned_start')&&kareta_column_exists($pdo,'sto_bay_assignments','planned_end')){$cq=$pdo->prepare("SELECT COUNT(*) FROM sto_bay_assignments WHERE BINARY bay_id=BINARY ? AND BINARY order_id<>BINARY ? AND status IN ('planned','active') AND planned_start<? AND planned_end>?");$cq->execute([$bid,$orderId,$end,$start]);$conflicts=(int)$cq->fetchColumn();$bq=$pdo->prepare("SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE,planned_start,planned_end)),0) FROM sto_bay_assignments WHERE BINARY bay_id=BINARY ? AND status IN ('planned','active') AND DATE(planned_start)=DATE(?)");$bq->execute([$bid,$start]);$booked=(int)$bq->fetchColumn();}else{$cq=$pdo->prepare("SELECT COUNT(*) FROM sto_bay_assignments WHERE BINARY bay_id=BINARY ? AND BINARY order_id<>BINARY ? AND status='active'");$cq->execute([$bid,$orderId]);$conflicts=(int)$cq->fetchColumn();}
        $conflicts+=kareta_sto_bay_incident_conflicts($pdo,$stoId,$bid,$start,$end);
        $capacity=max(60,(int)($bay['capacity']??1)*480);$loadPct=round($booked*100/$capacity,1);$items[]=['id'=>$bid,'name'=>(string)($bay['name']??$bay['code']??'Бокс'),'code'=>(string)($bay['code']??''),'available'=>$conflicts===0,'conflicts'=>$conflicts,'bookedMinutes'=>$booked,'capacityMinutes'=>$capacity,'loadPct'=>$loadPct,'current'=>$bid===$current,'reason'=>$conflicts===0?'Свободен для выбранного окна':'Занят в выбранное время'];}
    usort($items,static fn($a,$b)=>((int)$b['available']<=>(int)$a['available'])?:((float)$a['loadPct']<=>(float)$b['loadPct']));
    kareta_json(['ok'=>true,'data'=>['orderId'=>$orderId,'plannedStart'=>$start,'plannedEnd'=>$end,'items'=>$items]]);
}

function kareta_sto_recovery_preview(PDO $pdo,array $body): void {$sto=kareta_sto_workplace_profile($pdo);$stoId=(string)$sto['id'];kareta_json(['ok'=>true,'preview'=>kareta_sto_recovery_preview_data($pdo,$stoId)]);}

function kareta_sto_recovery_apply(PDO $pdo,array $body): void {
    $sto=kareta_sto_workplace_profile($pdo);$stoId=(string)$sto['id'];$ids=is_array($body['orderIds']??null)?array_values(array_unique(array_filter(array_map('strval',$body['orderIds'])))):[];$notify=!array_key_exists('notify',$body)||!empty($body['notify']);$preview=kareta_sto_recovery_preview_data($pdo,$stoId);$map=[];foreach($preview['items'] as $item)if(!empty($item['safe']))$map[(string)$item['orderId']]=$item;if(!$ids)$ids=array_keys($map);$results=[];$moved=0;$notified=0;
    foreach($ids as $id){if(!isset($map[$id])){$results[]=['orderId'=>$id,'status'=>'not_safe'];continue;}$candidate=$map[$id];$masterId=(string)($candidate['masterId']??'');if($masterId===''){$results[]=['orderId'=>$id,'status'=>'master_missing'];continue;}$q=$pdo->prepare("SELECT COUNT(*) FROM orders o JOIN sto_master_links l ON BINARY l.master_id=BINARY o.master_id AND BINARY l.sto_id=BINARY o.sto_id AND l.status='active' WHERE BINARY o.id=BINARY ? AND BINARY o.sto_id=BINARY ? AND BINARY o.master_id=BINARY ?");$q->execute([$id,$stoId,$masterId]);if((int)$q->fetchColumn()!==1){$results[]=['orderId'=>$id,'status'=>'scope_blocked'];continue;}$r=kareta_master_recovery_apply_one($pdo,$masterId,$candidate,$notify);$results[]=$r;if(($r['status']??'')==='moved'){$moved++;$notified+=(int)($r['notified']??0);}}
    if(function_exists('kareta_log_audit'))kareta_log_audit($pdo,'sto.recovery.apply',['stoId'=>$stoId,'orderIds'=>$ids,'moved'=>$moved,'notified'=>$notified]);kareta_json(['ok'=>true,'recovery'=>['movedCount'=>$moved,'notifiedCount'=>$notified,'items'=>$results,'generatedAt'=>date(DATE_ATOM)]]);
}

function kareta_sto_recovery_protect(PDO $pdo,array $body): void {
    if(!kareta_column_exists($pdo,'master_order_plans','auto_recovery_protected'))kareta_json(['ok'=>false,'error'=>'migration_required'],503);$sto=kareta_sto_workplace_profile($pdo);$stoId=(string)$sto['id'];$orderId=trim((string)($body['orderId']??''));$protected=!empty($body['protected']);if($orderId==='')kareta_json(['ok'=>false,'error'=>'order_id_required'],422);$q=$pdo->prepare("SELECT o.master_id FROM orders o JOIN sto_master_links l ON BINARY l.master_id=BINARY o.master_id AND BINARY l.sto_id=BINARY o.sto_id AND l.status='active' WHERE BINARY o.id=BINARY ? AND BINARY o.sto_id=BINARY ? LIMIT 1");$q->execute([$orderId,$stoId]);$mid=(string)($q->fetchColumn()?:'');if($mid==='')kareta_json(['ok'=>false,'error'=>'order_scope_forbidden'],404);$uid=(int)(kareta_session_user()['id']??0)?:null;$q=$pdo->prepare("UPDATE master_order_plans SET auto_recovery_protected=?,auto_recovery_protected_at=?,auto_recovery_protected_by_user_id=?,updated_at=NOW() WHERE BINARY order_id=BINARY ? AND BINARY master_id=BINARY ?");$q->execute([$protected?1:0,$protected?date('Y-m-d H:i:s'):null,$protected?$uid:null,$orderId,$mid]);if($q->rowCount()===0)kareta_json(['ok'=>false,'error'=>'order_plan_not_found'],404);kareta_json(['ok'=>true,'orderId'=>$orderId,'protected'=>$protected]);
}

function kareta_sto_recovery_notify_resend(PDO $pdo,array $body): void {
    $sto=kareta_sto_workplace_profile($pdo);$stoId=(string)$sto['id'];$orderId=trim((string)($body['orderId']??''));if($orderId==='')kareta_json(['ok'=>false,'error'=>'order_id_required'],422);$q=$pdo->prepare("SELECT o.*,(SELECT c.id FROM chats c WHERE BINARY c.order_id=BINARY o.id ORDER BY c.created_at DESC LIMIT 1) chat_id FROM orders o WHERE BINARY o.id=BINARY ? AND BINARY o.sto_id=BINARY ? LIMIT 1");$q->execute([$orderId,$stoId]);$order=$q->fetch(PDO::FETCH_ASSOC);if(!$order)kareta_json(['ok'=>false,'error'=>'order_not_found'],404);$q=$pdo->prepare("SELECT planned_start FROM master_order_plans WHERE BINARY order_id=BINARY ? LIMIT 1");$q->execute([$orderId]);$start=(string)($q->fetchColumn()?:'');$human=$start;try{$human=(new DateTimeImmutable($start))->format('d.m.Y H:i');}catch(Throwable $_){}$chatId=(string)($order['chat_id']??'');$text='СТО напоминает: актуальное время записи — '.$human.'.';if(function_exists('kareta_master_schedule_write_system_message'))kareta_master_schedule_write_system_message($pdo,$orderId,$chatId,$text,'sto-recovery-resend|'.microtime(true));if(function_exists('kareta_notification_insert'))kareta_notification_insert($pdo,['recipientUserId'=>(int)($order['client_user_id']??0)?:null,'recipientPhone'=>(string)($order['client_phone']??''),'recipientRole'=>'client','eventType'=>'order.schedule.auto_rescheduled.resend','entityType'=>'order','entityId'=>$orderId,'title'=>'Напоминание от СТО о времени записи','body'=>$human,'actionUrl'=>'#/orders/item/'.rawurlencode($orderId),'meta'=>['orderId'=>$orderId,'chatId'=>$chatId,'plannedStart'=>$start,'manualResend'=>true,'stoId'=>$stoId]]);kareta_json(['ok'=>true,'orderId'=>$orderId,'plannedStart'=>$start]);
}

