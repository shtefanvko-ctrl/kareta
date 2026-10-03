<?php
declare(strict_types=1);

function kareta_dispatch_valid_coords(?float $lat,?float $lng): bool {
    return $lat!==null&&$lng!==null&&is_finite($lat)&&is_finite($lng)&&$lat>=-90.0&&$lat<=90.0&&$lng>=-180.0&&$lng<=180.0;
}
function kareta_dispatch_distance_km(?float $lat1, ?float $lng1, ?float $lat2, ?float $lng2): ?float {
    if (!kareta_dispatch_valid_coords($lat1,$lng1)||!kareta_dispatch_valid_coords($lat2,$lng2)) return null;
    $r=6371.0; $dLat=deg2rad($lat2-$lat1); $dLng=deg2rad($lng2-$lng1);
    $a=sin($dLat/2)**2+cos(deg2rad($lat1))*cos(deg2rad($lat2))*sin($dLng/2)**2;
    return round($r*2*atan2(sqrt($a),sqrt(max(0,1-$a))),1);
}

function kareta_dispatch_master_origin(PDO $pdo,string $masterId,array $masterRow=[]): ?array {
    $m=$masterRow?:kareta_dispatch_master_row($pdo,$masterId);
    $mode=strtolower(trim((string)($m['work_mode']??'shop')));
    if(kareta_table_exists($pdo,'geo_points')){
        $preferred=$mode==='mobile'?['mobile_origin','service']:($mode==='both'?['mobile_origin','service']:['service','mobile_origin']);
        $q=$pdo->prepare("SELECT kind,latitude,longitude FROM geo_points WHERE owner_type='master' AND BINARY owner_id=BINARY ? AND active=1 AND latitude IS NOT NULL AND longitude IS NOT NULL");
        $q->execute([$masterId]);$rows=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
        foreach($preferred as $kind)foreach($rows as $row){if((string)($row['kind']??'')!==$kind)continue;$lat=(float)$row['latitude'];$lng=(float)$row['longitude'];if(kareta_dispatch_valid_coords($lat,$lng))return ['lat'=>$lat,'lng'=>$lng,'kind'=>$kind];}
    }
    $lat=isset($m['service_lat'])&&$m['service_lat']!==null?(float)$m['service_lat']:null;$lng=isset($m['service_lng'])&&$m['service_lng']!==null?(float)$m['service_lng']:null;
    return kareta_dispatch_valid_coords($lat,$lng)?['lat'=>$lat,'lng'=>$lng,'kind'=>'legacy_service']:null;
}
function kareta_dispatch_request_point(array $order): ?array {
    $lat=isset($order['lat'])&&$order['lat']!==null&&$order['lat']!==''?(float)$order['lat']:null;$lng=isset($order['lng'])&&$order['lng']!==null&&$order['lng']!==''?(float)$order['lng']:null;
    return kareta_dispatch_valid_coords($lat,$lng)?['lat'=>$lat,'lng'=>$lng]:null;
}
function kareta_dispatch_master_order_distance(PDO $pdo,string $masterId,array $order,array $masterRow=[]): ?float {
    $origin=kareta_dispatch_master_origin($pdo,$masterId,$masterRow);$point=kareta_dispatch_request_point($order);
    if(!$origin||!$point)return null;
    return kareta_dispatch_distance_km((float)$origin['lat'],(float)$origin['lng'],(float)$point['lat'],(float)$point['lng']);
}
function kareta_master_exchange_safe_notes(string $notes): string {
    $lines=preg_split('/\R/u',$notes)?:[];
    $safe=array_values(array_filter($lines,static fn($line)=>!preg_match('/^\s*(?:Адрес|Address)\s*:/ui',(string)$line)));
    return trim(implode("\n",$safe));
}
function kareta_master_exchange_sanitize_geo(array $item,?float $distance,bool $revealExact=false): array {
    $item['notes']=kareta_master_exchange_safe_notes((string)($item['notes']??''));
    if($revealExact)return $item;
    $item['geo']=[
        'hasPoint'=>$distance!==null,
        'distanceKm'=>$distance,
        'distanceMode'=>'straight_line',
        'precision'=>'hidden',
    ];
    return $item;
}

function kareta_dispatch_master_settings(PDO $pdo,string $masterId): array {
    static $cache=[]; if(isset($cache[$masterId])) return $cache[$masterId];
    $defaults=['shiftCapacityMin'=>480,'maxConcurrentOrders'=>2,'responseSlaMin'=>20,'overloadThresholdPct'=>105,'preferredRadiusKm'=>30,'autoReassignEnabled'=>true];
    if(!kareta_table_exists($pdo,'master_dispatch_settings'))return $cache[$masterId]=$defaults;
    $s=$pdo->prepare("SELECT * FROM master_dispatch_settings WHERE master_id=? LIMIT 1");$s->execute([$masterId]);$r=$s->fetch(PDO::FETCH_ASSOC)?:[];
    return $cache[$masterId]=[
      'shiftCapacityMin'=>max(60,(int)($r['shift_capacity_min']??480)),
      'maxConcurrentOrders'=>max(1,(int)($r['max_concurrent_orders']??2)),
      'responseSlaMin'=>max(5,(int)($r['response_sla_min']??20)),
      'overloadThresholdPct'=>max(50,(int)($r['overload_threshold_pct']??105)),
      'preferredRadiusKm'=>max(0,(int)($r['preferred_radius_km']??30)),
      'autoReassignEnabled'=>(int)($r['auto_reassign_enabled']??1)===1,
    ];
}

function kareta_dispatch_master_load(PDO $pdo,string $masterId): array {
    static $cache=[]; if(isset($cache[$masterId])) return $cache[$masterId];
    $settings=kareta_dispatch_master_settings($pdo,$masterId);$capacity=$settings['shiftCapacityMin'];
    $activeStatuses=['accepted','assigned','process','in_progress','work','waiting_parts','waiting_approval','pending'];
    $ph=implode(',',array_fill(0,count($activeStatuses),'?'));$params=array_merge([$masterId],$activeStatuses);
    $durationExpr=kareta_column_exists($pdo,'orders','estimated_duration_min')?'GREATEST(30,COALESCE(estimated_duration_min,120))':'120';
    $rows=kareta_try_query_all($pdo,"SELECT COUNT(*) cnt,COALESCE(SUM($durationExpr),0) minutes FROM orders WHERE BINARY master_id=BINARY ? AND status IN ($ph)",$params,[],'MASTER_EXCHANGE_LOAD');
    $r=$rows[0]??[];
    $minutes=(int)($r['minutes']??0);$count=(int)($r['cnt']??0);
    $running=0;
    if(kareta_table_exists($pdo,'work_order_timers')&&kareta_column_exists($pdo,'work_order_timers','master_id')){
        $running=(int)kareta_try_query_value($pdo,"SELECT COUNT(*) FROM work_order_timers WHERE BINARY master_id=BINARY ? AND status='running'",[$masterId],0,'MASTER_EXCHANGE_RUNNING');
    }
    $loadPct=$capacity>0?round($minutes*100/$capacity,1):0;
    $etaStart=(new DateTimeImmutable('now'))->modify('+'.max(0,$minutes).' minutes');
    return $cache[$masterId]=['activeOrders'=>$count,'runningOrders'=>$running,'queuedMinutes'=>$minutes,'capacityMinutes'=>$capacity,'loadPct'=>$loadPct,'overloaded'=>$loadPct>$settings['overloadThresholdPct'],'etaStart'=>$etaStart->format('Y-m-d H:i:s'),'settings'=>$settings];
}

function kareta_dispatch_master_row(PDO $pdo,string $masterId): array {
    static $cache=[]; if(isset($cache[$masterId])) return $cache[$masterId];
    $rows=kareta_try_query_all($pdo,"SELECT * FROM masters WHERE BINARY id=BINARY ? LIMIT 1",[$masterId],[],'MASTER_EXCHANGE_MASTER_ROW');
    return $cache[$masterId]=$rows[0]??[];
}

function kareta_dispatch_service_match(PDO $pdo,string $masterId,array $order): float {
    static $offerCache=[];
    if(!kareta_table_exists($pdo,'service_offers'))return 0.0;
    $ids=json_decode((string)($order['service_ids']??'[]'),true);
    // Unknown requirements cannot establish eligibility for automatic dispatch.
    if(!is_array($ids)||!array_is_list($ids)||!$ids)return 0.0;
    foreach($ids as $id)if((!is_string($id)&&!is_int($id))||trim((string)$id)==='')return 0.0;
    $ids=array_values(array_unique(array_map(static fn($id)=>trim((string)$id),$ids)));
    if(!array_key_exists($masterId,$offerCache)){
        $where=["owner_type='master'","BINARY owner_entity_id=BINARY ?"];
        if(kareta_column_exists($pdo,'service_offers','active'))$where[]='active=1';
        if(kareta_column_exists($pdo,'service_offers','booking_enabled'))$where[]='booking_enabled=1';
        if(kareta_column_exists($pdo,'service_offers','availability_status'))$where[]="availability_status<>'paused'";
        if(kareta_column_exists($pdo,'service_offers','moderation_status'))$where[]="moderation_status='approved'";
        $rows=kareta_try_query_all($pdo,"SELECT service_id FROM service_offers WHERE ".implode(' AND ',$where),[$masterId],[],'MASTER_EXCHANGE_SERVICE_MATCH');
        $offerCache[$masterId]=array_flip(array_map(static fn($r)=>(string)($r['service_id']??''),$rows));
    }
    $matches=0;foreach($ids as $id)if(isset($offerCache[$masterId][$id]))$matches++;
    return min(1.0,$matches/max(1,count($ids)));
}

function kareta_dispatch_score_master_for_order(PDO $pdo,string $masterId,array $order): array {
    $m=kareta_dispatch_master_row($pdo,$masterId);if(!$m||!(int)($m['active']??1))return ['score'=>0,'eligible'=>false];
    $quota=null;$alreadyAssigned=trim((string)($order['master_id']??''))===$masterId;
    if(function_exists('kareta_tariff_master_usage')){
        $quotaDate=preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)($order['date']??''))?(string)$order['date']:date('Y-m-d');
        $quota=kareta_tariff_master_usage($pdo,$masterId,$quotaDate,(string)($order['id']??''));
        if(!$alreadyAssigned&&empty($quota['canAccept']))return ['score'=>0,'eligible'=>false,'tariffBlocked'=>true,'tariff'=>$quota,'blockedMetric'=>(string)($quota['blockedMetric']??'')];
    }
    $load=kareta_dispatch_master_load($pdo,$masterId);$settings=$load['settings'];$serviceMatch=kareta_dispatch_service_match($pdo,$masterId,$order);
    $distance=kareta_dispatch_master_order_distance($pdo,$masterId,$order,$m);
    $radius=max(1,(int)($m['service_radius_km']??0)?:$settings['preferredRadiusKm']);
    $distanceScore=$distance===null?0.65:max(0,1-($distance/max(1,$radius*1.5)));
    $rating=min(5,max(0,(float)($m['rating']??0)));$availability=in_array((string)($m['availability']??'online'),['online','available','free'],true)?1.0:0.55;
    $loadScore=max(0,1-min(1.25,(float)$load['loadPct']/100));
    $priority=in_array(strtolower((string)($order['priority']??'')),['urgent','high'],true)?8:0;
    $score=round($serviceMatch*35+$loadScore*25+($rating/5)*15+$distanceScore*12+$availability*8+$priority,1);
    if($load['overloaded'])$score=max(0,$score-18);
    $estimated=max(30,(int)($order['estimated_duration_min']??120));$etaStart=new DateTimeImmutable((string)$load['etaStart']);$etaEnd=$etaStart->modify('+'.$estimated.' minutes');
    $published=trim((string)($order['exchange_published_at']??$order['created_at']??''));$slaDue='';$slaState='ok';
    if($published!==''){try{$due=(new DateTimeImmutable($published))->modify('+'.$settings['responseSlaMin'].' minutes');$slaDue=$due->format('Y-m-d H:i:s');if($due<new DateTimeImmutable('now'))$slaState='breached';elseif($due<(new DateTimeImmutable('now'))->modify('+5 minutes'))$slaState='risk';}catch(Throwable $_){}}
    return ['score'=>$score,'eligible'=>$serviceMatch===1.0,'eligibilityReason'=>$serviceMatch===1.0?'services_covered':($serviceMatch>0?'services_incomplete':'services_unverified'),'serviceMatch'=>round($serviceMatch*100),'loadPct'=>$load['loadPct'],'overloaded'=>$load['overloaded'],'distanceKm'=>$distance,'distanceMode'=>'straight_line','requestPointAvailable'=>$distance!==null,'etaStart'=>$etaStart->format('Y-m-d H:i:s'),'etaEnd'=>$etaEnd->format('Y-m-d H:i:s'),'slaDueAt'=>$slaDue,'slaState'=>$slaState,'activeOrders'=>$load['activeOrders'],'capacityMinutes'=>$load['capacityMinutes'],'queuedMinutes'=>$load['queuedMinutes'],'masterName'=>(string)($m['name']??'Мастер'),'rating'=>$rating,'stoId'=>(string)($m['sto_id']??''),'tariffBlocked'=>false,'tariff'=>$quota];
}

function kareta_dispatch_rank_order(PDO $pdo,array $order,string $stoId=''): array {
    $sql="SELECT m.id FROM masters m";$params=[];$where=["COALESCE(m.active,1)=1"];
    if($stoId!==''){$sql.=" JOIN sto_master_links l ON BINARY l.master_id=BINARY m.id";$where[]="BINARY l.sto_id=BINARY ?";$where[]="l.status='active'";$params[]=$stoId;}
    $sql.=" WHERE ".implode(' AND ',$where)." ORDER BY m.rating DESC LIMIT 60";
    $s=$pdo->prepare($sql);$s->execute($params);$ids=$s->fetchAll(PDO::FETCH_COLUMN)?:[];$rank=[];
    foreach($ids as $id){$x=kareta_dispatch_score_master_for_order($pdo,(string)$id,$order);if(!empty($x['eligible']))$rank[]=array_merge(['masterId'=>(string)$id],$x);}
    usort($rank,static fn($a,$b)=>($b['score']<=>$a['score'])?:($a['loadPct']<=>$b['loadPct']));
    foreach($rank as $i=>&$r)$r['rank']=$i+1;unset($r);return $rank;
}

function kareta_dispatch_sto_settings(PDO $pdo,string $stoId): array {
    $d=['responseSlaMin'=>15,'overloadThresholdPct'=>100,'autoReassignEnabled'=>true,'reassignScoreDelta'=>12,'defaultJobMin'=>120];if(!kareta_table_exists($pdo,'sto_dispatch_settings'))return $d;
    $s=$pdo->prepare("SELECT * FROM sto_dispatch_settings WHERE BINARY sto_id=BINARY ? LIMIT 1");$s->execute([$stoId]);$r=$s->fetch(PDO::FETCH_ASSOC)?:[];
    return ['responseSlaMin'=>max(5,(int)($r['response_sla_min']??15)),'overloadThresholdPct'=>max(50,(int)($r['overload_threshold_pct']??100)),'autoReassignEnabled'=>(int)($r['auto_reassign_enabled']??1)===1,'reassignScoreDelta'=>max(1,(int)($r['reassign_score_delta']??12)),'defaultJobMin'=>max(30,(int)($r['default_job_min']??120))];
}

function kareta_dispatch_plan_order(PDO $pdo,string $stoId,string $orderId,string $masterId): array {
    if($stoId===''||$orderId===''||$masterId===''||!kareta_table_exists($pdo,'sto_service_bays'))return [];
    $s=$pdo->prepare("SELECT * FROM orders WHERE BINARY id=BINARY ? LIMIT 1");$s->execute([$orderId]);$order=$s->fetch(PDO::FETCH_ASSOC)?:[];if(!$order)return [];
    $estimated=max(30,(int)($order['estimated_duration_min']??120));
    $preferred=[];$fixed=false;
    if(kareta_table_exists($pdo,'master_order_plans')){
        $cols=kareta_column_exists($pdo,'master_order_plans','source')?',source,conflict_override':'';
        $pq=$pdo->prepare("SELECT planned_start,planned_end,estimated_repair_min{$cols} FROM master_order_plans WHERE BINARY order_id=BINARY ? AND BINARY master_id=BINARY ? LIMIT 1");$pq->execute([$orderId,$masterId]);$preferred=$pq->fetch(PDO::FETCH_ASSOC)?:[];
        // R66 compatibility marker: ['exchange_accept','master_adjustment']
        $source=(string)($preferred['source']??'');$fixed=in_array($source,['exchange_accept','master_adjustment','client_reschedule_accept'],true)&&!empty($preferred['planned_start'])&&!empty($preferred['planned_end']);
        if($fixed)$estimated=max(30,(int)($preferred['estimated_repair_min']??$estimated));
    }
    $q=$pdo->prepare("SELECT b.id,b.name,b.bay_type,b.slot_minutes,b.daily_capacity_min,MAX(CASE WHEN a.status IN ('planned','active') THEN a.planned_end ELSE NULL END) last_end FROM sto_service_bays b LEFT JOIN sto_bay_assignments a ON BINARY a.bay_id=BINARY b.id AND BINARY a.order_id<>BINARY ? WHERE BINARY b.sto_id=BINARY ? AND b.active=1 GROUP BY b.id,b.name,b.bay_type,b.slot_minutes,b.daily_capacity_min ORDER BY COALESCE(last_end,NOW()),b.sort_order,b.name");$q->execute([$orderId,$stoId]);$bays=$q->fetchAll(PDO::FETCH_ASSOC)?:[];if(!$bays)return [];
    $bay=$bays[0];
    if($fixed){
        $start=new DateTimeImmutable((string)$preferred['planned_start']);$end=new DateTimeImmutable((string)$preferred['planned_end']);
        foreach($bays as $candidate){
            $cq=$pdo->prepare("SELECT COUNT(*) FROM sto_bay_assignments WHERE BINARY bay_id=BINARY ? AND BINARY order_id<>BINARY ? AND status IN ('planned','active') AND planned_start<? AND planned_end>?");$cq->execute([(string)$candidate['id'],$orderId,$end->format('Y-m-d H:i:s'),$start->format('Y-m-d H:i:s')]);
            if((int)$cq->fetchColumn()===0){$bay=$candidate;break;}
        }
    }else{
        $start=new DateTimeImmutable('now');if(!empty($bay['last_end'])){try{$last=new DateTimeImmutable((string)$bay['last_end']);if($last>$start)$start=$last;}catch(Throwable $_){}}
        $slot=max(5,(int)($bay['slot_minutes']??30));$minute=(int)$start->format('i');$rounded=(int)(ceil($minute/$slot)*$slot);if($rounded>=60){$next=$start->modify('+1 hour');$start=$next->setTime((int)$next->format('H'),0);}else $start=$start->setTime((int)$start->format('H'),$rounded);
        $end=$start->modify('+'.$estimated.' minutes');
    }
    $id='sba_'.bin2hex(random_bytes(8));
    $pdo->prepare("INSERT INTO sto_bay_assignments(id,sto_id,bay_id,order_id,master_id,status,planned_start,started_at,planned_end,estimated_minutes,priority_score) VALUES(?,?,?,?,?,'planned',?,NULL,?,?,0) ON DUPLICATE KEY UPDATE bay_id=VALUES(bay_id),master_id=VALUES(master_id),status=IF(status='active',status,'planned'),planned_start=VALUES(planned_start),planned_end=VALUES(planned_end),estimated_minutes=VALUES(estimated_minutes),updated_at=CURRENT_TIMESTAMP")->execute([$id,$stoId,(string)$bay['id'],$orderId,$masterId,$start->format('Y-m-d H:i:s'),$end->format('Y-m-d H:i:s'),$estimated]);
    if(kareta_table_exists($pdo,'master_order_plans')){
        $pid='mop_'.substr(hash('sha256',$orderId),0,20);
        if($fixed){$pdo->prepare("UPDATE master_order_plans SET master_id=?,status=IF(status IN ('done','completed'),status,'planned'),updated_at=CURRENT_TIMESTAMP WHERE BINARY order_id=BINARY ?")->execute([$masterId,$orderId]);}
        else{$pdo->prepare("INSERT INTO master_order_plans(id,order_id,master_id,planned_start,planned_end,estimated_repair_min,status) VALUES(?,?,?,?,?,?,'planned') ON DUPLICATE KEY UPDATE master_id=VALUES(master_id),planned_start=VALUES(planned_start),planned_end=VALUES(planned_end),estimated_repair_min=VALUES(estimated_repair_min),status=IF(status='done',status,'planned'),updated_at=CURRENT_TIMESTAMP")->execute([$pid,$orderId,$masterId,$start->format('Y-m-d H:i:s'),$end->format('Y-m-d H:i:s'),$estimated]);}
    }
    if(kareta_table_exists($pdo,'work_order_dispatch_state')){$score=kareta_dispatch_score_master_for_order($pdo,$masterId,$order);$masterSettings=kareta_dispatch_master_settings($pdo,$masterId);$sla=$start->modify('+'.max(5,(int)$masterSettings['responseSlaMin']).' minutes');$pdo->prepare("INSERT INTO work_order_dispatch_state(order_id,sto_id,master_id,bay_id,status,estimated_minutes,match_score,load_pct,queued_at,planned_start,planned_end,eta_start,eta_end,sla_due_at,last_ranked_at) VALUES(?,?,?,?,?,?,?,?,NOW(),?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE sto_id=VALUES(sto_id),master_id=VALUES(master_id),bay_id=VALUES(bay_id),status='planned',estimated_minutes=VALUES(estimated_minutes),match_score=VALUES(match_score),load_pct=VALUES(load_pct),planned_start=VALUES(planned_start),planned_end=VALUES(planned_end),eta_start=VALUES(eta_start),eta_end=VALUES(eta_end),sla_due_at=VALUES(sla_due_at),first_response_at=NULL,last_ranked_at=NOW()")->execute([$orderId,$stoId,$masterId,(string)$bay['id'],'planned',$estimated,(float)($score['score']??0),(float)($score['loadPct']??0),$start->format('Y-m-d H:i:s'),$end->format('Y-m-d H:i:s'),$start->format('Y-m-d H:i:s'),$end->format('Y-m-d H:i:s'),$sla->format('Y-m-d H:i:s')]);}
    return ['bayId'=>(string)$bay['id'],'bayName'=>(string)$bay['name'],'plannedStart'=>$start->format('Y-m-d H:i:s'),'plannedEnd'=>$end->format('Y-m-d H:i:s'),'estimatedMinutes'=>$estimated,'preservedSchedule'=>$fixed];
}

function kareta_dispatch_dashboard_data(PDO $pdo,string $stoId): array {
    $settings=kareta_dispatch_sto_settings($pdo,$stoId);$masters=[];
    $q=$pdo->prepare("SELECT m.id,m.name,m.spec,m.rating FROM sto_master_links l JOIN masters m ON BINARY m.id=BINARY l.master_id WHERE BINARY l.sto_id=BINARY ? AND l.status='active' AND COALESCE(m.active,1)=1 ORDER BY m.name");$q->execute([$stoId]);
    foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $m){$load=kareta_dispatch_master_load($pdo,(string)$m['id']);$masters[]=array_merge($m,$load);}
    $bays=[];$capacity=0;$busy=0;if(kareta_table_exists($pdo,'sto_service_bays')){$q=$pdo->prepare("SELECT b.id,b.name,b.code,b.bay_type,b.daily_capacity_min,b.slot_minutes,COALESCE(SUM(CASE WHEN a.status IN ('planned','active') THEN a.estimated_minutes ELSE 0 END),0) booked_minutes,COUNT(CASE WHEN a.status='active' THEN 1 END) active_jobs FROM sto_service_bays b LEFT JOIN sto_bay_assignments a ON BINARY a.bay_id=BINARY b.id WHERE BINARY b.sto_id=BINARY ? AND b.active=1 GROUP BY b.id,b.name,b.code,b.bay_type,b.daily_capacity_min,b.slot_minutes ORDER BY b.sort_order,b.name");$q->execute([$stoId]);foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $b){$cap=max(60,(int)$b['daily_capacity_min']);$book=(int)$b['booked_minutes'];$b['loadPct']=round($book*100/$cap,1);$bays[]=$b;$capacity+=$cap;$busy+=$book;}}
    $queue=[];$slaBreaches=0;$q=$pdo->prepare("SELECT o.*,(SELECT MIN(created_at) FROM master_exchange_responses r WHERE r.request_id=o.id AND r.active=1) first_response_at FROM orders o WHERE BINARY o.sto_id=BINARY ? AND o.status NOT IN ('completed','done','delivered','closed','cancelled') ORDER BY CASE WHEN o.priority IN ('urgent','high') THEN 0 ELSE 1 END,o.created_at");$q->execute([$stoId]);foreach(array_slice($q->fetchAll(PDO::FETCH_ASSOC)?:[],0,30) as $o){$rank=kareta_dispatch_rank_order($pdo,$o,$stoId);$published=(string)($o['exchange_published_at']??$o['created_at']??'');$due='';$sla='ok';if($published!==''){try{$d=(new DateTimeImmutable($published))->modify('+'.$settings['responseSlaMin'].' minutes');$due=$d->format('Y-m-d H:i:s');if(empty($o['first_response_at'])&&$d<new DateTimeImmutable('now')){$sla='breached';$slaBreaches++;}elseif(empty($o['first_response_at'])&&$d<(new DateTimeImmutable('now'))->modify('+5 minutes'))$sla='risk';}catch(Throwable $_){}}$queue[]=['id'=>(string)$o['id'],'vehicleTitle'=>(string)($o['vehicle_title']??$o['client_car']??'Автомобиль'),'serviceNames'=>(string)($o['service_names']??'Работы'),'priority'=>(string)($o['priority']??'normal'),'masterId'=>(string)($o['master_id']??''),'estimatedMinutes'=>max(30,(int)($o['estimated_duration_min']??$settings['defaultJobMin'])),'slaDueAt'=>$due,'slaState'=>$sla,'recommended'=>$rank[0]??null,'alternatives'=>array_slice($rank,0,3)];}
    return ['settings'=>$settings,'masters'=>$masters,'bays'=>$bays,'queue'=>$queue,'metrics'=>['masters'=>count($masters),'bays'=>count($bays),'capacityMinutes'=>$capacity,'bookedMinutes'=>$busy,'loadPct'=>$capacity?round($busy*100/$capacity,1):0,'slaBreaches'=>$slaBreaches,'overloadedMasters'=>count(array_filter($masters,static fn($m)=>!empty($m['overloaded'])))]];
}

function kareta_production_dispatch_dashboard(PDO $pdo): void {$sto=kareta_sto_workplace_profile($pdo);kareta_json(['ok'=>true,'data'=>kareta_dispatch_dashboard_data($pdo,(string)$sto['id'])]);}
function kareta_production_dispatch_rank(PDO $pdo,array $query): void {$sto=kareta_sto_workplace_profile($pdo);$id=trim((string)($query['orderId']??$query['order_id']??''));if($id==='')kareta_json(['ok'=>false,'error'=>'order_id_required'],422);$s=$pdo->prepare("SELECT * FROM orders WHERE BINARY id=BINARY ? AND BINARY sto_id=BINARY ? LIMIT 1");$s->execute([$id,(string)$sto['id']]);$o=$s->fetch(PDO::FETCH_ASSOC);if(!$o)kareta_json(['ok'=>false,'error'=>'order_not_found'],404);kareta_json(['ok'=>true,'data'=>['orderId'=>$id,'ranking'=>kareta_dispatch_rank_order($pdo,$o,(string)$sto['id'])]]);}

function kareta_dispatch_rebalance_sto(PDO $pdo,string $stoId): array {
    $settings=kareta_dispatch_sto_settings($pdo,$stoId);
    if(!$settings['autoReassignEnabled'])return ['moved'=>0,'skipped'=>'disabled'];
    $q=$pdo->prepare("SELECT o.* FROM orders o WHERE BINARY o.sto_id=BINARY ? AND o.status IN ('accepted','assigned','process','pending') AND COALESCE(o.master_id,'') NOT IN ('','0') ORDER BY CASE WHEN o.priority IN ('urgent','high') THEN 0 ELSE 1 END,o.created_at LIMIT 60");
    $q->execute([$stoId]);$moved=0;$events=[];
    foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $o){
        $current=(string)$o['master_id'];$load=kareta_dispatch_master_load($pdo,$current);$slaMiss=false;
        if(kareta_table_exists($pdo,'work_order_dispatch_state')){$ds=$pdo->prepare("SELECT sla_due_at,first_response_at FROM work_order_dispatch_state WHERE order_id=? LIMIT 1");$ds->execute([(string)$o['id']]);$dr=$ds->fetch(PDO::FETCH_ASSOC)?:[];$slaMiss=!empty($dr['sla_due_at'])&&empty($dr['first_response_at'])&&strtotime((string)$dr['sla_due_at'])<time();}
        if(!$load['overloaded']&&!$slaMiss)continue;
        if(kareta_table_exists($pdo,'work_order_timers')){$t=$pdo->prepare("SELECT COUNT(*) FROM work_order_timers WHERE BINARY order_id=BINARY ? AND status='running'");$t->execute([(string)$o['id']]);if((int)$t->fetchColumn()>0)continue;}
        if(kareta_table_exists($pdo,'sto_bay_assignments')){$ba=$pdo->prepare("SELECT COUNT(*) FROM sto_bay_assignments WHERE BINARY sto_id=BINARY ? AND BINARY order_id=BINARY ? AND status='active'");$ba->execute([$stoId,(string)$o['id']]);if((int)$ba->fetchColumn()>0)continue;}
        $rank=kareta_dispatch_rank_order($pdo,$o,$stoId);$best=$rank[0]??null;$currentScore=0;
        foreach($rank as $r)if((string)$r['masterId']===$current){$currentScore=(float)$r['score'];break;}
        if(!$best||(string)$best['masterId']===$current||(float)$best['score']<$currentScore+$settings['reassignScoreDelta']||!empty($best['overloaded'])||!empty($best['tariffBlocked']))continue;
        $to=(string)$best['masterId'];$mr=kareta_dispatch_master_row($pdo,$to);$targetDate=preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)($o['date']??''))?(string)$o['date']:date('Y-m-d');
        try{
            $pdo->beginTransaction();
            $lockOrder=$pdo->prepare("SELECT id,master_id,status,`date` FROM orders WHERE BINARY id=BINARY ? AND BINARY sto_id=BINARY ? LIMIT 1 FOR UPDATE");$lockOrder->execute([(string)$o['id'],$stoId]);$currentOrder=$lockOrder->fetch(PDO::FETCH_ASSOC);
            if(!$currentOrder||trim((string)($currentOrder['master_id']??''))!==$current){$pdo->rollBack();continue;}
            $quota=kareta_tariff_master_guard($pdo,$to,$targetDate,(string)$o['id'],false);
            if(empty($quota['canAccept'])){$pdo->rollBack();continue;}
            $u=$pdo->prepare("UPDATE orders SET master_id=?,master_user_id=(SELECT user_id FROM masters WHERE id=? LIMIT 1),master_name=?,accepted_at=COALESCE(accepted_at,NOW()) WHERE id=? AND master_id=?");
            $u->execute([$to,$to,(string)($mr['name']??'Мастер'),(string)$o['id'],$current]);
            if($u->rowCount()<=0){$pdo->rollBack();continue;}
            kareta_tariff_record_master_acceptance($pdo,$to,(string)$o['id'],date('Y-m-d'),'production_auto_reassign');
            if(kareta_table_exists($pdo,'master_reschedule_proposals'))$pdo->prepare("UPDATE master_reschedule_proposals SET status='cancelled',decision_note='master_reassigned',responded_at=NOW(),updated_at=NOW() WHERE BINARY order_id=BINARY ? AND status='pending'")->execute([(string)$o['id']]);
            if(kareta_table_exists($pdo,'sto_bay_assignments'))$pdo->prepare("UPDATE sto_bay_assignments SET master_id=?,updated_at=NOW() WHERE sto_id=? AND order_id=? AND status='planned'")->execute([$to,$stoId,(string)$o['id']]);
            kareta_dispatch_plan_order($pdo,$stoId,(string)$o['id'],$to);
            if(kareta_table_exists($pdo,'work_order_dispatch_state'))$pdo->prepare("UPDATE work_order_dispatch_state SET master_id=?,reassign_count=reassign_count+1,status='planned',updated_at=NOW() WHERE order_id=?")->execute([$to,(string)$o['id']]);
            if(kareta_table_exists($pdo,'work_order_dispatch_events'))$pdo->prepare("INSERT INTO work_order_dispatch_events(order_id,sto_id,from_master_id,to_master_id,event_type,reason,payload_json,actor_user_id) VALUES(?,?,?,?,?,?,?,?)")->execute([(string)$o['id'],$stoId,$current,$to,'auto_reassign',$slaMiss?'SLA реакции просрочен':'Перегрузка смены',json_encode(['fromLoadPct'=>$load['loadPct'],'toScore'=>$best['score'],'tariff'=>$quota['plan']['code']??''],JSON_UNESCAPED_UNICODE),(int)(kareta_session_user()['id']??0)?:null]);
            $pdo->commit();$moved++;$events[]=['orderId'=>(string)$o['id'],'from'=>$current,'to'=>$to];
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();kareta_log_error('DISPATCH_REASSIGN',$e->getMessage());}
    }
    return ['moved'=>$moved,'events'=>$events];
}
function kareta_production_dispatch_rebalance(PDO $pdo): void {$sto=kareta_sto_workplace_profile($pdo);kareta_json(['ok'=>true,'data'=>kareta_dispatch_rebalance_sto($pdo,(string)$sto['id'])]);}

function kareta_master_exchange_offer_ids(PDO $pdo,string $masterId): array {
    if(!kareta_table_exists($pdo,'service_offers'))return [];
    $rows=kareta_try_query_all($pdo,"SELECT service_id FROM service_offers WHERE owner_type='master' AND owner_entity_id=? AND active=1 AND booking_enabled=1 AND availability_status<>'paused' AND moderation_status='approved'",[$masterId],[],'MASTER_EXCHANGE_R65_OFFERS');
    return array_values(array_filter(array_map(static fn($r)=>(string)($r['service_id']??''),$rows)));
}
function kareta_master_exchange_row_matches(array $row,array $offerIds): bool {
    $ids=json_decode((string)($row['service_ids']??'[]'),true);$ids=is_array($ids)?array_values(array_filter(array_map('strval',$ids))):[];
    return $ids ? (bool)array_intersect($offerIds,$ids) : false;
}
function kareta_master_exchange_notify_matching_items(PDO $pdo,string $masterId,?int $masterUserId,array $items): int {
    if(!kareta_table_exists($pdo,'master_exchange_notification_receipts')||!function_exists('kareta_notification_insert'))return 0;
    $matched=array_values(array_filter($items,static fn($item)=>(int)($item['dispatch']['serviceMatch']??0)>0));if(!$matched)return 0;
    $baseline=$pdo->prepare("INSERT IGNORE INTO master_exchange_notification_receipts(master_id,request_id,event_type) VALUES(?, '__baseline__','matching_request')");$baseline->execute([$masterId]);$first=$baseline->rowCount()>0;
    $insert=$pdo->prepare("INSERT IGNORE INTO master_exchange_notification_receipts(master_id,request_id,event_type) VALUES(?,?,'matching_request')");$sent=0;
    foreach($matched as $item){$id=(string)($item['id']??'');if($id==='')continue;$insert->execute([$masterId,$id]);if($insert->rowCount()<=0||$first)continue;kareta_notification_insert($pdo,['recipientUserId'=>$masterUserId?:null,'recipientRole'=>'master','eventType'=>'exchange.matching_request.new','entityType'=>'order','entityId'=>$id,'title'=>'Новая заявка по вашим услугам','body'=>(string)($item['serviceNames']??'Появилась новая подходящая заявка.'),'actionUrl'=>'#/master/exchange?focus='.rawurlencode($id),'meta'=>['orderId'=>$id,'serviceMatch'=>(int)($item['dispatch']['serviceMatch']??0)]]);$sent++;}
    return $sent;
}

function kareta_master_exchange_feed_fallback(PDO $pdo,array $ctx,array $state,string $reason='dispatch_metrics_unavailable'): void {
    $masterId=(string)($ctx['masterId']??'');
    $serviceScope=trim((string)($_GET['service_scope']??'all'));if(!in_array($serviceScope,['all','mine'],true))$serviceScope='all';$offerIds=kareta_master_exchange_offer_ids($pdo,$masterId);
    $tab=trim((string)($_GET['tab']??'new'));if(!in_array($tab,['new','saved','responded','accepted'],true))$tab='new';
    $q=trim((string)($_GET['q']??''));$urgent=trim((string)($_GET['urgency']??'all'));$limit=max(1,min(100,(int)($_GET['limit']??60)));$priceMin=max(0,(float)($_GET['price_min']??0));$priceMax=max(0,(float)($_GET['price_max']??0));
    $savedIds=array_values(array_filter(array_map('strval',$state['saved']??[])));$hidden=array_flip(array_map('strval',$state['hidden']??[]));$responses=$state['responses']??[];$responseMap=[];foreach($responses as $r)$responseMap[(string)($r['request_id']??'')]=$r;$responseIds=array_keys($responseMap);
    $where=["o.type IN ('service_order','request','service')"];$params=[];
    if($tab==='accepted'){$where[]="BINARY o.master_id=BINARY ?";$params[]=$masterId;$where[]="o.status NOT IN ('cancelled','completed','done','delivered','closed')";}
    elseif($tab==='responded'){$ids=$responseIds;if(!$ids){$items=[];}else{$where[]='o.id IN ('.implode(',',array_fill(0,count($ids),'?')).')';array_push($params,...$ids);}}
    elseif($tab==='saved'){$ids=$savedIds;if(!$ids){$items=[];}else{$where[]='o.id IN ('.implode(',',array_fill(0,count($ids),'?')).')';array_push($params,...$ids);}}
    else{$where[]="COALESCE(o.master_id,'0') IN ('','0')";$where[]="o.status IN ('new','waiting_responses')";}
    if($q!==''){$like='%'.$q.'%';$where[]="(o.service_names LIKE ? OR o.client_car LIKE ? OR o.notes LIKE ? OR o.vehicle_title LIKE ?)";array_push($params,$like,$like,$like,$like);}
    if($urgent==='urgent'&&kareta_column_exists($pdo,'orders','priority'))$where[]="o.priority IN ('urgent','high')";elseif($urgent==='normal'&&kareta_column_exists($pdo,'orders','priority'))$where[]="o.priority NOT IN ('urgent','high')";
    if($priceMin>0&&kareta_column_exists($pdo,'orders','price')){$where[]='o.price>=?';$params[]=$priceMin;}if($priceMax>0&&kareta_column_exists($pdo,'orders','price')){$where[]='o.price<=?';$params[]=$priceMax;}
    if(!isset($items)){
        $responseCountSql=kareta_table_exists($pdo,'master_exchange_responses')?"(SELECT COUNT(*) FROM master_exchange_responses r WHERE r.request_id=o.id AND r.active=1 AND r.response_status NOT IN ('declined','cancelled','withdrawn'))":"0";
        $rows=kareta_try_query_all($pdo,"SELECT o.*,(SELECT c.id FROM chats c WHERE c.order_id=o.id ORDER BY c.id ASC LIMIT 1) chat_id,$responseCountSql responses_count FROM orders o WHERE ".implode(' AND ',$where)." ORDER BY o.created_at DESC LIMIT ".min(180,$limit*3),$params,[],'MASTER_EXCHANGE_FALLBACK_FEED');
        $items=[];foreach($rows as $row){$id=(string)($row['id']??'');if(isset($hidden[$id])&&$tab==='new')continue;if($tab==='new'&&isset($responseMap[$id]))continue;$distance=null;try{$distance=kareta_dispatch_master_order_distance($pdo,$masterId,$row);}catch(Throwable $_distanceError){}if($distanceMax>0&&($distance===null||$distance>$distanceMax))continue;$item=_fmt_order($row);$item=kareta_master_exchange_sanitize_geo($item,$distance,$tab==='accepted');$item['saved']=in_array($id,$savedIds,true);$item['myResponse']=$responseMap[$id]??null;$item['responsesCount']=(int)($row['responses_count']??0);$matched=kareta_master_exchange_row_matches($row,$offerIds);if($serviceScope==='mine'&&!$matched)continue;$item['clientName']='Клиент';$item['clientPhone']='';$item['dispatch']=['score'=>0,'eligible'=>true,'serviceMatch'=>$matched?100:0,'loadPct'=>0,'overloaded'=>false,'distanceKm'=>$distance,'distanceMode'=>'straight_line','requestPointAvailable'=>$distance!==null,'etaStart'=>'','etaEnd'=>'','slaDueAt'=>'','slaState'=>'ok','degraded'=>true];$item['matchReason']=$matched?'Совпадает с «Моими услугами»':'Вне «Моих услуг» · заявка доступна';$items[]=$item;if(count($items)>=$limit)break;}
    }
    if($tab==='new'){try{kareta_master_exchange_notify_matching_items($pdo,$masterId,$ctx['actorUserId']??null,$items);}catch(Throwable $notifyError){kareta_log_error('MASTER_EXCHANGE_NOTIFY_FALLBACK',$notifyError->getMessage());}}
    $responded=count($responses);$won=count(array_filter($responses,static fn($r)=>in_array((string)($r['response_status']??''),['accepted','won'],true)));$pending=count(array_filter($responses,static fn($r)=>in_array((string)($r['response_status']??''),['pending','viewed'],true)));
    $counts=['new'=>$tab==='new'?count($items):0,'saved'=>count($savedIds),'responded'=>$responded,'accepted'=>$won];
    kareta_json(['ok'=>true,'data'=>['items'=>$items,'kpi'=>['available'=>$counts['new'],'responses'=>$responded,'pending'=>$pending,'won'=>$won,'winRate'=>$responded?round($won*100/$responded):0,'loadPct'=>0,'overloaded'=>false],'state'=>$state,'tabCounts'=>$counts,'load'=>['activeOrders'=>0,'runningOrders'=>0,'queuedMinutes'=>0,'capacityMinutes'=>0,'loadPct'=>0,'overloaded'=>false,'etaStart'=>''],'degraded'=>true,'degradedReason'=>$reason,'serviceScope'=>$serviceScope]]);
}

function kareta_master_exchange_feed_v2(PDO $pdo): void {
    $ctx=kareta_master_exchange_context($pdo);$masterId=(string)$ctx['masterId'];$state=kareta_master_exchange_fetch_state($pdo,$masterId,$ctx['actorUserId']);
    try{
        $tab=trim((string)($_GET['tab']??'new'));if(!in_array($tab,['new','saved','responded','accepted'],true))$tab='new';
        $serviceScope=trim((string)($_GET['service_scope']??'all'));if(!in_array($serviceScope,['all','mine'],true))$serviceScope='all';$q=trim((string)($_GET['q']??''));$sort=trim((string)($_GET['sort']??'recommended'));$urgent=trim((string)($_GET['urgency']??((int)($_GET['urgent']??0)===1?'urgent':'all')));$limit=max(1,min(100,(int)($_GET['limit']??60)));$distanceMax=max(0,(float)($_GET['distance_max']??0));$priceMin=max(0,(float)($_GET['price_min']??0));$priceMax=max(0,(float)($_GET['price_max']??0));
        $savedIds=array_values(array_filter(array_map('strval',$state['saved']??[])));$hidden=array_flip(array_map('strval',$state['hidden']??[]));$responses=$state['responses']??[];$responseMap=[];foreach($responses as $r)$responseMap[(string)($r['request_id']??'')]=$r;$responseIds=array_keys($responseMap);
        $where=["o.type IN ('service_order','request','service')"];$params=[];
        if($tab==='accepted'){$where[]="BINARY o.master_id=BINARY ?";$params[]=$masterId;$where[]="o.status NOT IN ('cancelled','completed','done','delivered','closed')";}
        elseif($tab==='responded'){$ids=$responseIds;if(!$ids)kareta_json(['ok'=>true,'data'=>['items'=>[],'kpi'=>kareta_master_exchange_kpi_v2($pdo,$masterId,$state),'state'=>$state,'tabCounts'=>kareta_master_exchange_tab_counts($pdo,$masterId,$state)]]);$where[]='o.id IN ('.implode(',',array_fill(0,count($ids),'?')).')';array_push($params,...$ids);}
        elseif($tab==='saved'){$ids=$savedIds;if(!$ids)kareta_json(['ok'=>true,'data'=>['items'=>[],'kpi'=>kareta_master_exchange_kpi_v2($pdo,$masterId,$state),'state'=>$state,'tabCounts'=>kareta_master_exchange_tab_counts($pdo,$masterId,$state)]]);$where[]='o.id IN ('.implode(',',array_fill(0,count($ids),'?')).')';array_push($params,...$ids);if(kareta_column_exists($pdo,'orders','exchange_status'))$where[]="COALESCE(o.exchange_status,'open')='open'";}
        else{$where[]="COALESCE(o.master_id,'0') IN ('','0')";$where[]="o.status IN ('new','waiting_responses')";if(kareta_column_exists($pdo,'orders','exchange_status'))$where[]="COALESCE(o.exchange_status,'open')='open'";if(kareta_column_exists($pdo,'orders','exchange_deadline_at'))$where[]="(o.exchange_deadline_at IS NULL OR o.exchange_deadline_at>NOW())";}
        if($q!==''){$like='%'.$q.'%';$where[]="(o.service_names LIKE ? OR o.client_car LIKE ? OR o.notes LIKE ? OR o.vehicle_title LIKE ?)";array_push($params,$like,$like,$like,$like);}if($urgent==='urgent'&&kareta_column_exists($pdo,'orders','priority'))$where[]="o.priority IN ('urgent','high')";elseif($urgent==='normal'&&kareta_column_exists($pdo,'orders','priority'))$where[]="o.priority NOT IN ('urgent','high')";if($priceMin>0&&kareta_column_exists($pdo,'orders','price')){$where[]='o.price>=?';$params[]=$priceMin;}if($priceMax>0&&kareta_column_exists($pdo,'orders','price')){$where[]='o.price<=?';$params[]=$priceMax;}
        $responseCountSql=kareta_table_exists($pdo,'master_exchange_responses')?"(SELECT COUNT(*) FROM master_exchange_responses r WHERE r.request_id=o.id AND r.active=1 AND r.response_status NOT IN ('declined','cancelled','withdrawn'))":"0";
        $sql="SELECT o.*,(SELECT c.id FROM chats c WHERE c.order_id=o.id ORDER BY c.id ASC LIMIT 1) chat_id,$responseCountSql responses_count FROM orders o WHERE ".implode(' AND ',$where)." ORDER BY o.created_at DESC LIMIT ".min(180,$limit*3);$s=$pdo->prepare($sql);$s->execute($params);$rows=$s->fetchAll(PDO::FETCH_ASSOC)?:[];
        $items=[];foreach($rows as $row){$id=(string)$row['id'];if(isset($hidden[$id])&&$tab==='new')continue;if($tab==='new'&&isset($responseMap[$id]))continue;try{$score=kareta_dispatch_score_master_for_order($pdo,$masterId,$row);}catch(Throwable $metricError){kareta_log_error('MASTER_EXCHANGE_ITEM_METRICS',$metricError->getMessage());$score=['score'=>0,'eligible'=>true,'serviceMatch'=>0,'loadPct'=>0,'overloaded'=>false,'distanceKm'=>null,'etaStart'=>'','etaEnd'=>'','slaDueAt'=>'','slaState'=>'ok','degraded'=>true];}if($distanceMax>0&&($score['distanceKm']===null||(float)$score['distanceKm']>$distanceMax))continue;$item=_fmt_order($row);$item=kareta_master_exchange_sanitize_geo($item,isset($score['distanceKm'])&&$score['distanceKm']!==null?(float)$score['distanceKm']:null,$tab==='accepted');$item['saved']=in_array($id,$savedIds,true);$item['myResponse']=$responseMap[$id]??null;$item['responsesCount']=(int)($row['responses_count']??0);$item['clientName']='Клиент';$item['clientPhone']='';$item['dispatch']=$score;$matchPct=(int)($score['serviceMatch']??0);if($serviceScope==='mine'&&$matchPct<=0)continue;$item['matchReason']=!empty($score['degraded'])?'Заявка доступна · метрики обновляются':($matchPct>0?'Совпадение '.$matchPct.'% · загрузка '.(int)($score['loadPct']??0).'%':'Вне «Моих услуг» · заявку всё равно можно посмотреть и принять');$items[]=$item;if(count($items)>=$limit)break;}
        if($tab==='new'){try{kareta_master_exchange_notify_matching_items($pdo,$masterId,$ctx['actorUserId']??null,$items);}catch(Throwable $notifyError){kareta_log_error('MASTER_EXCHANGE_NOTIFY_PRIMARY',$notifyError->getMessage());}}
        usort($items,static function($a,$b)use($sort){$da=$a['dispatch']??[];$db=$b['dispatch']??[];return match($sort){'distance'=>(($da['distanceKm']??99999)<=>($db['distanceKm']??99999)),'eta'=>strcmp((string)($da['etaStart']??''),(string)($db['etaStart']??'')),'price_desc'=>((float)($b['price']??0)<=> (float)($a['price']??0)),'price_asc'=>((float)($a['price']??0)<=> (float)($b['price']??0)),'responses'=>((int)($a['responsesCount']??0)<=> (int)($b['responsesCount']??0)),default=>((float)($db['score']??0)<=> (float)($da['score']??0))};});
        kareta_json(['ok'=>true,'data'=>['items'=>$items,'kpi'=>kareta_master_exchange_kpi_v2($pdo,$masterId,$state),'state'=>$state,'tabCounts'=>kareta_master_exchange_tab_counts($pdo,$masterId,$state),'load'=>kareta_dispatch_master_load($pdo,$masterId),'degraded'=>false,'serviceScope'=>$serviceScope]]);
    }catch(Throwable $error){
        kareta_log_error('MASTER_EXCHANGE_V2_DEGRADED',$error->getMessage());
        kareta_master_exchange_feed_fallback($pdo,$ctx,$state,'production_dispatch_degraded');
    }
}

function kareta_master_exchange_tab_counts(PDO $pdo,string $masterId,array $state): array {
    $saved=count($state['saved']??[]);$responses=$state['responses']??[];$responded=count($responses);
    $newWhere=["COALESCE(master_id,'0') IN ('','0')","status IN ('new','waiting_responses')","type IN ('service_order','request','service')"];
    if(kareta_column_exists($pdo,'orders','exchange_status'))$newWhere[]="COALESCE(exchange_status,'open')='open'";
    if(kareta_column_exists($pdo,'orders','exchange_deadline_at'))$newWhere[]="(exchange_deadline_at IS NULL OR exchange_deadline_at>NOW())";
    $available=(int)kareta_try_query_value($pdo,"SELECT COUNT(*) FROM orders WHERE ".implode(' AND ',$newWhere),[],0,'MASTER_EXCHANGE_TAB_NEW');
    $new=max(0,$available-$responded);
    $accepted=(int)kareta_try_query_value($pdo,"SELECT COUNT(*) FROM orders WHERE BINARY master_id=BINARY ? AND status NOT IN ('cancelled','completed','done','delivered','closed')",[$masterId],0,'MASTER_EXCHANGE_TAB_ACCEPTED');
    return ['new'=>$new,'saved'=>$saved,'responded'=>$responded,'accepted'=>$accepted];
}
function kareta_master_exchange_kpi_v2(PDO $pdo,string $masterId,array $state): array {
    $counts=kareta_master_exchange_tab_counts($pdo,$masterId,$state);$responses=$state['responses']??[];$pending=count(array_filter($responses,static fn($r)=>in_array((string)($r['response_status']??''),['pending','viewed'],true)));$won=count(array_filter($responses,static fn($r)=>in_array((string)($r['response_status']??''),['accepted','won'],true)));
    try{$load=kareta_dispatch_master_load($pdo,$masterId);}catch(Throwable $error){kareta_log_error('MASTER_EXCHANGE_KPI_LOAD',$error->getMessage());$load=['loadPct'=>0,'overloaded'=>false];}
    return ['available'=>$counts['new'],'responses'=>$counts['responded'],'pending'=>$pending,'won'=>$won,'winRate'=>count($responses)?round($won*100/count($responses)):0,'loadPct'=>$load['loadPct']??0,'overloaded'=>!empty($load['overloaded'])];
}
