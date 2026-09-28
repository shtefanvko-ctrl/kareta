<?php
declare(strict_types=1);

/**
 * R188.5.5.6.69.1 — role-scoped tariff engine with admin-editable quotas and KARETA PRO.
 * Tariffs are isolated by business surface: client and master never share one assignment.
 */
function kareta_tariff_fallback_plans(): array {
    return [
        'client_start'=>[
            'code'=>'client_start','accountType'=>'client','name'=>'Клиент','description'=>'Обычный тариф клиента для заявок, гаража, истории и чатов.','monthlyPrice'=>0.0,'isPaid'=>false,'tier'=>'standard','sort'=>10,
            'limits'=>['activeRequests'=>3,'vehicles'=>3],
            'features'=>['requests'=>'Заявки на ремонт','garage'=>'Цифровой гараж','history'=>'История обслуживания','chats'=>'Чаты с исполнителями'],
        ],
        'client_plus'=>[
            'code'=>'client_plus','accountType'=>'client','name'=>'KARETA PRO','description'=>'Платный тариф клиента с расширенными лимитами аккаунта.','monthlyPrice'=>null,'isPaid'=>true,'tier'=>'pro','sort'=>20,
            'limits'=>['activeRequests'=>10,'vehicles'=>10],
            'features'=>['requests'=>'До 10 активных заявок','garage'=>'До 10 автомобилей','history'=>'Полная история обслуживания','chats'=>'Чаты и уведомления'],
        ],
        'master_start'=>[
            'code'=>'master_start','accountType'=>'master','name'=>'Мастер','description'=>'Обычный рабочий тариф Мастера с контролем фактической загрузки.','monthlyPrice'=>0.0,'isPaid'=>false,'tier'=>'standard','sort'=>10,
            'limits'=>['acceptedRequestsPerDay'=>3,'activeIntakesPerDay'=>3,'openRepairs'=>10],
            'features'=>['exchange'=>'Биржа заявок','services'=>'Мои услуги и свои цены','calendar'=>'Рабочий календарь','chats'=>'Чаты и заказ-наряд'],
        ],
        'master_pro'=>[
            'code'=>'master_pro','accountType'=>'master','name'=>'KARETA PRO','description'=>'Платный тариф Мастера с расширенной рабочей ёмкостью.','monthlyPrice'=>null,'isPaid'=>true,'tier'=>'pro','sort'=>20,
            'limits'=>['acceptedRequestsPerDay'=>10,'activeIntakesPerDay'=>10,'openRepairs'=>30],
            'features'=>['exchange'=>'Расширенный поток Биржи','services'=>'Мои услуги и свои нормативы','calendar'=>'Расширенная дневная загрузка','chats'=>'Чаты и заказ-наряд'],
        ],
    ];
}

function kareta_tariff_decode_json($value,array $fallback=[]): array {
    if(is_array($value)) return $value;
    $decoded=json_decode((string)$value,true);
    return is_array($decoded)?$decoded:$fallback;
}

function kareta_tariff_plan_rows(PDO $pdo,string $accountType=''): array {
    $fallback=kareta_tariff_fallback_plans();
    if(!function_exists('kareta_table_exists')||!kareta_table_exists($pdo,'account_tariff_plans')) {
        $rows=array_values($fallback);
        return $accountType===''?$rows:array_values(array_filter($rows,static fn($r)=>(string)$r['accountType']===$accountType));
    }
    try{
        $paidColumn=(function_exists('kareta_column_exists')&&kareta_column_exists($pdo,'account_tariff_plans','is_paid'))?',is_paid':'';
        $sql="SELECT code,account_type,name,description,monthly_price,limits_json,features_json,sort_order{$paidColumn} FROM account_tariff_plans WHERE active=1";
        $params=[];
        if($accountType!==''){$sql.=" AND account_type=?";$params[]=$accountType;}
        $sql.=" ORDER BY sort_order,code";
        $q=$pdo->prepare($sql);$q->execute($params);$db=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
        if(!$db)return $accountType===''?array_values($fallback):array_values(array_filter($fallback,static fn($r)=>(string)$r['accountType']===$accountType));
        $rows=[];
        foreach($db as $r){
            $code=(string)$r['code'];$base=$fallback[$code]??[];
            $rows[]=[
                'code'=>$code,'accountType'=>(string)$r['account_type'],'name'=>(string)$r['name'],'description'=>(string)($r['description']??''),
                'monthlyPrice'=>$r['monthly_price']===null?null:(float)$r['monthly_price'],'isPaid'=>array_key_exists('is_paid',$r)?((int)$r['is_paid']===1):(bool)($base['isPaid']??str_ends_with($code,'_pro')),'tier'=>(string)($base['tier']??(str_ends_with($code,'_pro')?'pro':'standard')),'sort'=>(int)($r['sort_order']??0),
                'limits'=>kareta_tariff_decode_json($r['limits_json']??'',$base['limits']??[]),
                'features'=>kareta_tariff_decode_json($r['features_json']??'',$base['features']??[]),
            ];
        }
        return $rows;
    }catch(Throwable $_){
        $rows=array_values($fallback);
        return $accountType===''?$rows:array_values(array_filter($rows,static fn($r)=>(string)$r['accountType']===$accountType));
    }
}

function kareta_tariff_default_code(string $subjectType): string {
    return $subjectType==='master'?'master_start':'client_start';
}

function kareta_tariff_plan(PDO $pdo,string $subjectType,string $subjectId): array {
    $code=kareta_tariff_default_code($subjectType);
    if(function_exists('kareta_table_exists')&&kareta_table_exists($pdo,'account_tariff_assignments')){
        try{
            $q=$pdo->prepare("SELECT plan_code FROM account_tariff_assignments WHERE subject_type=? AND BINARY subject_id=BINARY ? AND status='active' AND (starts_at IS NULL OR starts_at<=NOW()) AND (ends_at IS NULL OR ends_at>NOW()) LIMIT 1");
            $q->execute([$subjectType,$subjectId]);$assigned=trim((string)($q->fetchColumn()?:''));if($assigned!=='')$code=$assigned;
        }catch(Throwable $_){}
    }
    foreach(kareta_tariff_plan_rows($pdo,$subjectType) as $row)if((string)$row['code']===$code)return $row;
    $fallback=kareta_tariff_fallback_plans();return $fallback[kareta_tariff_default_code($subjectType)];
}

function kareta_tariff_limit(array $plan,string $key,int $default): int {
    $value=$plan['limits'][$key]??$default;
    return max(0,(int)$value);
}

function kareta_tariff_terminal_statuses(): array {
    return ['completed','done','delivered','closed','cancelled','rejected'];
}

function kareta_tariff_master_usage(PDO $pdo,string $masterId,string $targetDate='',string $excludeOrderId=''): array {
    $targetDate=preg_match('/^\d{4}-\d{2}-\d{2}$/',$targetDate)?$targetDate:date('Y-m-d');
    $today=date('Y-m-d');
    $plan=kareta_tariff_plan($pdo,'master',$masterId);
    $limits=[
        'acceptedRequestsPerDay'=>kareta_tariff_limit($plan,'acceptedRequestsPerDay',3),
        'activeIntakesPerDay'=>kareta_tariff_limit($plan,'activeIntakesPerDay',3),
        'openRepairs'=>kareta_tariff_limit($plan,'openRepairs',10),
    ];
    $acceptedToday=0;
    if(function_exists('kareta_table_exists')&&kareta_table_exists($pdo,'account_tariff_usage_events')){
        $q=$pdo->prepare("SELECT COUNT(*) FROM account_tariff_usage_events WHERE subject_type='master' AND BINARY subject_id=BINARY ? AND metric='accepted_request' AND usage_date=?");
        $q->execute([$masterId,$today]);$acceptedToday=(int)$q->fetchColumn();
    } else {
        $q=$pdo->prepare("SELECT COUNT(DISTINCT request_id) FROM master_exchange_responses WHERE BINARY master_id=BINARY ? AND response_status='accepted' AND accepted_at>=? AND accepted_at<DATE_ADD(?,INTERVAL 1 DAY)");
        $q->execute([$masterId,$today,$today]);$acceptedToday=(int)$q->fetchColumn();
    }
    $terminal=kareta_tariff_terminal_statuses();$ph=implode(',',array_fill(0,count($terminal),'?'));
    $params=array_merge([$masterId,$targetDate],$terminal);
    $sql="SELECT COUNT(*) FROM orders WHERE BINARY master_id=BINARY ? AND `date`=? AND LOWER(COALESCE(status,'')) NOT IN ($ph)";
    if($excludeOrderId!==''){$sql.=" AND BINARY id<>BINARY ?";$params[]=$excludeOrderId;}
    $q=$pdo->prepare($sql);$q->execute($params);$activeIntakes=(int)$q->fetchColumn();
    $params=array_merge([$masterId],$terminal);
    $sql="SELECT COUNT(*) FROM orders WHERE BINARY master_id=BINARY ? AND COALESCE(master_id,'')<>'' AND LOWER(COALESCE(status,'')) NOT IN ($ph) AND LOWER(COALESCE(status,'')) NOT IN ('new','pending','waiting_responses')";
    if($excludeOrderId!==''){$sql.=" AND BINARY id<>BINARY ?";$params[]=$excludeOrderId;}
    $q=$pdo->prepare($sql);$q->execute($params);$openRepairs=(int)$q->fetchColumn();
    $usage=['acceptedRequestsToday'=>$acceptedToday,'activeIntakesOnDate'=>$activeIntakes,'openRepairs'=>$openRepairs,'targetDate'=>$targetDate];
    $remaining=[
        'acceptedRequestsToday'=>max(0,$limits['acceptedRequestsPerDay']-$acceptedToday),
        'activeIntakesOnDate'=>max(0,$limits['activeIntakesPerDay']-$activeIntakes),
        'openRepairs'=>max(0,$limits['openRepairs']-$openRepairs),
    ];
    $blockedMetric='';
    if($limits['acceptedRequestsPerDay']>0&&$acceptedToday>=$limits['acceptedRequestsPerDay'])$blockedMetric='acceptedRequestsPerDay';
    elseif($limits['activeIntakesPerDay']>0&&$activeIntakes>=$limits['activeIntakesPerDay'])$blockedMetric='activeIntakesPerDay';
    elseif($limits['openRepairs']>0&&$openRepairs>=$limits['openRepairs'])$blockedMetric='openRepairs';
    return ['plan'=>$plan,'limits'=>$limits,'usage'=>$usage,'remaining'=>$remaining,'canAccept'=>$blockedMetric==='','blockedMetric'=>$blockedMetric];
}

function kareta_tariff_master_intake_guard(PDO $pdo,string $masterId,string $targetDate,string $excludeOrderId='',bool $respond=true): array {
    $snapshot=kareta_tariff_master_usage($pdo,$masterId,$targetDate,$excludeOrderId);
    $used=(int)($snapshot['usage']['activeIntakesOnDate']??0);$limit=(int)($snapshot['limits']['activeIntakesPerDay']??0);$ok=$limit<=0||$used<$limit;
    $snapshot['canSchedule']=$ok;$snapshot['blockedMetric']=$ok?'':'activeIntakesPerDay';
    if(!$ok&&$respond)kareta_json(['ok'=>false,'error'=>'tariff_intake_limit_reached','metric'=>'activeIntakesPerDay','message'=>'Лимит тарифа: на '.$targetDate.' уже запланировано '.$used.' из '.$limit.' активных приёмов.','tariff'=>$snapshot],409);
    return $snapshot;
}

function kareta_tariff_master_limit_message(array $snapshot): string {
    $metric=(string)($snapshot['blockedMetric']??'');$limits=$snapshot['limits']??[];$usage=$snapshot['usage']??[];
    if($metric==='acceptedRequestsPerDay')return 'Лимит тарифа: сегодня уже принято '.(int)($usage['acceptedRequestsToday']??0).' из '.(int)($limits['acceptedRequestsPerDay']??0).' заявок.';
    if($metric==='activeIntakesPerDay')return 'Лимит тарифа: на '.(string)($usage['targetDate']??date('Y-m-d')).' уже запланировано '.(int)($usage['activeIntakesOnDate']??0).' из '.(int)($limits['activeIntakesPerDay']??0).' активных приёмов.';
    if($metric==='openRepairs')return 'Лимит тарифа: у Мастера уже '.(int)($usage['openRepairs']??0).' из '.(int)($limits['openRepairs']??0).' незакрытых автомобилей в ремонте. Сначала завершите хотя бы один ремонт.';
    return 'Лимит тарифа не позволяет принять ещё одну машину.';
}

function kareta_tariff_master_guard(PDO $pdo,string $masterId,string $targetDate='',string $excludeOrderId='',bool $respond=true): array {
    // All assignment paths lock the same master row, so concurrent accepts cannot both pass the last available quota slot.
    $lock=$pdo->prepare("SELECT id FROM masters WHERE BINARY id=BINARY ? LIMIT 1 FOR UPDATE");$lock->execute([$masterId]);
    if(!$lock->fetchColumn()){
        $snapshot=['canAccept'=>false,'blockedMetric'=>'master_not_found','limits'=>[],'usage'=>[],'plan'=>[]];
        if($respond)kareta_json(['ok'=>false,'error'=>'master_not_found'],404);return $snapshot;
    }
    $snapshot=kareta_tariff_master_usage($pdo,$masterId,$targetDate,$excludeOrderId);
    if(empty($snapshot['canAccept'])&&$respond){
        kareta_json(['ok'=>false,'error'=>'tariff_limit_reached','metric'=>$snapshot['blockedMetric'],'message'=>kareta_tariff_master_limit_message($snapshot),'tariff'=>$snapshot],409);
    }
    return $snapshot;
}

function kareta_tariff_record_master_acceptance(PDO $pdo,string $masterId,string $orderId,?string $usageDate=null,string $source='assignment'): void {
    if($masterId===''||$orderId===''||!function_exists('kareta_table_exists')||!kareta_table_exists($pdo,'account_tariff_usage_events'))return;
    $date=$usageDate&&preg_match('/^\d{4}-\d{2}-\d{2}$/',$usageDate)?$usageDate:date('Y-m-d');
    $id='tue_'.substr(hash('sha256','master|'.$masterId.'|accepted_request|'.$orderId),0,28);
    $q=$pdo->prepare("INSERT IGNORE INTO account_tariff_usage_events(id,subject_type,subject_id,metric,entity_id,usage_date,source) VALUES(?,?,?,?,?,?,?)");
    $q->execute([$id,'master',$masterId,'accepted_request',$orderId,$date,mb_substr($source,0,64)]);
}

function kareta_tariff_client_usage(PDO $pdo,int $userId,string $phone=''): array {
    $subjectId=(string)$userId;$plan=kareta_tariff_plan($pdo,'client',$subjectId);
    $limits=['activeRequests'=>kareta_tariff_limit($plan,'activeRequests',3),'vehicles'=>kareta_tariff_limit($plan,'vehicles',3)];
    $terminal=kareta_tariff_terminal_statuses();$ph=implode(',',array_fill(0,count($terminal),'?'));
    $where=[];$idParams=[];
    if($userId>0){$where[]='client_user_id=?';$idParams[]=$userId;}
    if($phone!==''){$where[]='client_phone=?';$idParams[]=$phone;}
    $activeRequests=0;
    if($where){$params=array_merge($idParams,$terminal);$q=$pdo->prepare("SELECT COUNT(*) FROM orders WHERE (".implode(' OR ',$where).") AND LOWER(COALESCE(status,'')) NOT IN ($ph)");$q->execute($params);$activeRequests=(int)$q->fetchColumn();}
    $vehicleWhere=[];$vehicleParams=[];
    if($userId>0){$vehicleWhere[]='user_id=?';$vehicleParams[]=$userId;}
    if($phone!==''){$vehicleWhere[]='user_phone=?';$vehicleParams[]=$phone;}
    $vehicles=0;if($vehicleWhere){$q=$pdo->prepare("SELECT COUNT(*) FROM client_vehicles WHERE active=1 AND (".implode(' OR ',$vehicleWhere).")");$q->execute($vehicleParams);$vehicles=(int)$q->fetchColumn();}
    return ['plan'=>$plan,'limits'=>$limits,'usage'=>['activeRequests'=>$activeRequests,'vehicles'=>$vehicles],'remaining'=>['activeRequests'=>max(0,$limits['activeRequests']-$activeRequests),'vehicles'=>max(0,$limits['vehicles']-$vehicles)]];
}

function kareta_tariff_client_guard(PDO $pdo,string $metric,int $userId,string $phone='',bool $respond=true): array {
    if($userId>0){try{$lock=$pdo->prepare("SELECT id FROM users WHERE id=? LIMIT 1 FOR UPDATE");$lock->execute([$userId]);$lock->fetchColumn();}catch(Throwable $_){}}
    $snapshot=kareta_tariff_client_usage($pdo,$userId,$phone);$limit=(int)($snapshot['limits'][$metric]??0);$used=(int)($snapshot['usage'][$metric]??0);
    $ok=$limit<=0||$used<$limit;$snapshot['canCreate']=$ok;$snapshot['blockedMetric']=$ok?'':$metric;
    if(!$ok&&$respond){$label=$metric==='vehicles'?'автомобилей':'активных заявок';kareta_json(['ok'=>false,'error'=>'tariff_limit_reached','metric'=>$metric,'message'=>'Лимит тарифа: '.$used.' из '.$limit.' '.$label.'.','tariff'=>$snapshot],409);}return $snapshot;
}

function kareta_tariff_current_subject(PDO $pdo): array {
    $user=kareta_session_user()?:[];$role=strtolower((string)($user['role']??''));
    if(function_exists('kareta_resolve_api_actor')){try{$actor=kareta_resolve_api_actor($pdo);$role=strtolower((string)($actor['role']??$role));if(!$user)$user=$actor;}catch(Throwable $_){}}
    if($role==='master'){
        $master=function_exists('kareta_master_workplace_profile')?kareta_master_workplace_profile($pdo):[];
        return ['type'=>'master','id'=>(string)($master['id']??''),'userId'=>(int)($master['user_id']??$user['id']??0),'phone'=>(string)($master['user_phone']??$user['phone']??''),'role'=>'master'];
    }
    $uid=(int)($user['id']??0);$phone=kareta_normalize_phone((string)($user['phone']??''));
    return ['type'=>'client','id'=>(string)$uid,'userId'=>$uid,'phone'=>$phone,'role'=>'client'];
}

function kareta_tariff_get_mine(PDO $pdo): void {
    $subject=kareta_tariff_current_subject($pdo);if($subject['id']===''||$subject['id']==='0')kareta_json(['ok'=>false,'error'=>'tariff_subject_not_found'],409);
    $type=(string)$subject['type'];$usage=$type==='master'?kareta_tariff_master_usage($pdo,(string)$subject['id'],date('Y-m-d')):kareta_tariff_client_usage($pdo,(int)$subject['userId'],(string)$subject['phone']);
    kareta_json(['ok'=>true,'data'=>['subject'=>$subject,'current'=>$usage['plan'],'plans'=>kareta_tariff_plan_rows($pdo,$type),'limits'=>$usage['limits'],'usage'=>$usage['usage'],'remaining'=>$usage['remaining']??[],'canAccept'=>$usage['canAccept']??true,'blockedMetric'=>$usage['blockedMetric']??'']]);
}

function kareta_tariff_assign(PDO $pdo,array $body): void {
    kareta_require_any_role(['admin','owner']);
    $subjectType=strtolower(trim((string)($body['subjectType']??'')));$subjectId=trim((string)($body['subjectId']??''));$planCode=trim((string)($body['planCode']??''));
    if(!in_array($subjectType,['client','master'],true)||$subjectId===''||$planCode==='')kareta_json(['ok'=>false,'error'=>'tariff_assignment_invalid'],422);
    $plan=null;foreach(kareta_tariff_plan_rows($pdo,$subjectType) as $p)if((string)$p['code']===$planCode){$plan=$p;break;}if(!$plan)kareta_json(['ok'=>false,'error'=>'tariff_plan_not_found'],404);
    $actor=(int)(kareta_session_user()['id']??0);$id='ta_'.substr(hash('sha256',$subjectType.'|'.$subjectId),0,28);
    $q=$pdo->prepare("INSERT INTO account_tariff_assignments(id,subject_type,subject_id,plan_code,status,starts_at,assigned_by_user_id) VALUES(?,?,?,?,'active',NOW(),?) ON DUPLICATE KEY UPDATE plan_code=VALUES(plan_code),status='active',starts_at=NOW(),ends_at=NULL,assigned_by_user_id=VALUES(assigned_by_user_id),updated_at=NOW()");
    $q->execute([$id,$subjectType,$subjectId,$planCode,$actor?:null]);
    if(function_exists('kareta_log_audit'))try{kareta_log_audit($pdo,'tariff.assign',['subjectType'=>$subjectType,'subjectId'=>$subjectId,'planCode'=>$planCode]);}catch(Throwable $_){}
    kareta_json(['ok'=>true,'plan'=>$plan]);
}


function kareta_tariff_admin_metric_schema(string $accountType): array {
    return $accountType==='master'
        ? [
            'acceptedRequestsPerDay'=>['label'=>'Принятых заявок в день','min'=>0,'max'=>1000],
            'activeIntakesPerDay'=>['label'=>'Активных приёмов на день','min'=>0,'max'=>1000],
            'openRepairs'=>['label'=>'Незакрытых машин в ремонте','min'=>0,'max'=>10000],
          ]
        : [
            'activeRequests'=>['label'=>'Активных заявок','min'=>0,'max'=>10000],
            'vehicles'=>['label'=>'Автомобилей в гараже','min'=>0,'max'=>10000],
          ];
}

function kareta_tariff_admin_list(PDO $pdo): void {
    kareta_require_any_role(['admin','owner']);
    $plans=kareta_tariff_plan_rows($pdo);
    foreach($plans as &$plan){$plan['editableLimits']=kareta_tariff_admin_metric_schema((string)$plan['accountType']);$plan['nameLocked']=true;$plan['paidLocked']=true;}
    unset($plan);
    kareta_json(['ok'=>true,'data'=>['plans'=>$plans,'count'=>count($plans)]]);
}

function kareta_tariff_update_plan(PDO $pdo,array $body): void {
    kareta_require_any_role(['admin','owner']);
    if(!function_exists('kareta_table_exists')||!kareta_table_exists($pdo,'account_tariff_plans'))kareta_json(['ok'=>false,'error'=>'migration_required','message'=>'Требуется миграция БД 123.'],503);
    $code=trim((string)($body['planCode']??''));$fallback=kareta_tariff_fallback_plans();
    if(!isset($fallback[$code]))kareta_json(['ok'=>false,'error'=>'tariff_plan_not_found'],404);
    $base=$fallback[$code];$accountType=(string)$base['accountType'];$schema=kareta_tariff_admin_metric_schema($accountType);$incoming=is_array($body['limits']??null)?$body['limits']:[];$limits=[];
    foreach($schema as $key=>$rule){
        if(!array_key_exists($key,$incoming))kareta_json(['ok'=>false,'error'=>'tariff_limit_required','metric'=>$key],422);
        $raw=$incoming[$key];if(!is_numeric($raw))kareta_json(['ok'=>false,'error'=>'tariff_limit_invalid','metric'=>$key],422);
        $value=(int)$raw;if($value<(int)$rule['min']||$value>(int)$rule['max'])kareta_json(['ok'=>false,'error'=>'tariff_limit_out_of_range','metric'=>$key,'min'=>$rule['min'],'max'=>$rule['max']],422);
        $limits[$key]=$value;
    }
    $isPaid=(bool)($base['isPaid']??false);$price=0.0;
    if($isPaid){$priceRaw=$body['monthlyPrice']??null;if($priceRaw===''||$priceRaw===null)$price=null;else{if(!is_numeric($priceRaw))kareta_json(['ok'=>false,'error'=>'tariff_price_invalid'],422);$price=(float)$priceRaw;if($price<0||$price>10000000)kareta_json(['ok'=>false,'error'=>'tariff_price_out_of_range'],422);}}
    $before=null;foreach(kareta_tariff_plan_rows($pdo,$accountType) as $row)if((string)$row['code']===$code){$before=$row;break;}
    $hasPaid=function_exists('kareta_column_exists')&&kareta_column_exists($pdo,'account_tariff_plans','is_paid');
    $sql="UPDATE account_tariff_plans SET name=?,description=?,monthly_price=?,limits_json=?,active=1".($hasPaid?',is_paid=?':'').",updated_at=NOW() WHERE code=? AND account_type=?";
    $params=[(string)$base['name'],(string)$base['description'],$price,json_encode($limits,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)];if($hasPaid)$params[]=$isPaid?1:0;$params[]=$code;$params[]=$accountType;
    $q=$pdo->prepare($sql);$q->execute($params);if($q->rowCount()===0){$exists=$pdo->prepare("SELECT COUNT(*) FROM account_tariff_plans WHERE code=? AND account_type=?");$exists->execute([$code,$accountType]);if(!(int)$exists->fetchColumn())kareta_json(['ok'=>false,'error'=>'tariff_plan_not_found'],404);}
    if(function_exists('kareta_log_audit'))try{kareta_log_audit($pdo,'tariff.plan.update',['planCode'=>$code,'accountType'=>$accountType,'beforeLimits'=>$before['limits']??[],'limits'=>$limits,'monthlyPrice'=>$price,'isPaid'=>$isPaid]);}catch(Throwable $_){}
    $updated=null;foreach(kareta_tariff_plan_rows($pdo,$accountType) as $row)if((string)$row['code']===$code){$updated=$row;break;}
    kareta_json(['ok'=>true,'data'=>['plan'=>$updated]]);
}
