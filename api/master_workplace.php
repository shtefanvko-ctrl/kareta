<?php
declare(strict_types=1);

require_once __DIR__.'/geo_core.php';

function kareta_master_workplace_identity_context(PDO $pdo): array {
    if (!class_exists('KaretaIdentityContextService')) return [];
    try {
        $service = new KaretaIdentityContextService($pdo);
        $account = $service->resolveAccount(kareta_session_user()??[]);
        if (!is_array($account) || (int)($account['id'] ?? 0) <= 0) return [];
        $context = $service->currentContext((int)$account['id']);
        return ['account'=>$account,'context'=>$context];
    } catch (Throwable $_) {
        return [];
    }
}

/** An incomplete MASTER cannot reach business data through a direct API call. */
function kareta_master_workplace_require_onboarding_completed(PDO $pdo): void {
    $identity=kareta_master_workplace_identity_context($pdo);
    $context=is_array($identity['context']??null)?$identity['context']:[];
    $type=strtolower((string)($context['profileType']??$context['profile_type']??''));
    if($type!=='master'){
        if($context || strtolower((string)(kareta_session_user()['role']??''))!=='master')return;
        kareta_json(['ok'=>false,'error'=>'master_context_required','message'=>'Выберите контекст Мастера'],409);
    }
    $profileId=(int)($context['profileId']??$context['profile_id']??0);
    if($profileId<=0)kareta_json(['ok'=>false,'error'=>'master_profile_context_invalid'],409);
    // Both mirrors must agree; completion updates them in the same transaction.
    $profileSql=kareta_column_exists($pdo,'person_profiles','onboarding_status')
        ? "SELECT onboarding_status FROM person_profiles WHERE id=? AND profile_type='master' AND status='active'"
        : "SELECT JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.onboardingStatus')) FROM person_profiles WHERE id=? AND profile_type='master' AND status='active'";
    $q=$pdo->prepare($profileSql);
    $q->execute([$profileId]);$profileStatus=(string)($q->fetchColumn()?:'not_started');
    $q=$pdo->prepare("SELECT status,current_step,current_view,draft_json FROM master_onboarding_state WHERE profile_id=?");
    $q->execute([$profileId]);$state=$q->fetch(PDO::FETCH_ASSOC)?:[];
    if($profileStatus==='completed'&&($state['status']??'')==='completed')return;
    $draft=json_decode((string)($state['draft_json']??''),true);$draft=is_array($draft)?$draft:[];
    $deferredUntil=strtotime((string)($draft['deferredUntil']??''));
    if($deferredUntil!==false&&$deferredUntil>time())return;
    kareta_json(['ok'=>false,'error'=>'master_onboarding_required','code'=>'MASTER_ONBOARDING_REQUIRED',
      'message'=>'Завершите обязательную анкету мастера','redirectRoute'=>'#/onboarding/master',
      'currentStep'=>max(1,min(4,(int)($state['current_step']??1)))],409);
}

function kareta_master_workplace_repair_profile(PDO $pdo,array $identity,array $user): array {
    $context=is_array($identity['context']??null)?$identity['context']:[];
    $account=is_array($identity['account']??null)?$identity['account']:[];
    $contextType=strtolower((string)($context['type']??''));
    $profileType=strtolower((string)($context['profileType']??$context['profile_type']??''));
    $uid=(int)($user['id']??0);
    $phone=kareta_normalize_phone((string)($user['phone']??$account['phone']??''));

    $authorized=($contextType==='profile'&&$profileType==='master') || strtolower((string)($user['role']??''))==='master';
    if(!$authorized&&$uid>0&&kareta_table_exists($pdo,'role_applications')){
        $q=$pdo->prepare("SELECT COUNT(*) FROM role_applications WHERE user_id=? AND requested_role='master' AND status='approved'");
        $q->execute([$uid]);$authorized=(int)$q->fetchColumn()>0;
    }
    if(!$authorized||!kareta_table_exists($pdo,'masters'))return [];

    $profileId=(int)($context['profileId']??$context['profile_id']??0);
    $personId=(int)($context['personId']??$context['person_id']??$account['personId']??0);
    $profile=[];
    if($profileId>0&&kareta_table_exists($pdo,'person_profiles')){
        $q=$pdo->prepare("SELECT id,person_id,legacy_entity_id FROM person_profiles WHERE id=? AND profile_type='master' AND status='active' LIMIT 1");
        $q->execute([$profileId]);$profile=$q->fetch(PDO::FETCH_ASSOC)?:[];
        $personId=(int)($profile['person_id']??$personId);
    }elseif($personId>0&&kareta_table_exists($pdo,'person_profiles')){
        $q=$pdo->prepare("SELECT id,person_id,legacy_entity_id FROM person_profiles WHERE person_id=? AND profile_type='master' AND status='active' ORDER BY id DESC LIMIT 1");
        $q->execute([$personId]);$profile=$q->fetch(PDO::FETCH_ASSOC)?:[];
        $profileId=(int)($profile['id']??0);
    }

    $legacyId=trim((string)($profile['legacy_entity_id']??''));
    if($legacyId!==''){
        $q=$pdo->prepare("SELECT * FROM masters WHERE BINARY id=BINARY ? LIMIT 1");$q->execute([$legacyId]);
        $row=$q->fetch(PDO::FETCH_ASSOC);
        if($row){
            if($uid>0||$phone!=='')$pdo->prepare("UPDATE masters SET user_id=CASE WHEN ?>0 THEN ? ELSE user_id END,user_phone=CASE WHEN ?<>'' THEN ? ELSE user_phone END,phone=CASE WHEN ?<>'' THEN ? ELSE phone END,active=1 WHERE BINARY id=BINARY ?")->execute([$uid,$uid,$phone,$phone,$phone,$phone,$legacyId]);
            return $row;
        }
    }

    if($uid>0||$phone!==''){
        $q=$pdo->prepare("SELECT * FROM masters WHERE active=1 AND (user_id=? OR user_phone=? OR phone=?) ORDER BY (user_id=?) DESC LIMIT 1");
        $q->execute([$uid?:-1,$phone,$phone,$uid?:-1]);$row=$q->fetch(PDO::FETCH_ASSOC);
        if($row){
            if($profileId>0)$pdo->prepare("UPDATE person_profiles SET legacy_entity_type='master',legacy_entity_id=?,status='active',updated_at=CURRENT_TIMESTAMP WHERE id=? AND profile_type='master'")->execute([(string)$row['id'],$profileId]);
            return $row;
        }
    }

    // Selected/approved Master identity is already authoritative. Repair only the
    // missing business row; do not create Master access for an unapproved account.
    $legacyUser=[];
    if($uid>0){$q=$pdo->prepare("SELECT id,phone,name,initials,spec FROM users WHERE id=? AND active=1 LIMIT 1");$q->execute([$uid]);$legacyUser=$q->fetch(PDO::FETCH_ASSOC)?:[];}
    if(!$legacyUser&&$phone!==''){$q=$pdo->prepare("SELECT id,phone,name,initials,spec FROM users WHERE phone=? AND active=1 LIMIT 1");$q->execute([$phone]);$legacyUser=$q->fetch(PDO::FETCH_ASSOC)?:[];}
    if(!$legacyUser&&$personId>0){
        $q=$pdo->prepare("SELECT u.id,a.phone,COALESCE(NULLIF(p.fullname,''),u.name) name,u.initials,u.spec FROM persons p JOIN accounts a ON a.id=p.account_id JOIN users u ON u.phone=a.phone AND u.active=1 WHERE p.id=? LIMIT 1");
        $q->execute([$personId]);$legacyUser=$q->fetch(PDO::FETCH_ASSOC)?:[];
    }
    $resolvedUid=(int)($legacyUser['id']??$uid);
    $resolvedPhone=kareta_normalize_phone((string)($legacyUser['phone']??$phone));
    if($resolvedUid<=0&&$resolvedPhone==='')return [];
    $name=trim((string)($legacyUser['name']??$user['name']??''))?:'Мастер KARETA.KZ';
    $initials=trim((string)($legacyUser['initials']??$user['initials']??''));
    $spec=trim((string)($legacyUser['spec']??$user['spec']??''));
    $candidate=$legacyId;
    if($candidate===''||mb_strlen($candidate,'UTF-8')>32)$candidate='master_user_'.substr(sha1($resolvedUid.'|'.$resolvedPhone),0,20);

    try{
        $stmt=$pdo->prepare("INSERT INTO masters(id,user_id,user_phone,name,phone,initials,spec,active) VALUES(?,?,?,?,?,?,?,1) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),user_phone=VALUES(user_phone),phone=VALUES(phone),name=COALESCE(NULLIF(masters.name,''),VALUES(name)),initials=COALESCE(NULLIF(masters.initials,''),VALUES(initials)),spec=COALESCE(NULLIF(masters.spec,''),VALUES(spec)),active=1");
        $stmt->execute([$candidate,$resolvedUid?:null,$resolvedPhone,$name,$resolvedPhone,$initials,$spec]);
        if($profileId>0)$pdo->prepare("UPDATE person_profiles SET legacy_entity_type='master',legacy_entity_id=?,status='active',updated_at=CURRENT_TIMESTAMP WHERE id=? AND profile_type='master'")->execute([$candidate,$profileId]);
        $q=$pdo->prepare("SELECT * FROM masters WHERE BINARY id=BINARY ? LIMIT 1");$q->execute([$candidate]);
        return $q->fetch(PDO::FETCH_ASSOC)?:[];
    }catch(Throwable $error){
        if(function_exists('kareta_log_audit'))try{kareta_log_audit($pdo,'master.profile_repair_failed',['profileId'=>$profileId,'personId'=>$personId,'candidate'=>$candidate,'error'=>$error->getMessage()]);}catch(Throwable $_){}
        return [];
    }
}

function kareta_master_workplace_profile(PDO $pdo): array {
    kareta_master_workplace_require_onboarding_completed($pdo);
    $user=kareta_session_user();
    $uid=(int)($user['id']??0);
    $phone=kareta_normalize_phone((string)($user['phone']??''));

    if(kareta_has_role('admin')||kareta_has_role('owner')){
        $id=trim((string)($_GET['masterId']??''));
        if($id!==''){
            $s=$pdo->prepare("SELECT * FROM masters WHERE id=? LIMIT 1");
            $s->execute([$id]);
            $row=$s->fetch(PDO::FETCH_ASSOC);
            if($row)return $row;
        }
    }

    // The selected Identity context is authoritative. This prevents data from
    // another master profile being shown when one account owns several contexts.
    $identity=kareta_master_workplace_identity_context($pdo);
    $context=is_array($identity['context']??null)?$identity['context']:[];
    if(strtolower((string)($context['profileType']??''))==='master'){
        $profileId=(int)($context['profileId']??0);
        if($profileId>0&&kareta_table_exists($pdo,'person_profiles')){
            $s=$pdo->prepare("SELECT legacy_entity_id,person_id FROM person_profiles WHERE id=? AND profile_type='master' AND status='active' LIMIT 1");
            $s->execute([$profileId]);
            $profile=$s->fetch(PDO::FETCH_ASSOC)?:[];
            $legacyId=trim((string)($profile['legacy_entity_id']??''));
            if($legacyId!==''){
                $m=$pdo->prepare("SELECT * FROM masters WHERE id=? AND active=1 LIMIT 1");
                $m->execute([$legacyId]);
                $row=$m->fetch(PDO::FETCH_ASSOC);
                if($row)return $row;
            }
            $personId=(int)($profile['person_id']??0);
            if($personId>0){
                $m=$pdo->prepare("SELECT m.* FROM persons p JOIN accounts a ON a.id=p.account_id LEFT JOIN users u ON u.phone=a.phone JOIN masters m ON (m.user_id=u.id OR m.user_phone=a.phone OR m.phone=a.phone) WHERE p.id=? AND m.active=1 ORDER BY (m.user_id=u.id) DESC LIMIT 1");
                $m->execute([$personId]);
                $row=$m->fetch(PDO::FETCH_ASSOC);
                if($row)return $row;
            }
        }
        $repaired=kareta_master_workplace_repair_profile($pdo,$identity,$user);
        if($repaired)return $repaired;
    }

    $s=$pdo->prepare("SELECT * FROM masters WHERE active=1 AND (user_id=? OR user_phone=? OR phone=?) ORDER BY (user_id=?) DESC LIMIT 1");
    $s->execute([$uid?:-1,$phone,$phone,$uid?:-1]);
    $row=$s->fetch(PDO::FETCH_ASSOC);
    if(!$row){
        $repaired=kareta_master_workplace_repair_profile($pdo,$identity,$user);
        if($repaired)$row=$repaired;
    }
    if(!$row) kareta_json(['ok'=>false,'error'=>'master_profile_not_found','message'=>'Профиль Мастера ещё не материализован. Переключите тип аккаунта или повторите загрузку.'],409);
    return $row;
}

function kareta_master_workplace_orders(PDO $pdo,array $master): array {
    $mid=(string)($master['id']??'');
    $uid=(int)($master['user_id']??0);
    $s=$pdo->prepare("SELECT o.*,(SELECT c.id FROM chats c WHERE c.order_id=o.id AND (c.master_id=? OR (COALESCE(c.master_id,'')='' AND c.master_user_id=?)) ORDER BY c.created_at DESC LIMIT 1) AS chat_id FROM orders o WHERE o.master_id=? OR (COALESCE(o.master_id,'')='' AND o.master_user_id=?) ORDER BY CASE WHEN o.date=CURDATE() THEN 0 ELSE 1 END,CASE WHEN o.date='' THEN 1 ELSE 0 END,o.date,o.time,o.created_at DESC LIMIT 120");
    $s->execute([$mid,$uid?:-1,$mid,$uid?:-1]);
    $rows=$s->fetchAll(PDO::FETCH_ASSOC)?:[];
    return array_map(static function($r){
        $o=_fmt_order($r);
        foreach(['stages','reports','orderParts','serviceIds'] as $k){if(isset($o[$k]))$o[$k]=kareta_work_order_decode($o[$k]);}
        return $o;
    },$rows);
}

function kareta_master_workplace_query_one(PDO $pdo,string $sql,array $params=[]): array {
    try{$s=$pdo->prepare($sql);$s->execute($params);return $s->fetch(PDO::FETCH_ASSOC)?:[];}catch(Throwable $_){return [];}
}
function kareta_master_workplace_query_all(PDO $pdo,string $sql,array $params=[]): array {
    try{$s=$pdo->prepare($sql);$s->execute($params);return $s->fetchAll(PDO::FETCH_ASSOC)?:[];}catch(Throwable $_){return [];}
}

function kareta_master_workplace_business(PDO $pdo,array $master,array $orders): array {
    $mid=(string)($master['id']??'');
    $uid=(int)($master['user_id']??0);
    $phone=kareta_normalize_phone((string)($master['user_phone']??$master['phone']??''));
    $uidArg=$uid?:-1;

    $aggregate=kareta_master_workplace_query_one($pdo,"SELECT
        COUNT(*) total_orders,
        SUM(CASE WHEN LOWER(status) IN ('accepted','assigned','process','in_progress','work','waiting_parts','waiting_approval') THEN 1 ELSE 0 END) active_orders,
        SUM(CASE WHEN LOWER(status) IN ('completed','done','delivered','closed') THEN 1 ELSE 0 END) completed_orders,
        SUM(CASE WHEN LOWER(status) IN ('completed','done','delivered','closed') AND COALESCE(completed_at,created_at)>=DATE_FORMAT(CURDATE(),'%Y-%m-01') THEN 1 ELSE 0 END) completed_month,
        COALESCE(SUM(CASE WHEN LOWER(status) IN ('completed','done','delivered','closed') AND COALESCE(completed_at,created_at)>=DATE_FORMAT(CURDATE(),'%Y-%m-01') THEN price ELSE 0 END),0) revenue_month,
        COALESCE(AVG(CASE WHEN LOWER(status) IN ('completed','done','delivered','closed') AND price>0 THEN price ELSE NULL END),0) average_ticket,
        COUNT(DISTINCT CASE WHEN client_user_id IS NOT NULL AND client_user_id>0 THEN CONCAT('u:',client_user_id) WHEN TRIM(client_phone)<>'' THEN CONCAT('p:',client_phone) ELSE NULL END) unique_clients
        FROM orders WHERE master_id=? OR (COALESCE(master_id,'')='' AND master_user_id=?)",[$mid,$uidArg]);

    $services=['configured'=>0,'active'=>0,'complete'=>0,'catalog'=>0];
    if(kareta_table_exists($pdo,'service_offers')){
        $row=kareta_master_workplace_query_one($pdo,"SELECT COUNT(*) configured,
            SUM(CASE WHEN active=1 AND booking_enabled=1 AND availability_status<>'paused' THEN 1 ELSE 0 END) active_count,
            SUM(CASE WHEN active=1 AND booking_enabled=1 AND price>0 AND duration_min>0 THEN 1 ELSE 0 END) complete_count
            FROM service_offers WHERE owner_type='master' AND owner_entity_id=?",[$mid]);
        $services=['configured'=>(int)($row['configured']??0),'active'=>(int)($row['active_count']??0),'complete'=>(int)($row['complete_count']??0),'catalog'=>0];
        if(kareta_table_exists($pdo,'service_catalog')){
            $catalog=kareta_master_workplace_query_one($pdo,"SELECT COUNT(*) cnt FROM service_catalog WHERE active=1");
            $services['catalog']=(int)($catalog['cnt']??0);
        }
    }

    $communication=['chats'=>0,'unreadChats'=>0,'unreadNotifications'=>0];
    if(kareta_table_exists($pdo,'chats')){
        $row=kareta_master_workplace_query_one($pdo,"SELECT COUNT(*) chats_count,COALESCE(SUM(unread_master),0) unread_count FROM chats WHERE master_id=? OR (COALESCE(master_id,'')='' AND master_user_id=?)",[$mid,$uidArg]);
        $communication['chats']=(int)($row['chats_count']??0);
        $communication['unreadChats']=(int)($row['unread_count']??0);
    }
    if(kareta_table_exists($pdo,'notifications')&&($uid>0||$phone!=='')){
        $row=kareta_master_workplace_query_one($pdo,"SELECT COUNT(*) cnt FROM notifications WHERE is_read=0 AND (recipient_user_id=? OR recipient_phone=?) AND (recipient_role='' OR recipient_role='master')",[$uidArg,$phone]);
        $communication['unreadNotifications']=(int)($row['cnt']??0);
    }

    $workDays=0;
    if(kareta_table_exists($pdo,'master_schedules')){
        $row=kareta_master_workplace_query_one($pdo,"SELECT COUNT(*) cnt FROM master_schedules WHERE master_id=? AND work_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(),INTERVAL 13 DAY) AND is_day_off=0",[$mid]);
        $workDays=(int)($row['cnt']??0);
    }

    $exchange=['available'=>0,'responses'=>0,'pending'=>0,'accepted'=>0,'winRate'=>0,'leads'=>[],'myResponses'=>[],'saved'=>[]];
    if(function_exists('kareta_master_exchange_fetch_state')){
        try{
            $state=kareta_master_exchange_fetch_state($pdo,$mid,$uid?:null);
            $hidden=array_flip(array_map('strval',$state['hidden']??[]));
            $saved=array_flip(array_map('strval',$state['saved']??[]));
            $responseMap=[];
            foreach(($state['responses']??[]) as $response)$responseMap[(string)($response['request_id']??'')]=$response;

            $rows=kareta_master_workplace_query_all($pdo,"SELECT o.*,(SELECT COUNT(*) FROM master_exchange_responses r WHERE r.request_id=o.id AND r.active=1 AND r.response_status NOT IN ('declined','cancelled','withdrawn')) responses_count FROM orders o WHERE (o.master_id IS NULL OR o.master_id='' OR o.master_id='0') AND o.status IN ('new','waiting_responses') AND o.type IN ('service_order','request','service') ORDER BY CASE WHEN o.priority IN ('urgent','high') THEN 0 ELSE 1 END,o.created_at DESC LIMIT 40");
            $offerIds=[];
            if(kareta_table_exists($pdo,'service_offers')){
                $offerRows=kareta_master_workplace_query_all($pdo,"SELECT service_id,price,price_type,price_max,duration_min,duration_max_min FROM service_offers WHERE owner_type='master' AND owner_entity_id=? AND active=1 AND booking_enabled=1 AND availability_status<>'paused'",[$mid]);
                $offerIds=array_values(array_filter(array_map(static fn($r)=>(string)($r['service_id']??''),$offerRows)));$offerMap=[];foreach($offerRows as $offerRow)$offerMap[(string)($offerRow['service_id']??'')]=$offerRow;
            }
            $leads=[];
            foreach($rows as $row){
                $id=(string)($row['id']??'');
                if($id===''||isset($hidden[$id]))continue;
                $requestServiceIds=json_decode((string)($row['service_ids']??'[]'),true);
                $requestServiceIds=is_array($requestServiceIds)?array_values(array_filter(array_map('strval',$requestServiceIds))):[];
                $serviceMatched=!$requestServiceIds ? true : ($offerIds ? (bool)array_intersect($offerIds,$requestServiceIds) : false);
                $item=_fmt_order($row);
                $item['clientName']='Клиент';$item['clientPhone']='';
                $item['saved']=isset($saved[$id]);
                $item['myResponse']=$responseMap[$id]??null;
                $item['responsesCount']=(int)($row['responses_count']??0);
                $matchedOffer=null;foreach($requestServiceIds as $serviceId){if(isset($offerMap[$serviceId])){$matchedOffer=$offerMap[$serviceId];break;}}$item['serviceMatched']=$serviceMatched;$item['suggestedPrice']=$matchedOffer?max(0,(int)round((float)($matchedOffer['price']??0))):max(0,(int)($row['price']??0));$item['suggestedDurationMin']=$matchedOffer?max(0,(int)($matchedOffer['duration_min']??0)):0;$item['matchReason']=!$requestServiceIds?'Доступна в общей бирже':($serviceMatched?'Совпадает с «Моими услугами»':'Вне «Моих услуг» — доступна для просмотра и отклика');
                $leads[]=$item;
                if(count($leads)>=12)break;
            }

            if(function_exists('kareta_master_exchange_notify_matching_items')){try{$notificationItems=[];foreach($leads as $lead){$copy=$lead;$copy['dispatch']=['serviceMatch'=>!empty($lead['serviceMatched'])?100:0];$notificationItems[]=$copy;}kareta_master_exchange_notify_matching_items($pdo,$mid,$uid?:null,$notificationItems);}catch(Throwable $_){}}
            $responses=array_values($state['responses']??[]);
            $orderMap=[];$requestIds=array_values(array_unique(array_filter(array_map(static fn($r)=>(string)($r['request_id']??''),$responses))));
            if($requestIds){
                $marks=implode(',',array_fill(0,count($requestIds),'?'));
                foreach(kareta_master_workplace_query_all($pdo,"SELECT id,service_names,client_car,vehicle_title,status,price,date,time,(SELECT c.id FROM chats c WHERE BINARY c.order_id=BINARY orders.id ORDER BY c.created_at DESC LIMIT 1) chat_id FROM orders WHERE id IN ($marks)",$requestIds) as $row)$orderMap[(string)$row['id']]=$row;
            }
            $mine=[];
            foreach(array_slice($responses,0,8) as $response){
                $requestId=(string)($response['request_id']??'');$order=$orderMap[$requestId]??[];
                $mine[]=array_merge($response,['serviceNames'=>(string)($order['service_names']??$response['request_title']??'Заявка'),'vehicleTitle'=>(string)($order['vehicle_title']??$order['client_car']??'Автомобиль'),'orderStatus'=>(string)($order['status']??''),'orderPrice'=>(int)($order['price']??0),'date'=>(string)($order['date']??''),'time'=>(string)($order['time']??'')]);
            }
            $acceptedResponses=array_values(array_filter($responses,static fn($r)=>in_array(strtolower((string)($r['response_status']??'')),['accepted','won'],true)));
            $accepted=count($acceptedResponses);
            $pending=count(array_filter($responses,static fn($r)=>in_array(strtolower((string)($r['response_status']??'')),['pending','viewed'],true)));
            $newAccepted=[];$planMap=[];$firstReplyMap=[];
            $acceptedIds=array_values(array_unique(array_filter(array_map(static fn($r)=>(string)($r['request_id']??''),$acceptedResponses))));
            if($acceptedIds){
                $marks=implode(',',array_fill(0,count($acceptedIds),'?'));
                if(kareta_table_exists($pdo,'master_order_plans'))foreach(kareta_master_workplace_query_all($pdo,"SELECT order_id,planned_start,planned_end,estimated_repair_min,source,conflict_override FROM master_order_plans WHERE BINARY master_id=BINARY ? AND order_id IN ($marks)",array_merge([$mid],$acceptedIds)) as $row)$planMap[(string)$row['order_id']]=$row;
                if(kareta_table_exists($pdo,'messages'))foreach(kareta_master_workplace_query_all($pdo,"SELECT order_id,MIN(created_at) first_reply_at FROM messages WHERE order_id IN ($marks) AND from_role='master' GROUP BY order_id",$acceptedIds) as $row)$firstReplyMap[(string)$row['order_id']]=(string)($row['first_reply_at']??'');
            }
            $schedulePrefs=kareta_master_schedule_preferences($pdo,$mid);$replySla=max(5,(int)($schedulePrefs['responseSlaMin']??15));$nowTs=time();
            usort($acceptedResponses,static fn($a,$b)=>strcmp((string)($b['accepted_at']??$b['updated_at']??''),(string)($a['accepted_at']??$a['updated_at']??'')));
            foreach($acceptedResponses as $response){
                $requestId=(string)($response['request_id']??'');$order=$orderMap[$requestId]??[];$status=strtolower((string)($order['status']??''));if(in_array($status,['cancelled','completed','done','delivered','closed'],true))continue;
                $acceptedAt=(string)($response['accepted_at']??$response['updated_at']??$response['created_at']??'');$acceptedTs=$acceptedAt!==''?(strtotime($acceptedAt)?:0):0;$replyDueTs=$acceptedTs>0?$acceptedTs+$replySla*60:0;$firstReply=(string)($firstReplyMap[$requestId]??'');
                $replyState=$firstReply!==''?'answered':(($replyDueTs>0&&$nowTs>$replyDueTs)?'overdue':'waiting');$plan=$planMap[$requestId]??[];$plannedStart=(string)($plan['planned_start']??'');$plannedTs=$plannedStart!==''?(strtotime($plannedStart)?:0):0;
                $startState=$plannedTs<=0?'unscheduled':($plannedTs<$nowTs?'overdue':(($plannedTs-$nowTs)<=7200?'soon':'planned'));
                $newAccepted[]=['orderId'=>$requestId,'responseId'=>(string)($response['id']??''),'serviceNames'=>(string)($order['service_names']??$response['request_title']??'Заявка'),'vehicleTitle'=>(string)($order['vehicle_title']??$order['client_car']??'Автомобиль'),'orderStatus'=>(string)($order['status']??''),'chatId'=>(string)($order['chat_id']??''),'acceptedAt'=>$acceptedAt,'replySlaMin'=>$replySla,'replyDueAt'=>$replyDueTs?date('Y-m-d H:i:s',$replyDueTs):'','replyState'=>$replyState,'firstReplyAt'=>$firstReply,'schedule'=>['plannedStart'=>$plannedStart,'plannedEnd'=>(string)($plan['planned_end']??''),'durationMin'=>(int)($plan['estimated_repair_min']??0),'source'=>(string)($plan['source']??''),'conflictOverride'=>!empty($plan['conflict_override']),'state'=>$startState]];
                if(count($newAccepted)>=6)break;
            }
            $exchange=['available'=>count($leads),'responses'=>count($responses),'pending'=>$pending,'accepted'=>$accepted,'winRate'=>count($responses)?(int)round($accepted*100/count($responses)):0,'leads'=>$leads,'myResponses'=>$mine,'newAccepted'=>$newAccepted,'newAcceptedCount'=>count($newAccepted),'saved'=>array_values(array_map('strval',$state['saved']??[]))];
        }catch(Throwable $_){}
    }

    $profileChecks=[trim((string)($master['name']??''))!=='',trim((string)($master['spec']??$master['specialization']??''))!=='',trim((string)($master['phone']??$master['user_phone']??''))!==''];
    $profileReady=count(array_filter($profileChecks));
    $readinessTotal=5;
    $readinessDone=$profileReady+($services['active']>0?1:0)+($workDays>0?1:0);
    $needs=[];
    if($profileReady<count($profileChecks))$needs[]='Заполнить профиль мастера';
    if($services['active']===0)$needs[]='Добавить услуги и цены';
    if($workDays===0)$needs[]='Настроить рабочий график';
    if($communication['unreadChats']>0)$needs[]='Ответить в непрочитанных чатах';

    return [
        'metrics'=>[
            'totalOrders'=>(int)($aggregate['total_orders']??count($orders)),
            'activeOrders'=>(int)($aggregate['active_orders']??0),
            'completedOrders'=>(int)($aggregate['completed_orders']??0),
            'completedMonth'=>(int)($aggregate['completed_month']??0),
            'revenueMonth'=>(int)round((float)($aggregate['revenue_month']??0)),
            'averageTicket'=>(int)round((float)($aggregate['average_ticket']??0)),
            'uniqueClients'=>(int)($aggregate['unique_clients']??0),
        ],
        'services'=>$services,
        'communication'=>$communication,
        'schedule'=>['workDaysNext14'=>$workDays],
        'exchange'=>$exchange,
        'readiness'=>['percent'=>(int)round($readinessDone*100/$readinessTotal),'needs'=>$needs],
    ];
}


function kareta_master_owner_profile_decode_json($value, array $fallback=[]): array {
    if (is_array($value)) return $value;
    if (!is_string($value) || trim($value)==='') return $fallback;
    $decoded=json_decode($value,true);
    return is_array($decoded)?$decoded:$fallback;
}
function kareta_master_owner_profile_column(PDO $pdo,string $column): bool {
    try{$q=$pdo->prepare("SHOW COLUMNS FROM `masters` LIKE ?");$q->execute([$column]);return (bool)$q->fetch(PDO::FETCH_ASSOC);}catch(Throwable $_){return false;}
}
function kareta_master_owner_profile_clean_list($value,int $limit=24,int $itemLimit=80): array {
    if(is_string($value))$value=preg_split('/[\\r\\n,;]+/u',$value)?:[];
    if(!is_array($value))return [];
    $out=[];
    foreach($value as $item){
        if(is_array($item))continue;
        $item=trim(kareta_clean_text((string)$item,$itemLimit));
        if($item!==''&&!in_array($item,$out,true))$out[]=$item;
        if(count($out)>=$limit)break;
    }
    return $out;
}
function kareta_master_owner_profile_clean_certificates($value): array {
    if(is_string($value))$value=preg_split('/[\\r\\n]+/u',$value)?:[];
    if(!is_array($value))return [];
    $out=[];
    foreach($value as $item){
        if(is_array($item)){
            $title=trim(kareta_clean_text((string)($item['title']??''),120));
            if($title==='')continue;
            $out[]=['title'=>$title,'issuer'=>kareta_clean_text((string)($item['issuer']??''),120),'year'=>kareta_clean_text((string)($item['year']??''),12)];
        }else{
            $line=trim(kareta_clean_text((string)$item,255));if($line==='')continue;
            $parts=array_map('trim',explode('|',$line));
            $out[]=['title'=>$parts[0]??'','issuer'=>$parts[1]??'','year'=>$parts[2]??''];
        }
        if(count($out)>=20)break;
    }
    return $out;
}
function kareta_master_owner_profile_get(PDO $pdo): void {
    $master=kareta_master_workplace_profile($pdo);$mid=(string)($master['id']??'');
    $resume=kareta_master_owner_profile_decode_json($master['resume']??null,[]);
    $primary=kareta_master_owner_profile_decode_json($master['primary_services']??null,[]);
    $uid=(int)($master['user_id']??0);$phone=kareta_normalize_phone((string)($master['user_phone']??$master['phone']??''));
    $user=[];
    try{
        if($uid>0){$q=$pdo->prepare("SELECT id,name,phone,email,city,avatar_url,bio FROM users WHERE id=? LIMIT 1");$q->execute([$uid]);$user=$q->fetch(PDO::FETCH_ASSOC)?:[];}
        if(!$user&&$phone!==''){$q=$pdo->prepare("SELECT id,name,phone,email,city,avatar_url,bio FROM users WHERE phone=? LIMIT 1");$q->execute([$phone]);$user=$q->fetch(PDO::FETCH_ASSOC)?:[];}
    }catch(Throwable $_){}
    $counts=['services'=>0,'works'=>0,'reviews'=>0];
    try{$q=$pdo->prepare("SELECT COUNT(*) FROM service_offers WHERE owner_type='master' AND owner_entity_id=? AND active=1");$q->execute([$mid]);$counts['services']=(int)$q->fetchColumn();}catch(Throwable $_){}
    try{if(kareta_table_exists($pdo,'work_posts')){$q=$pdo->prepare("SELECT COUNT(*) FROM work_posts WHERE master_id=? AND status='published'");$q->execute([$mid]);$counts['works']=(int)$q->fetchColumn();}}catch(Throwable $_){}
    try{if(kareta_table_exists($pdo,'master_reviews')){$q=$pdo->prepare("SELECT COUNT(*) FROM master_reviews mr JOIN orders o ON o.id=mr.order_id AND o.status='done' WHERE mr.master_id=? AND mr.status='published'");$q->execute([$mid]);$counts['reviews']=(int)$q->fetchColumn();}}catch(Throwable $_){}
    $profile=[
        'id'=>$mid,'name'=>(string)($master['name']??$user['name']??'Мастер'),'avatarUrl'=>(string)($user['avatar_url']??''),
        'spec'=>(string)($master['spec']??''),'description'=>(string)($master['description']??$resume['bio']??$user['bio']??''),'offerText'=>(string)($master['offer_text']??''),
        'experienceLabel'=>(string)($master['experience_label']??$resume['experience']??''),'city'=>(string)($master['city']??$user['city']??''),'district'=>(string)($master['district']??''),
        'workMode'=>(string)($master['work_mode']??$resume['workMode']??'shop'),'serviceAddress'=>(string)($master['service_address']??$resume['address']??''),'serviceRadiusKm'=>(int)($master['service_radius_km']??$resume['serviceRadius']??0),
        'locationVisibility'=>(string)($master['location_visibility']??'city'),'profileVisible'=>!isset($master['profile_visible'])||(bool)$master['profile_visible'],
        'primaryServices'=>kareta_master_owner_profile_clean_list($primary,30,100),'brands'=>kareta_master_owner_profile_clean_list($resume['brands']??[],40,80),
        'skills'=>kareta_master_owner_profile_clean_list($resume['skills']??[],40,100),'equipment'=>kareta_master_owner_profile_clean_list($resume['equipment']??[],40,120),
        'certificates'=>kareta_master_owner_profile_clean_certificates($resume['certificates']??[]),'education'=>(string)($resume['education']??''),'courses'=>(string)($resume['courses']??''),'awards'=>(string)($resume['awards']??''),'languages'=>kareta_master_owner_profile_clean_list($resume['languages']??[],12,60),
    ];
    $checks=[trim($profile['name'])!=='',trim($profile['spec'])!=='',trim($profile['description'])!=='',count($profile['primaryServices'])>0,trim($profile['experienceLabel'])!=='',count($profile['brands'])>0,$counts['services']>0];
    $ready=count(array_filter($checks));
    kareta_json(['ok'=>true,'data'=>['profile'=>$profile,'counts'=>$counts,'readiness'=>['percent'=>(int)round($ready*100/count($checks)),'completed'=>$ready,'total'=>count($checks)],'publicUrl'=>'#/masters/profile/master/'.rawurlencode($mid)]]);
}
function kareta_master_owner_profile_save(PDO $pdo,array $body): void {
    $master=kareta_master_workplace_profile($pdo);$mid=(string)($master['id']??'');
    kareta_assert_master_owns_profile($pdo,$mid);
    $section=strtolower(trim((string)($body['section']??'')));$data=is_array($body['data']??null)?$body['data']:[];
    if(!in_array($section,['basic','specialties','experience','expertise','publicity','avatar'],true))kareta_json(['ok'=>false,'error'=>'master_profile_section_invalid'],422);
    $resume=kareta_master_owner_profile_decode_json($master['resume']??null,[]);
    $sets=[];$vals=[];
    $put=function(string $column,$value)use(&$sets,&$vals,$pdo){if(kareta_master_owner_profile_column($pdo,$column)){$sets[]="`{$column}`=?";$vals[]=$value;}};
    if($section==='basic'){
        $name=trim(kareta_clean_text((string)($data['name']??$master['name']??''),191));if($name==='')kareta_json(['ok'=>false,'error'=>'master_name_required'],422);
        $spec=kareta_clean_text((string)($data['spec']??''),191);$description=kareta_clean_text((string)($data['description']??''),2500);$offer=kareta_clean_text((string)($data['offerText']??''),1000);
        $put('name',$name);$put('spec',$spec);$put('description',$description);$put('offer_text',$offer);$put('city',kareta_clean_text((string)($data['city']??''),120));$put('district',kareta_clean_text((string)($data['district']??''),120));
        $mode=strtolower((string)($data['workMode']??'shop'));if(!in_array($mode,['shop','mobile','both'],true))$mode='shop';$put('work_mode',$mode);$put('service_address',kareta_clean_text((string)($data['serviceAddress']??''),255));$put('service_radius_km',max(0,min(500,(int)($data['serviceRadiusKm']??0))));
        $visibility=strtolower((string)($data['locationVisibility']??'city'));if(!in_array($visibility,['hidden','city','district','exact'],true))$visibility='city';$put('location_visibility',$visibility);
        $resume['bio']=$description;$resume['workMode']=$mode;$resume['address']=kareta_clean_text((string)($data['serviceAddress']??''),255);$resume['serviceRadius']=max(0,min(500,(int)($data['serviceRadiusKm']??0)));
        try{$uid=(int)($master['user_id']??0);if($uid>0)$pdo->prepare("UPDATE users SET name=?,city=?,bio=? WHERE id=?")->execute([$name,kareta_clean_text((string)($data['city']??''),120),$description,$uid]);}catch(Throwable $_){}
    }elseif($section==='specialties'){
        $services=kareta_master_owner_profile_clean_list($data['primaryServices']??[],30,100);$put('primary_services',json_encode($services,JSON_UNESCAPED_UNICODE));
        if(isset($data['spec']))$put('spec',kareta_clean_text((string)$data['spec'],191));
    }elseif($section==='experience'){
        $experience=kareta_clean_text((string)($data['experienceLabel']??''),120);$put('experience_label',$experience);$resume['experience']=$experience;$resume['education']=kareta_clean_text((string)($data['education']??''),1500);$resume['courses']=kareta_clean_text((string)($data['courses']??''),2000);$resume['awards']=kareta_clean_text((string)($data['awards']??''),1500);$resume['languages']=kareta_master_owner_profile_clean_list($data['languages']??[],12,60);
    }elseif($section==='expertise'){
        $resume['brands']=kareta_master_owner_profile_clean_list($data['brands']??[],40,80);$resume['skills']=kareta_master_owner_profile_clean_list($data['skills']??[],40,100);$resume['equipment']=kareta_master_owner_profile_clean_list($data['equipment']??[],40,120);$resume['certificates']=kareta_master_owner_profile_clean_certificates($data['certificates']??[]);
    }elseif($section==='publicity'){
        $put('profile_visible',!empty($data['profileVisible'])?1:0);
    }elseif($section==='avatar'){
        $avatar=(string)($data['avatarUrl']??'');
        if($avatar!==''&&!preg_match('~^data:image/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\\r\\n]+$~',$avatar))kareta_json(['ok'=>false,'error'=>'avatar_invalid'],422);
        if(strlen($avatar)>2100000)kareta_json(['ok'=>false,'error'=>'avatar_too_large'],413);
        try{$uid=(int)($master['user_id']??0);$phone=kareta_normalize_phone((string)($master['user_phone']??$master['phone']??''));kareta_ensure_column($pdo,'users','avatar_url',"ALTER TABLE `users` ADD COLUMN `avatar_url` MEDIUMTEXT NULL AFTER `initials`");if($uid>0)$pdo->prepare("UPDATE users SET avatar_url=? WHERE id=?")->execute([$avatar,$uid]);elseif($phone!=='')$pdo->prepare("UPDATE users SET avatar_url=? WHERE phone=?")->execute([$avatar,$phone]);else kareta_json(['ok'=>false,'error'=>'master_user_link_missing'],409);}catch(Throwable $e){kareta_json(['ok'=>false,'error'=>'avatar_save_failed'],500);}
    }
    if($section!=='avatar'){$put('resume',json_encode($resume,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));if(!$sets)kareta_json(['ok'=>false,'error'=>'master_profile_columns_unavailable'],409);$vals[]=$mid;$pdo->prepare("UPDATE masters SET ".implode(',',$sets)." WHERE BINARY id=BINARY ?")->execute($vals);}
    kareta_log_audit($pdo,'master.profile.owner.save',['masterId'=>$mid,'section'=>$section]);
    kareta_json(['ok'=>true,'masterId'=>$mid,'section'=>$section]);
}

function kareta_master_workplace_preferences_defaults(): array {
    return [
        'windows'=>[
            'status'=>true,
            'summary'=>true,
            'attention'=>true,
            'nextOrder'=>true,
            'quickActions'=>true,
            'exchange'=>true,
            'newAccepted'=>true,
            'todayQueue'=>true,
            'upcoming'=>true,
        ],
        'params'=>[
            'exchangeLimit'=>6,
            'upcomingLimit'=>6,
            'autoRefreshSec'=>60,
            'compactCards'=>false,
        ],
    ];
}

function kareta_master_workplace_preferences_normalize($windows,$params): array {
    $defaults=kareta_master_workplace_preferences_defaults();
    $windows=is_array($windows)?$windows:[];
    $params=is_array($params)?$params:[];
    $cleanWindows=[];
    foreach($defaults['windows'] as $key=>$default)$cleanWindows[$key]=array_key_exists($key,$windows)?(bool)$windows[$key]:$default;
    $allowedExchange=[3,6,9,12];
    $allowedUpcoming=[3,6,9,12];
    $allowedRefresh=[0,30,60,120,300];
    $exchangeLimit=(int)($params['exchangeLimit']??$defaults['params']['exchangeLimit']);
    $upcomingLimit=(int)($params['upcomingLimit']??$defaults['params']['upcomingLimit']);
    $autoRefresh=(int)($params['autoRefreshSec']??$defaults['params']['autoRefreshSec']);
    return [
        'windows'=>$cleanWindows,
        'params'=>[
            'exchangeLimit'=>in_array($exchangeLimit,$allowedExchange,true)?$exchangeLimit:$defaults['params']['exchangeLimit'],
            'upcomingLimit'=>in_array($upcomingLimit,$allowedUpcoming,true)?$upcomingLimit:$defaults['params']['upcomingLimit'],
            'autoRefreshSec'=>in_array($autoRefresh,$allowedRefresh,true)?$autoRefresh:$defaults['params']['autoRefreshSec'],
            'compactCards'=>array_key_exists('compactCards',$params)?(bool)$params['compactCards']:$defaults['params']['compactCards'],
        ],
    ];
}

function kareta_master_workplace_preferences_get(PDO $pdo,array $master): array {
    $defaults=kareta_master_workplace_preferences_defaults();
    if(!kareta_table_exists($pdo,'master_workplace_preferences'))return $defaults;
    $mid=trim((string)($master['id']??''));
    if($mid==='')return $defaults;
    $st=$pdo->prepare("SELECT windows_json,params_json,updated_at FROM master_workplace_preferences WHERE BINARY master_id=BINARY ? LIMIT 1");
    $st->execute([$mid]);
    $row=$st->fetch(PDO::FETCH_ASSOC)?:[];
    if(!$row)return $defaults;
    $windows=json_decode((string)($row['windows_json']??''),true);
    $params=json_decode((string)($row['params_json']??''),true);
    $normalized=kareta_master_workplace_preferences_normalize($windows,$params);
    $normalized['updatedAt']=$row['updated_at']??null;
    return $normalized;
}

function kareta_master_workplace_preferences_save(PDO $pdo,array $body): void {
    $master=kareta_master_workplace_profile($pdo);
    if(!kareta_table_exists($pdo,'master_workplace_preferences'))kareta_json(['ok'=>false,'error'=>'master_workplace_preferences_unavailable','message'=>'Обновите схему базы данных до версии 117.'],409);
    $payload=is_array($body['preferences']??null)?$body['preferences']:$body;
    $normalized=kareta_master_workplace_preferences_normalize($payload['windows']??[],$payload['params']??[]);
    $identity=kareta_master_workplace_identity_context($pdo);
    $accountId=(int)($identity['account']['id']??0);
    if($accountId<=0&&function_exists('kareta_auth_resolve')){
        try{$resolved=kareta_auth_resolve($pdo,false);$accountId=(int)($resolved['account']['id']??0);}catch(Throwable $_){}
    }
    $mid=(string)$master['id'];
    $sql="INSERT INTO master_workplace_preferences(master_id,account_id,windows_json,params_json) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE account_id=VALUES(account_id),windows_json=VALUES(windows_json),params_json=VALUES(params_json),updated_at=CURRENT_TIMESTAMP";
    $pdo->prepare($sql)->execute([$mid,max(0,$accountId),json_encode($normalized['windows'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),json_encode($normalized['params'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
    if(function_exists('kareta_log_audit'))kareta_log_audit($pdo,'masterWorkplace.preferences.save',['masterId'=>$mid,'accountId'=>$accountId,'windows'=>$normalized['windows'],'params'=>$normalized['params']]);
    kareta_json(['ok'=>true,'preferences'=>kareta_master_workplace_preferences_get($pdo,$master)]);
}

function kareta_master_workplace_get(PDO $pdo): void {
    $master=kareta_master_workplace_profile($pdo);
    $mid=(string)$master['id'];
    $orders=kareta_master_workplace_orders($pdo,$master);
    $schedule=[];
    if(kareta_table_exists($pdo,'master_schedules')){
        $s=$pdo->prepare("SELECT * FROM master_schedules WHERE master_id=? AND work_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(),INTERVAL 7 DAY) ORDER BY work_date,start_time");
        $s->execute([$mid]);
        $schedule=array_map('kareta_fmt_master_schedule',$s->fetchAll(PDO::FETCH_ASSOC)?:[]);
    }
    $timers=[];
    if(kareta_table_exists($pdo,'work_order_timers')){
        $s=$pdo->prepare("SELECT id,order_id AS orderId,stage_key AS stageKey,started_at AS startedAt,stopped_at AS stoppedAt,duration_sec AS durationSec,status,note FROM work_order_timers WHERE master_id=? AND (status='running' OR started_at>=DATE_SUB(NOW(),INTERVAL 1 DAY)) ORDER BY started_at DESC");
        $s->execute([$mid]);$timers=$s->fetchAll(PDO::FETCH_ASSOC)?:[];
    }
    $today=date('Y-m-d');
    $todayOrders=array_values(array_filter($orders,fn($o)=>(string)($o['date']??'')===$today));
    $active=array_values(array_filter($orders,fn($o)=>in_array(strtolower((string)($o['status']??'')),['accepted','assigned','process','in_progress','work'],true)));
    $waiting=array_values(array_filter($orders,fn($o)=>in_array(strtolower((string)($o['status']??'')),['waiting_parts','waiting_approval','pending'],true)));
    $completedToday=array_values(array_filter($orders,fn($o)=>(string)($o['date']??'')===$today && in_array(strtolower((string)($o['status']??'')),['completed','done','delivered','closed'],true)));
    $identity=kareta_master_workplace_identity_context($pdo);
    $business=kareta_master_workplace_business($pdo,$master,$orders);
    $geoPoints=kareta_table_exists($pdo,'geo_points')?kareta_geo_owner_points($pdo,'master',$mid,false):[];
    kareta_json(['ok'=>true,'data'=>[
        'master'=>[
            'id'=>$mid,
            'name'=>(string)($master['name']??$master['full_name']??'Мастер'),
            'specialization'=>(string)($master['spec']??$master['specialization']??''),
            'rating'=>(float)($master['rating']??0),
            'availability'=>(string)($master['availability']??'online'),
            'availabilityLabel'=>kareta_master_availability_label((string)($master['availability']??'online')),
            'stoId'=>(string)($master['sto_id']??''),
            'stoName'=>(string)($master['sto_name']??''),
            'city'=>(string)($master['city']??''),
            'workMode'=>(string)($master['work_mode']??'shop'),
            'serviceAddress'=>(string)($master['service_address']??''),
            'serviceRadiusKm'=>(int)($master['service_radius_km']??0),
            'geoPoints'=>$geoPoints,
        ],
        'context'=>$identity['context']??null,
        'orders'=>$orders,
        'todayOrders'=>$todayOrders,
        'activeOrders'=>$active,
        'waitingOrders'=>$waiting,
        'completedToday'=>$completedToday,
        'schedule'=>$schedule,
        'timers'=>$timers,
        'business'=>$business,
        'preferences'=>kareta_master_workplace_preferences_get($pdo,$master),
        'generatedAt'=>date(DATE_ATOM),
    ]]);
}

function kareta_work_timer_start(PDO $pdo,array $b): void {
    $orderId=trim((string)($b['orderId']??''));$stage=trim((string)($b['stageKey']??'repair'))?:'repair';$order=kareta_work_order_require($pdo,$orderId,true);$master=kareta_master_workplace_profile($pdo);$mid=(string)$master['id'];
    $pdo->prepare("UPDATE work_order_timers SET stopped_at=NOW(),duration_sec=TIMESTAMPDIFF(SECOND,started_at,NOW()),status='stopped' WHERE master_id=? AND status='running'")->execute([$mid]);
    $id='wot_'.bin2hex(random_bytes(8));$pdo->prepare("INSERT INTO work_order_timers(id,order_id,stage_key,master_id,started_by_user_id,started_at,status,note) VALUES(?,?,?,?,?,NOW(),'running',?)")->execute([$id,$orderId,$stage,$mid,(int)(kareta_session_user()['id']??0)?:null,mb_substr(trim((string)($b['note']??'')),0,255)]);
    kareta_write_event($pdo,$orderId,'timer_started',['timerId'=>$id,'stageKey'=>$stage]);kareta_json(['ok'=>true,'timer'=>['id'=>$id,'orderId'=>$orderId,'stageKey'=>$stage,'status'=>'running','startedAt'=>date('Y-m-d H:i:s')]]);
}
function kareta_work_timer_stop(PDO $pdo,array $b): void {
    $id=trim((string)($b['timerId']??'')); if($id==='')kareta_json(['ok'=>false,'error'=>'timer_id_required'],422);
    $s=$pdo->prepare("SELECT * FROM work_order_timers WHERE id=? LIMIT 1");$s->execute([$id]);$timer=$s->fetch(PDO::FETCH_ASSOC);if(!$timer)kareta_json(['ok'=>false,'error'=>'timer_not_found'],404);kareta_work_order_require($pdo,(string)$timer['order_id'],true);
    $pdo->prepare("UPDATE work_order_timers SET stopped_at=NOW(),duration_sec=TIMESTAMPDIFF(SECOND,started_at,NOW()),status='stopped' WHERE id=? AND status='running'")->execute([$id]);
    $s=$pdo->prepare("SELECT duration_sec FROM work_order_timers WHERE id=?");$s->execute([$id]);$duration=(int)$s->fetchColumn();kareta_write_event($pdo,(string)$timer['order_id'],'timer_stopped',['timerId'=>$id,'stageKey'=>$timer['stage_key'],'durationSec'=>$duration]);kareta_json(['ok'=>true,'timerId'=>$id,'durationSec'=>$duration]);
}

function kareta_master_availability_label(string $status): string {
    return ['online'=>'Очередь свободна','busy'=>'Занят','lunch'=>'Обед','day_off'=>'Выходной'][strtolower($status)] ?? 'Очередь свободна';
}
function kareta_master_availability_save(PDO $pdo,array $b): void {
    $master=kareta_master_workplace_profile($pdo);$mid=(string)$master['id'];
    $status=strtolower(trim((string)($b['status']??'online')));
    if(!in_array($status,['online','busy','lunch','day_off'],true))kareta_json(['ok'=>false,'error'=>'invalid_master_status'],422);
    $pdo->prepare("UPDATE masters SET availability=? WHERE id=?")->execute([$status,$mid]);
    if(kareta_table_exists($pdo,'master_schedules')){
        $id='msh_'.substr(md5($mid.'|'.date('Y-m-d')),0,16);
        $dayOff=$status==='day_off'?1:0;
        $note=$status==='lunch'?'Обед':($status==='busy'?'Занят':($status==='online'?'Очередь свободна':'Выходной'));
        $pdo->prepare("INSERT INTO master_schedules(id,master_id,work_date,start_time,end_time,is_day_off,note) VALUES(?,?,CURDATE(),'09:00:00','18:00:00',?,?) ON DUPLICATE KEY UPDATE is_day_off=VALUES(is_day_off),note=VALUES(note),updated_at=CURRENT_TIMESTAMP")->execute([$id,$mid,$dayOff,$note]);
    }
    kareta_json(['ok'=>true,'status'=>$status,'label'=>kareta_master_availability_label($status)]);
}
function kareta_master_schedule_preferences(PDO $pdo, string $masterId): array {
    $buffer = 60;
    if (kareta_table_exists($pdo, 'master_schedule_preferences')) {
        $select=['intake_buffer_min','default_repair_min','response_sla_min','slot_step_min','capacity_warn_pct'];foreach(['auto_recovery_enabled','auto_notify_enabled','auto_recovery_mode','auto_recovery_horizon_days','auto_recovery_grace_min'] as $col)if(kareta_column_exists($pdo,'master_schedule_preferences',$col))$select[]=$col;
        $s=$pdo->prepare("SELECT ".implode(',',$select)." FROM master_schedule_preferences WHERE master_id=? LIMIT 1");
        $s->execute([$masterId]);
        $row=$s->fetch(PDO::FETCH_ASSOC) ?: [];
        $buffer=max(0,min(240,(int)($row['intake_buffer_min']??60)));
        $default=max(30,min(1440,(int)($row['default_repair_min']??120)));$responseSla=max(5,min(240,(int)($row['response_sla_min']??15)));$slotStep=max(15,min(120,(int)($row['slot_step_min']??30)));$capacityWarn=max(50,min(120,(int)($row['capacity_warn_pct']??90)));
    } else {$default=120;$responseSla=15;$slotStep=30;$capacityWarn=90;$row=[];}
    $mode=strtolower((string)($row['auto_recovery_mode']??'auto'));if(!in_array($mode,['off','notify','propose','auto'],true))$mode='auto';
    return ['intakeBufferMin'=>$buffer,'defaultRepairMin'=>$default,'responseSlaMin'=>$responseSla,'slotStepMin'=>$slotStep,'capacityWarnPct'=>$capacityWarn,'autoRecoveryEnabled'=>array_key_exists('auto_recovery_enabled',$row)?!empty($row['auto_recovery_enabled']):true,'autoNotifyEnabled'=>array_key_exists('auto_notify_enabled',$row)?!empty($row['auto_notify_enabled']):true,'autoRecoveryMode'=>$mode,'autoRecoveryHorizonDays'=>max(1,min(30,(int)($row['auto_recovery_horizon_days']??14))),'autoRecoveryGraceMin'=>max(0,min(120,(int)($row['auto_recovery_grace_min']??15)))];
}
function kareta_master_schedule_status_label(string $status): string {
    return ['new'=>'Новая','accepted'=>'Принята','in_progress'=>'В работе','work'=>'В работе','waiting_parts'=>'Ожидание запчастей','waiting_approval'=>'Согласование','completed'=>'Завершена','done'=>'Завершена','delivered'=>'Выдана'][strtolower($status)] ?? 'Запланировано';
}
function kareta_master_schedule_add_minutes(string $time, int $minutes): string {
    $base=DateTimeImmutable::createFromFormat('H:i',substr($time,0,5)) ?: new DateTimeImmutable('09:00');
    return $base->modify('+'.max(0,$minutes).' minutes')->format('H:i');
}

function kareta_master_schedule_parse_proposal_datetime(string $value, string $fallbackDate=''): ?DateTimeImmutable {
    $raw=trim($value);if($raw==='')return null;
    $tz=new DateTimeZone(date_default_timezone_get());
    foreach(['Y-m-d\\TH:i','Y-m-d H:i','d.m.Y H:i','d.m.y H:i'] as $format){$dt=DateTimeImmutable::createFromFormat('!'.$format,$raw,$tz);if($dt instanceof DateTimeImmutable)return $dt;}
    $lower=mb_strtolower($raw,'UTF-8');
    $base=null;$explicitDay=false;
    if(str_contains($lower,'сегодня')){$base=new DateTimeImmutable('today',$tz);$explicitDay=true;}
    elseif(str_contains($lower,'завтра')){$base=new DateTimeImmutable('tomorrow',$tz);$explicitDay=true;}
    elseif(preg_match('/\\b(\\d{1,2})[.\\/-](\\d{1,2})(?:[.\\/-](\\d{2,4}))?\\b/u',$raw,$m)){
        $year=(int)($m[3]??date('Y'));if($year<100)$year+=2000;
        try{$base=new DateTimeImmutable(sprintf('%04d-%02d-%02d',$year,(int)$m[2],(int)$m[1]),$tz);$explicitDay=true;}catch(Throwable $_){}
    }
    if(!$base){
        $fallback=preg_match('/^\\d{4}-\\d{2}-\\d{2}$/',$fallbackDate)?$fallbackDate:date('Y-m-d');
        try{$base=new DateTimeImmutable($fallback.' 00:00:00',$tz);}catch(Throwable $_){$base=new DateTimeImmutable('today',$tz);}
    }
    if(!preg_match('/\\b([01]?\\d|2[0-3])[:.](\\d{2})\\b/u',$raw,$tm))return null;
    $dt=$base->setTime((int)$tm[1],(int)$tm[2]);
    if(!$explicitDay && $fallbackDate==='' && $dt<new DateTimeImmutable('-15 minutes',$tz))$dt=$dt->modify('+1 day');
    return $dt;
}
function kareta_master_schedule_parse_duration_minutes(string $value, int $fallback=120): int {
    $raw=mb_strtolower(trim($value),'UTF-8');if($raw==='')return max(15,min(1440,$fallback));
    preg_match_all('/\\d+(?:[.,]\\d+)?/u',$raw,$matches);$nums=array_map(static fn($v)=>(float)str_replace(',','.',$v),$matches[0]??[]);if(!$nums)return max(15,min(1440,$fallback));
    $n=max($nums);$minutes=(str_contains($raw,'час')||preg_match('/(?:^|\\s)ч(?:\\.|\\s|$)/u',$raw))?(int)round($n*60):(int)round($n);
    return max(15,min(1440,$minutes?:$fallback));
}
function kareta_master_schedule_order_duration(PDO $pdo,string $masterId,array $order): array {
    $prefs=kareta_master_schedule_preferences($pdo,$masterId);$serviceIds=json_decode((string)($order['service_ids']??'[]'),true);$serviceIds=is_array($serviceIds)?array_values(array_unique(array_filter(array_map('strval',$serviceIds)))):[];
    $minutes=0;$matched=0;$parts=[];
    if($serviceIds&&kareta_table_exists($pdo,'service_offers')){
        $marks=implode(',',array_fill(0,count($serviceIds),'?'));$q=$pdo->prepare("SELECT service_id,duration_min,duration_max_min FROM service_offers WHERE owner_type='master' AND BINARY owner_entity_id=BINARY ? AND active=1 AND booking_enabled=1 AND availability_status<>'paused' AND service_id IN ($marks)");$q->execute(array_merge([$masterId],$serviceIds));$offers=[];foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r)$offers[(string)$r['service_id']]=$r;
        $services=[];if(kareta_table_exists($pdo,'services')){$q=$pdo->prepare("SELECT id,name,avg_time FROM services WHERE id IN ($marks)");$q->execute($serviceIds);foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r)$services[(string)$r['id']]=$r;}
        foreach($serviceIds as $sid){$offer=$offers[$sid]??[];$svc=$services[$sid]??[];$own=max(0,(int)($offer['duration_min']??0));$standard=$own<=0?kareta_master_schedule_parse_duration_minutes((string)($svc['avg_time']??''),0):0;$m=$own>0?$own:$standard;if($m>0){$minutes+=$m;if($own>0)$matched++;$parts[]=['serviceId'=>$sid,'name'=>(string)($svc['name']??$sid),'minutes'=>$m,'source'=>$own>0?'my_services':'standard'];}}
    }
    $fallback=max(30,(int)($order['estimated_duration_min']??$prefs['defaultRepairMin']??120));$known=count($parts);if($minutes<=0)$minutes=$fallback;elseif($serviceIds&&$known<count($serviceIds))$minutes=max($minutes,$fallback);$buffer=max(0,(int)($prefs['intakeBufferMin']??60));$total=count($serviceIds);$source=$total===0?'order_default':($matched>0&&$matched===$total?'my_services':($matched>0?'mixed':'standard_or_order'));
    return ['serviceMinutes'=>max(15,min(1440,$minutes)),'bufferMin'=>$buffer,'reservedMinutes'=>max(15,min(1680,$minutes+$buffer)),'source'=>$source,'matchedServices'=>$matched,'totalServices'=>$total,'parts'=>$parts];
}
function kareta_master_schedule_day_bounds(PDO $pdo,string $masterId,string $date): array {
    $start='09:00';$end='18:00';$dayOff=false;$note='';$source='default';
    $explicit=[];
    if(kareta_table_exists($pdo,'master_schedules')){$q=$pdo->prepare("SELECT start_time,end_time,is_day_off,note FROM master_schedules WHERE BINARY master_id=BINARY ? AND work_date=? LIMIT 1");$q->execute([$masterId,$date]);$explicit=$q->fetch(PDO::FETCH_ASSOC)?:[];}
    if($explicit){$start=substr((string)($explicit['start_time']??$start),0,5);$end=substr((string)($explicit['end_time']??$end),0,5);$dayOff=!empty($explicit['is_day_off']);$note=(string)($explicit['note']??'');$source='exception';}
    elseif(function_exists('kareta_master_weekly_shift_for_date')){$weekly=kareta_master_weekly_shift_for_date($pdo,$masterId,$date);$start=substr((string)($weekly['startTime']??$start),0,5);$end=substr((string)($weekly['endTime']??$end),0,5);$dayOff=!empty($weekly['isDayOff']);$note=(string)($weekly['note']??'');$source='weekly';}
    if($dayOff){$start=$start?:'09:00';$end=$end?:'18:00';}
    $extension=[];if(!$dayOff&&function_exists('kareta_master_shift_extension_for_date')){$extension=kareta_master_shift_extension_for_date($pdo,$masterId,$date);$extended=substr((string)($extension['endTime']??''),0,5);if(preg_match('/^\d{2}:\d{2}$/',$extended)&&$extended>$end){$end=$extended;$source.='+extension';$note=trim($note.($note!==''?' · ':'').($extension['note']??'Продление смены'));}}
    try{$from=new DateTimeImmutable($date.' '.$start);$to=new DateTimeImmutable($date.' '.$end);}catch(Throwable $_){$from=new DateTimeImmutable($date.' 09:00');$to=new DateTimeImmutable($date.' 18:00');}
    if($to<=$from)$to=$from->modify('+9 hours');
    return ['start'=>$from,'end'=>$to,'isDayOff'=>$dayOff,'note'=>$note,'source'=>$source,'extension'=>$extension,'grossWorkMinutes'=>$dayOff?0:max(0,(int)(($to->getTimestamp()-$from->getTimestamp())/60)),'workMinutes'=>$dayOff?0:max(0,(int)(($to->getTimestamp()-$from->getTimestamp())/60))];
}
function kareta_master_schedule_day_intervals(PDO $pdo,string $masterId,string $date,string $excludeOrderId=''): array {
    $out=[];
    if(kareta_table_exists($pdo,'master_order_plans')){$sql="SELECT order_id,planned_start,planned_end FROM master_order_plans WHERE BINARY master_id=BINARY ? AND DATE(planned_start)=? AND planned_start IS NOT NULL AND planned_end IS NOT NULL AND status NOT IN ('done','completed','cancelled','closed','no_show')";$args=[$masterId,$date];if($excludeOrderId!==''){$sql.=" AND BINARY order_id<>BINARY ?";$args[]=$excludeOrderId;}$sql.=' ORDER BY planned_start';$q=$pdo->prepare($sql);$q->execute($args);foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r){try{$out[]=['type'=>'order','orderId'=>(string)$r['order_id'],'title'=>'Заказ','start'=>new DateTimeImmutable((string)$r['planned_start']),'end'=>new DateTimeImmutable((string)$r['planned_end'])];}catch(Throwable $_){}}}
    if(function_exists('kareta_master_schedule_blocked_intervals'))foreach(kareta_master_schedule_blocked_intervals($pdo,$masterId,$date) as $block)$out[]=$block;
    usort($out,static fn($a,$b)=>$a['start']<=>$b['start']);return $out;
}
function kareta_master_schedule_capacity_for_day(PDO $pdo,string $masterId,string $date,string $excludeOrderId=''): array {
    $bounds=kareta_master_schedule_day_bounds($pdo,$masterId,$date);$gross=max(0,(int)($bounds['grossWorkMinutes']??$bounds['workMinutes']??0));$blocked=(!$bounds['isDayOff']&&function_exists('kareta_master_schedule_blocked_minutes'))?kareta_master_schedule_blocked_minutes($pdo,$masterId,$date,$bounds['start'],$bounds['end']):0;$capacity=max(0,$gross-$blocked);$booked=0;
    foreach(kareta_master_schedule_day_intervals($pdo,$masterId,$date,$excludeOrderId) as $row){if(($row['type']??'')!=='order')continue;$start=$row['start']<$bounds['start']?$bounds['start']:$row['start'];$end=$row['end']>$bounds['end']?$bounds['end']:$row['end'];if($end>$start)$booked+=(int)(($end->getTimestamp()-$start->getTimestamp())/60);}
    $pct=$capacity>0?round($booked*100/$capacity,1):($booked>0?100:0);return ['date'=>$date,'workMinutes'=>$capacity,'grossWorkMinutes'=>$gross,'blockedMinutes'=>$blocked,'bookedMinutes'=>$booked,'freeMinutes'=>max(0,$capacity-$booked),'loadPct'=>$pct,'isDayOff'=>(bool)$bounds['isDayOff'],'startTime'=>$bounds['start']->format('H:i'),'endTime'=>$bounds['end']->format('H:i'),'source'=>(string)($bounds['source']??'default')];
}
function kareta_master_schedule_free_slots_for_order(PDO $pdo,string $masterId,array $order,int $days=10): array {
    $duration=kareta_master_schedule_order_duration($pdo,$masterId,$order);$need=(int)$duration['reservedMinutes'];$prefs=kareta_master_schedule_preferences($pdo,$masterId);$step=max(15,(int)($prefs['slotStepMin']??30));$warn=max(50,(int)($prefs['capacityWarnPct']??90));$slots=[];$daysOut=[];$today=new DateTimeImmutable('today');$now=new DateTimeImmutable('now');$orderId=(string)($order['id']??'');
    for($i=0;$i<max(1,min(21,$days));$i++){$date=$today->modify('+'.$i.' day')->format('Y-m-d');$bounds=kareta_master_schedule_day_bounds($pdo,$masterId,$date);$capacity=kareta_master_schedule_capacity_for_day($pdo,$masterId,$date,$orderId);$tariffDay=function_exists('kareta_tariff_master_usage')?kareta_tariff_master_usage($pdo,$masterId,$date,$orderId):[];$intakeLimit=(int)($tariffDay['limits']['activeIntakesPerDay']??0);$intakeUsed=(int)($tariffDay['usage']['activeIntakesOnDate']??0);$intakeFull=$intakeLimit>0&&$intakeUsed>=$intakeLimit;$daySlots=[];if(!$intakeFull&&!$bounds['isDayOff']&&$bounds['end']>$bounds['start']){$cursor=$bounds['start'];if($cursor<$now){$cursor=$now->modify('+10 minutes');$mins=(int)$cursor->format('i');$rounded=(int)(ceil($mins/$step)*$step);if($rounded>=60){$next=$cursor->modify('+1 hour');$cursor=$next->setTime((int)$next->format('H'),0);}else{$cursor=$cursor->setTime((int)$cursor->format('H'),$rounded);}}$intervals=kareta_master_schedule_day_intervals($pdo,$masterId,$date,$orderId);while($cursor->modify('+'.$need.' minutes')<=$bounds['end']){$end=$cursor->modify('+'.$need.' minutes');$blocked=false;foreach($intervals as $busy){if($cursor<$busy['end']&&$end>$busy['start']){$blocked=true;break;}}if(!$blocked){$projected=$capacity['workMinutes']>0?round(($capacity['bookedMinutes']+$need)*100/$capacity['workMinutes'],1):100;$slot=['start'=>$cursor->format('Y-m-d H:i:s'),'end'=>$end->format('Y-m-d H:i:s'),'date'=>$date,'startTime'=>$cursor->format('H:i'),'endTime'=>$end->format('H:i'),'workMinutes'=>(int)$duration['serviceMinutes'],'bufferMin'=>(int)$duration['bufferMin'],'reservedMinutes'=>$need,'projectedLoadPct'=>$projected,'capacityWarning'=>$projected>$warn];$slots[]=$slot;$daySlots[]=$slot;if(count($slots)>=36)break 2;}$cursor=$cursor->modify('+'.$step.' minutes');}}$daysOut[]=$capacity+['slotsCount'=>count($daySlots),'capacityWarning'=>$capacity['loadPct']>$warn,'tariffIntakeFull'=>$intakeFull,'tariffIntakesUsed'=>$intakeUsed,'tariffIntakesLimit'=>$intakeLimit];}
    return ['duration'=>$duration,'preferences'=>['slotStepMin'=>$step,'capacityWarnPct'=>$warn],'slots'=>$slots,'days'=>$daysOut];
}
function kareta_master_schedule_order_for_master(PDO $pdo,string $masterId,int $masterUserId,string $orderId): array {
    $q=$pdo->prepare("SELECT o.*,(SELECT c.id FROM chats c WHERE BINARY c.order_id=BINARY o.id ORDER BY c.created_at DESC LIMIT 1) chat_id FROM orders o WHERE BINARY o.id=BINARY ? AND (BINARY o.master_id=BINARY ? OR (COALESCE(o.master_id,'')='' AND o.master_user_id=?)) LIMIT 1");$q->execute([$orderId,$masterId,$masterUserId?:-1]);return $q->fetch(PDO::FETCH_ASSOC)?:[];
}
function kareta_master_schedule_reschedule_guard(PDO $pdo,array $order): ?array {
    $orderId=(string)($order['id']??'');$status=strtolower((string)($order['status']??''));if(in_array($status,['completed','done','delivered','closed','cancelled'],true))return ['error'=>'order_closed','message'=>'Закрытый или отменённый заказ нельзя переносить.'];if(kareta_table_exists($pdo,'work_order_timers')){$q=$pdo->prepare("SELECT COUNT(*) FROM work_order_timers WHERE BINARY order_id=BINARY ? AND status='running'");$q->execute([$orderId]);if((int)$q->fetchColumn()>0)return ['error'=>'work_already_started','message'=>'Работа уже начата. Сначала завершите активный рабочий этап.'];}if(kareta_table_exists($pdo,'sto_bay_assignments')){$q=$pdo->prepare("SELECT COUNT(*) FROM sto_bay_assignments WHERE BINARY order_id=BINARY ? AND status='active'");$q->execute([$orderId]);if((int)$q->fetchColumn()>0)return ['error'=>'bay_already_active','message'=>'Автомобиль уже находится в активном боксе СТО. Перенос недоступен.'];}return null;
}
function kareta_master_schedule_free_slots(PDO $pdo,array $body): void {
    $master=kareta_master_workplace_profile($pdo);$mid=(string)$master['id'];$orderId=trim((string)($body['orderId']??''));if($orderId==='')kareta_json(['ok'=>false,'error'=>'order_id_required'],422);$order=kareta_master_schedule_order_for_master($pdo,$mid,(int)($master['user_id']??0),$orderId);if(!$order)kareta_json(['ok'=>false,'error'=>'order_not_found'],404);if($guard=kareta_master_schedule_reschedule_guard($pdo,$order))kareta_json(['ok'=>false]+$guard,409);$result=kareta_master_schedule_free_slots_for_order($pdo,$mid,$order,(int)($body['days']??10));kareta_json(['ok'=>true,'order'=>['id'=>$orderId,'serviceNames'=>(string)($order['service_names']??''),'vehicleTitle'=>(string)($order['vehicle_title']??$order['client_car']??'Автомобиль')],'result'=>$result]);
}
function kareta_master_schedule_reschedule_propose(PDO $pdo,array $body): void {
    if(!kareta_table_exists($pdo,'master_reschedule_proposals'))kareta_json(['ok'=>false,'error'=>'migration_required','message'=>'Требуется миграция БД 120.'],503);$master=kareta_master_workplace_profile($pdo);$mid=(string)$master['id'];$orderId=trim((string)($body['orderId']??''));$startRaw=trim((string)($body['plannedStart']??''));$reason=mb_substr(trim((string)($body['reason']??'')),0,500);if($orderId===''||$startRaw==='')kareta_json(['ok'=>false,'error'=>'order_and_start_required'],422);$order=kareta_master_schedule_order_for_master($pdo,$mid,(int)($master['user_id']??0),$orderId);if(!$order)kareta_json(['ok'=>false,'error'=>'order_not_found'],404);if($guard=kareta_master_schedule_reschedule_guard($pdo,$order))kareta_json(['ok'=>false]+$guard,409);$start=kareta_master_schedule_parse_proposal_datetime($startRaw,(string)($order['date']??''));if(!$start||$start<=new DateTimeImmutable('+5 minutes'))kareta_json(['ok'=>false,'error'=>'future_start_required','message'=>'Выберите свободное время в будущем.'],422);if(function_exists('kareta_tariff_master_intake_guard'))kareta_tariff_master_intake_guard($pdo,$mid,$start->format('Y-m-d'),$orderId,true);$durationInfo=kareta_master_schedule_order_duration($pdo,$mid,$order);$work=max(15,min(1440,(int)($body['durationMin']??$durationInfo['serviceMinutes'])));$buffer=max(0,(int)$durationInfo['bufferMin']);$end=$start->modify('+'.($work+$buffer).' minutes');$conflicts=kareta_master_schedule_conflicts($pdo,$mid,$start,$end,$orderId,true);if($conflicts)kareta_json(['ok'=>false,'error'=>'schedule_conflict','message'=>'Выбранное окно уже занято.','preview'=>['plannedStart'=>$start->format('Y-m-d H:i:s'),'plannedEnd'=>$end->format('Y-m-d H:i:s'),'durationMin'=>$work,'bufferMin'=>$buffer,'conflicts'=>$conflicts]],409);
    try{$pdo->beginTransaction();$q=$pdo->prepare("SELECT id,proposed_start,duration_min FROM master_reschedule_proposals WHERE BINARY order_id=BINARY ? AND BINARY master_id=BINARY ? AND status='pending' ORDER BY created_at DESC LIMIT 1 FOR UPDATE");$q->execute([$orderId,$mid]);$existing=$q->fetch(PDO::FETCH_ASSOC)?:[];if($existing&&(string)$existing['proposed_start']===$start->format('Y-m-d H:i:s')&&(int)$existing['duration_min']===$work){$pdo->commit();kareta_json(['ok'=>true,'idempotent'=>true,'proposalId'=>(string)$existing['id']]);}$pdo->prepare("UPDATE master_reschedule_proposals SET status='cancelled',responded_at=NOW(),decision_note='superseded',updated_at=NOW() WHERE BINARY order_id=BINARY ? AND status='pending'")->execute([$orderId]);$id='rsp_'.substr(hash('sha256',$orderId.'|'.$mid.'|'.$start->format('c').'|'.microtime(true)),0,28);$pdo->prepare("INSERT INTO master_reschedule_proposals(id,order_id,master_id,client_user_id,proposed_start,proposed_end,duration_min,buffer_min,reason,status) VALUES(?,?,?,?,?,?,?,?,?,'pending')")->execute([$id,$orderId,$mid,(int)($order['client_user_id']??0)?:null,$start->format('Y-m-d H:i:s'),$end->format('Y-m-d H:i:s'),$work,$buffer,$reason]);$chatId=(string)($order['chat_id']??'');$human=$start->format('d.m.Y H:i');$text='Мастер предложил перенести запись на '.$human.'. Работа '.$work.' мин.'.($buffer>0?' Резерв '.$buffer.' мин.':'').($reason!==''?' Причина: '.$reason:'');kareta_master_schedule_write_system_message($pdo,$orderId,$chatId,$text,'reschedule-proposal|'.$id);try{kareta_notification_insert($pdo,['recipientUserId'=>(int)($order['client_user_id']??0)?:null,'recipientPhone'=>(string)($order['client_phone']??''),'recipientRole'=>'client','eventType'=>'order.reschedule.proposed','entityType'=>'order','entityId'=>$orderId,'title'=>'Мастер предлагает перенести запись','body'=>$human.($reason!==''?' · '.$reason:''),'actionUrl'=>'#/orders','meta'=>['orderId'=>$orderId,'proposalId'=>$id,'chatId'=>$chatId,'plannedStart'=>$start->format('Y-m-d H:i:s')]]);}catch(Throwable $_){}$pdo->commit();try{kareta_write_event($pdo,$orderId,'reschedule_proposed',['masterId'=>$mid,'proposalId'=>$id,'plannedStart'=>$start->format('Y-m-d H:i:s'),'plannedEnd'=>$end->format('Y-m-d H:i:s'),'durationMin'=>$work,'bufferMin'=>$buffer]);}catch(Throwable $_){}kareta_json(['ok'=>true,'proposal'=>['id'=>$id,'orderId'=>$orderId,'plannedStart'=>$start->format('Y-m-d H:i:s'),'plannedEnd'=>$end->format('Y-m-d H:i:s'),'durationMin'=>$work,'bufferMin'=>$buffer,'reason'=>$reason,'status'=>'pending']]);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'reschedule_proposal_failed','message'=>$e->getMessage()],500);}
}
function kareta_client_schedule_owned_order(PDO $pdo,string $orderId): array {
    $user=kareta_session_user();$uid=(int)($user['id']??0);$phone=kareta_normalize_phone((string)($user['phone']??''));$q=$pdo->prepare("SELECT o.*,(SELECT c.id FROM chats c WHERE BINARY c.order_id=BINARY o.id ORDER BY c.created_at DESC LIMIT 1) chat_id FROM orders o WHERE BINARY o.id=BINARY ? AND (o.client_user_id=? OR (?<>'' AND o.client_phone=?)) LIMIT 1");$q->execute([$orderId,$uid?:-1,$phone,$phone]);return $q->fetch(PDO::FETCH_ASSOC)?:[];
}
function kareta_client_schedule_reschedule_list(PDO $pdo): void {
    if(!kareta_table_exists($pdo,'master_reschedule_proposals'))kareta_json(['ok'=>true,'proposals'=>[]]);$user=kareta_session_user();$uid=(int)($user['id']??0);$phone=kareta_normalize_phone((string)($user['phone']??''));$sql="SELECT p.*,o.service_names,o.client_car,o.vehicle_title,o.date AS order_date,o.time AS order_time,m.name master_name,(SELECT c.id FROM chats c WHERE BINARY c.order_id=BINARY o.id ORDER BY c.created_at DESC LIMIT 1) chat_id FROM master_reschedule_proposals p JOIN orders o ON BINARY o.id=BINARY p.order_id LEFT JOIN masters m ON BINARY m.id=BINARY p.master_id WHERE p.status='pending' AND o.status NOT IN ('completed','done','delivered','closed','cancelled') AND (o.client_user_id=? OR (?<>'' AND o.client_phone=?)) ORDER BY p.created_at DESC";$q=$pdo->prepare($sql);$q->execute([$uid?:-1,$phone,$phone]);$rows=[];foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r)$rows[]=['id'=>(string)$r['id'],'orderId'=>(string)$r['order_id'],'masterId'=>(string)$r['master_id'],'masterName'=>(string)($r['master_name']??'Мастер'),'serviceNames'=>(string)($r['service_names']??'Работы'),'vehicleTitle'=>(string)($r['vehicle_title']??$r['client_car']??'Автомобиль'),'currentStart'=>trim((string)($r['order_date']??'').' '.(string)($r['order_time']??'')),'proposedStart'=>(string)$r['proposed_start'],'proposedEnd'=>(string)$r['proposed_end'],'durationMin'=>(int)$r['duration_min'],'bufferMin'=>(int)$r['buffer_min'],'reason'=>(string)$r['reason'],'status'=>(string)$r['status'],'chatId'=>(string)($r['chat_id']??''),'createdAt'=>(string)$r['created_at']];kareta_json(['ok'=>true,'proposals'=>$rows]);
}
function kareta_client_schedule_reschedule_respond(PDO $pdo,array $body): void {
    $proposalId=trim((string)($body['proposalId']??''));$decision=strtolower(trim((string)($body['decision']??'')));if($proposalId===''||!in_array($decision,['accept','decline'],true))kareta_json(['ok'=>false,'error'=>'proposal_and_decision_required'],422);try{$pdo->beginTransaction();$q=$pdo->prepare("SELECT * FROM master_reschedule_proposals WHERE BINARY id=BINARY ? LIMIT 1 FOR UPDATE");$q->execute([$proposalId]);$proposal=$q->fetch(PDO::FETCH_ASSOC)?:[];if(!$proposal){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'proposal_not_found'],404);}$order=kareta_client_schedule_owned_order($pdo,(string)$proposal['order_id']);if(!$order){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'order_not_found'],404);}if((string)$proposal['status']!=='pending'){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'proposal_already_resolved','message'=>'Предложение уже обработано.'],409);}if($guard=kareta_master_schedule_reschedule_guard($pdo,$order)){$pdo->rollBack();kareta_json(['ok'=>false]+$guard,409);}$mid=(string)$proposal['master_id'];$masterLock=$pdo->prepare("SELECT id,user_id,name FROM masters WHERE BINARY id=BINARY ? LIMIT 1 FOR UPDATE");$masterLock->execute([$mid]);$master=$masterLock->fetch(PDO::FETCH_ASSOC)?:[];$currentMasterId=trim((string)($order['master_id']??''));$currentMasterUserId=(int)($order['master_user_id']??0);$proposalMasterUserId=(int)($master['user_id']??0);if(($currentMasterId!==''&&$currentMasterId!==$mid)||($currentMasterId===''&&$currentMasterUserId>0&&$proposalMasterUserId>0&&$currentMasterUserId!==$proposalMasterUserId)){$pdo->prepare("UPDATE master_reschedule_proposals SET status='cancelled',decision_note='master_reassigned',responded_at=NOW(),updated_at=NOW() WHERE id=?")->execute([$proposalId]);$pdo->commit();kareta_json(['ok'=>false,'error'=>'master_changed','message'=>'Заказ уже назначен другому Мастеру. Старое предложение переноса отменено.'],409);}$chatId=(string)($order['chat_id']??'');
        if($decision==='decline'){$pdo->prepare("UPDATE master_reschedule_proposals SET status='declined',decision_note=?,responded_at=NOW(),updated_at=NOW() WHERE id=?")->execute([mb_substr(trim((string)($body['note']??'')),0,500),$proposalId]);$human=(new DateTimeImmutable((string)$proposal['proposed_start']))->format('d.m.Y H:i');kareta_master_schedule_write_system_message($pdo,(string)$order['id'],$chatId,'Клиент отклонил перенос на '.$human.'.','reschedule-decline|'.$proposalId);try{kareta_notification_insert($pdo,['recipientUserId'=>(int)($master['user_id']??0)?:null,'recipientRole'=>'master','eventType'=>'order.reschedule.declined','entityType'=>'order','entityId'=>(string)$order['id'],'title'=>'Клиент отклонил перенос','body'=>$human,'actionUrl'=>'#/orders/item/'.rawurlencode((string)$order['id']),'meta'=>['proposalId'=>$proposalId,'orderId'=>(string)$order['id'],'chatId'=>$chatId]]);}catch(Throwable $_){}$pdo->commit();try{kareta_write_event($pdo,(string)$order['id'],'reschedule_declined',['proposalId'=>$proposalId,'masterId'=>$mid]);}catch(Throwable $_){}kareta_json(['ok'=>true,'status'=>'declined']);}
        $start=new DateTimeImmutable((string)$proposal['proposed_start']);$end=new DateTimeImmutable((string)$proposal['proposed_end']);if(function_exists('kareta_tariff_master_intake_guard'))kareta_tariff_master_intake_guard($pdo,$mid,$start->format('Y-m-d'),(string)$order['id'],true);$conflicts=kareta_master_schedule_conflicts($pdo,$mid,$start,$end,(string)$order['id'],true);if($conflicts){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'slot_no_longer_available','message'=>'Это окно уже занято. Мастер должен предложить другое время.','conflicts'=>$conflicts],409);}$pid='mop_'.substr(hash('sha256',(string)$order['id']),0,20);$pdo->prepare("INSERT INTO master_order_plans(id,order_id,master_id,vehicle_id,planned_start,planned_end,estimated_repair_min,buffer_min,status,source,conflict_override) VALUES(?,?,?,?,?,?,?,?,'planned','client_reschedule_accept',0) ON DUPLICATE KEY UPDATE master_id=VALUES(master_id),planned_start=VALUES(planned_start),planned_end=VALUES(planned_end),estimated_repair_min=VALUES(estimated_repair_min),buffer_min=VALUES(buffer_min),status=IF(status IN ('done','completed'),status,'planned'),source='client_reschedule_accept',conflict_override=0,updated_at=NOW()")->execute([$pid,(string)$order['id'],$mid,(string)($order['client_vehicle_id']??''),$start->format('Y-m-d H:i:s'),$end->format('Y-m-d H:i:s'),(int)$proposal['duration_min'],(int)$proposal['buffer_min']]);$pdo->prepare("UPDATE orders SET date=?,time=?,estimated_duration_min=? WHERE id=?")->execute([$start->format('Y-m-d'),$start->format('H:i'),(int)$proposal['duration_min'],(string)$order['id']]);$pdo->prepare("UPDATE master_reschedule_proposals SET status='accepted',decision_note=?,responded_at=NOW(),updated_at=NOW() WHERE id=?")->execute([mb_substr(trim((string)($body['note']??'')),0,500),$proposalId]);$pdo->prepare("UPDATE master_reschedule_proposals SET status='cancelled',responded_at=NOW(),decision_note='superseded_by_accept' WHERE BINARY order_id=BINARY ? AND status='pending' AND BINARY id<>BINARY ?")->execute([(string)$order['id'],$proposalId]);if(function_exists('kareta_dispatch_plan_order')&&trim((string)($order['sto_id']??''))!=='')kareta_dispatch_plan_order($pdo,(string)$order['sto_id'],(string)$order['id'],$mid);$human=$start->format('d.m.Y H:i');kareta_master_schedule_write_system_message($pdo,(string)$order['id'],$chatId,'Клиент подтвердил перенос. Новое время: '.$human.'.','reschedule-accept|'.$proposalId);try{kareta_notification_insert($pdo,['recipientUserId'=>(int)($master['user_id']??0)?:null,'recipientRole'=>'master','eventType'=>'order.reschedule.accepted','entityType'=>'order','entityId'=>(string)$order['id'],'title'=>'Клиент подтвердил перенос','body'=>$human,'actionUrl'=>'#/orders/item/'.rawurlencode((string)$order['id']),'meta'=>['proposalId'=>$proposalId,'orderId'=>(string)$order['id'],'chatId'=>$chatId,'plannedStart'=>$start->format('Y-m-d H:i:s')]]);}catch(Throwable $_){}$pdo->commit();try{kareta_write_event($pdo,(string)$order['id'],'reschedule_accepted',['proposalId'=>$proposalId,'masterId'=>$mid,'plannedStart'=>$start->format('Y-m-d H:i:s'),'plannedEnd'=>$end->format('Y-m-d H:i:s')]);}catch(Throwable $_){}kareta_json(['ok'=>true,'status'=>'accepted','plan'=>['orderId'=>(string)$order['id'],'plannedStart'=>$start->format('Y-m-d H:i:s'),'plannedEnd'=>$end->format('Y-m-d H:i:s'),'durationMin'=>(int)$proposal['duration_min'],'bufferMin'=>(int)$proposal['buffer_min']]]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'reschedule_response_failed','message'=>$e->getMessage()],500);}
}

function kareta_master_schedule_conflicts(PDO $pdo,string $masterId,DateTimeImmutable $start,DateTimeImmutable $end,string $excludeOrderId='',bool $lockMaster=false): array {
    if($lockMaster){$lock=$pdo->prepare("SELECT id FROM masters WHERE BINARY id=BINARY ? LIMIT 1 FOR UPDATE");$lock->execute([$masterId]);}
    $conflicts=[];
    if(kareta_table_exists($pdo,'master_order_plans')){
        $sql="SELECT p.order_id,p.planned_start,p.planned_end,p.status,o.service_names,o.client_car,o.vehicle_title FROM master_order_plans p LEFT JOIN orders o ON BINARY o.id=BINARY p.order_id WHERE BINARY p.master_id=BINARY ? AND p.planned_start IS NOT NULL AND p.planned_end IS NOT NULL AND p.planned_start < ? AND p.planned_end > ? AND p.status NOT IN ('done','completed','cancelled','closed','no_show')";
        $args=[$masterId,$end->format('Y-m-d H:i:s'),$start->format('Y-m-d H:i:s')];if($excludeOrderId!==''){$sql.=" AND BINARY p.order_id<>BINARY ?";$args[]=$excludeOrderId;}$sql.=" ORDER BY p.planned_start";if($lockMaster)$sql.=" FOR UPDATE";$q=$pdo->prepare($sql);$q->execute($args);
        foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $row)$conflicts[]=['type'=>'order','orderId'=>(string)($row['order_id']??''),'title'=>(string)($row['service_names']??'Другой заказ'),'vehicle'=>(string)($row['vehicle_title']??$row['client_car']??''),'start'=>(string)($row['planned_start']??''),'end'=>(string)($row['planned_end']??'')];
    }
    $date=$start->format('Y-m-d');$bounds=kareta_master_schedule_day_bounds($pdo,$masterId,$date);
    if(!empty($bounds['isDayOff']))$conflicts[]=['type'=>'day_off','orderId'=>'','title'=>'На этот день установлен выходной','vehicle'=>'','start'=>$start->format('Y-m-d H:i:s'),'end'=>$end->format('Y-m-d H:i:s')];
    elseif($start<$bounds['start']||$end>$bounds['end'])$conflicts[]=['type'=>'outside_hours','orderId'=>'','title'=>'Время выходит за рабочее окно '.$bounds['start']->format('H:i').'–'.$bounds['end']->format('H:i'),'vehicle'=>'','start'=>$start->format('Y-m-d H:i:s'),'end'=>$end->format('Y-m-d H:i:s')];
    if(function_exists('kareta_master_schedule_blocked_intervals'))foreach(kareta_master_schedule_blocked_intervals($pdo,$masterId,$date) as $block)if($start<$block['end']&&$end>$block['start'])$conflicts[]=['type'=>'blocked','orderId'=>'','blockId'=>(string)($block['blockId']??''),'title'=>(string)($block['title']??'Перерыв'),'vehicle'=>'','start'=>$block['start']->format('Y-m-d H:i:s'),'end'=>$block['end']->format('Y-m-d H:i:s')];
    return $conflicts;
}
function kareta_master_schedule_exchange_preview(PDO $pdo,array $order,array $response,bool $lockMaster=false): array {
    $masterId=trim((string)($response['master_id']??$response['masterId']??$order['master_id']??''));$orderId=trim((string)($order['id']??$response['request_id']??''));
    $prefs=$masterId!==''?kareta_master_schedule_preferences($pdo,$masterId):['defaultRepairMin'=>120,'responseSlaMin'=>15,'intakeBufferMin'=>60];
    $durationInfo=$masterId!==''?kareta_master_schedule_order_duration($pdo,$masterId,$order):['serviceMinutes'=>(int)($prefs['defaultRepairMin']??120),'bufferMin'=>(int)($prefs['intakeBufferMin']??60),'source'=>'order_default'];
    $start=kareta_master_schedule_parse_proposal_datetime((string)($response['start_time']??$response['startTime']??''),(string)($order['date']??''));
    $duration=kareta_master_schedule_parse_duration_minutes((string)($response['duration_text']??$response['duration']??''),(int)($durationInfo['serviceMinutes']??$prefs['defaultRepairMin']??120));$buffer=max(0,(int)($durationInfo['bufferMin']??0));
    if(!$start||$masterId==='')return ['schedulable'=>false,'hasConflict'=>false,'plannedStart'=>'','plannedEnd'=>'','durationMin'=>$duration,'bufferMin'=>$buffer,'reservedMinutes'=>$duration+$buffer,'durationSource'=>$durationInfo['source']??'order_default','conflicts'=>[]];
    $end=$start->modify('+'.($duration+$buffer).' minutes');$conflicts=kareta_master_schedule_conflicts($pdo,$masterId,$start,$end,$orderId,$lockMaster);
    return ['schedulable'=>true,'hasConflict'=>count($conflicts)>0,'plannedStart'=>$start->format('Y-m-d H:i:s'),'plannedEnd'=>$end->format('Y-m-d H:i:s'),'durationMin'=>$duration,'bufferMin'=>$buffer,'reservedMinutes'=>$duration+$buffer,'durationSource'=>$durationInfo['source']??'order_default','conflicts'=>$conflicts];
}
function kareta_master_schedule_write_system_message(PDO $pdo,string $orderId,string $chatId,string $text,string $dedupeKey): bool {
    if($chatId===''||!kareta_table_exists($pdo,'messages'))return false;
    $id='m_sched_'.substr(hash('sha256',$orderId.'|'.$dedupeKey),0,20);$q=$pdo->prepare("INSERT IGNORE INTO messages(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,NOW())");$q->execute([$id,$chatId,$orderId,'system',null,'event',mb_substr($text,0,2000),date('H:i')]);
    if($q->rowCount()>0){try{$pdo->prepare("UPDATE chats SET unread_client=unread_client+1 WHERE id=?")->execute([$chatId]);}catch(Throwable $_){}return true;}return false;
}
function kareta_master_schedule_apply_exchange_plan(PDO $pdo,array $order,array $response,bool $force=false,string $source='exchange_accept'): array {
    if(!kareta_table_exists($pdo,'master_order_plans'))return ['ok'=>true,'scheduled'=>false,'reason'=>'schedule_table_unavailable'];
    $preview=kareta_master_schedule_exchange_preview($pdo,$order,$response,true);if(empty($preview['schedulable']))return ['ok'=>true,'scheduled'=>false,'preview'=>$preview];
    if(!empty($preview['hasConflict'])&&!$force)return ['ok'=>false,'error'=>'schedule_conflict','message'=>'Предложенное время пересекается с рабочим расписанием Мастера.','preview'=>$preview];
    $orderId=(string)$order['id'];$masterId=(string)($response['master_id']??$response['masterId']??'');$start=(string)$preview['plannedStart'];$end=(string)$preview['plannedEnd'];$duration=(int)$preview['durationMin'];$buffer=(int)($preview['bufferMin']??0);
    if(function_exists('kareta_tariff_master_intake_guard')){$tariff=kareta_tariff_master_intake_guard($pdo,$masterId,substr($start,0,10),$orderId,false);if(empty($tariff['canSchedule']))return ['ok'=>false,'error'=>'tariff_intake_limit_reached','message'=>'На выбранный день достигнут лимит активных приёмов тарифа.','tariff'=>$tariff,'preview'=>$preview];}
    $id='mop_'.substr(hash('sha256',$orderId),0,20);
    $sql="INSERT INTO master_order_plans(id,order_id,master_id,vehicle_id,planned_start,planned_end,estimated_repair_min,buffer_min,status,source,conflict_override) VALUES(?,?,?,?,?,?,?,?,'planned',?,?) ON DUPLICATE KEY UPDATE master_id=VALUES(master_id),planned_start=VALUES(planned_start),planned_end=VALUES(planned_end),estimated_repair_min=VALUES(estimated_repair_min),buffer_min=VALUES(buffer_min),status=IF(status IN ('done','completed'),status,'planned'),source=VALUES(source),conflict_override=VALUES(conflict_override),updated_at=CURRENT_TIMESTAMP";
    $pdo->prepare($sql)->execute([$id,$orderId,$masterId,(string)($order['client_vehicle_id']??''),$start,$end,$duration,$buffer,$source,!empty($preview['hasConflict'])?1:0]);
    $startDt=new DateTimeImmutable($start);$pdo->prepare("UPDATE orders SET date=?,time=? WHERE id=?")->execute([$startDt->format('Y-m-d'),$startDt->format('H:i'),$orderId]);
    return ['ok'=>true,'scheduled'=>true,'plan'=>['orderId'=>$orderId,'masterId'=>$masterId,'plannedStart'=>$start,'plannedEnd'=>$end,'durationMin'=>$duration,'bufferMin'=>$buffer,'reservedMinutes'=>$duration+$buffer,'source'=>$source,'conflictOverride'=>!empty($preview['hasConflict'])],'preview'=>$preview];
}
function kareta_master_schedule_order_plan_save(PDO $pdo,array $body): void {
    $master=kareta_master_workplace_profile($pdo);$masterId=(string)$master['id'];$orderId=trim((string)($body['orderId']??''));if($orderId==='')kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    $orderQ=$pdo->prepare("SELECT o.*,(SELECT c.id FROM chats c WHERE BINARY c.order_id=BINARY o.id ORDER BY c.created_at DESC LIMIT 1) chat_id FROM orders o WHERE BINARY o.id=BINARY ? AND (BINARY o.master_id=BINARY ? OR (COALESCE(o.master_id,'')='' AND o.master_user_id=?)) LIMIT 1");$orderQ->execute([$orderId,$masterId,(int)($master['user_id']??0)?:-1]);$order=$orderQ->fetch(PDO::FETCH_ASSOC);if(!$order)kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    $start=trim((string)($body['plannedStart']??''));$duration=max(15,min(1440,(int)($body['durationMin']??120)));if($start==='')kareta_json(['ok'=>false,'error'=>'planned_start_required'],422);
    $response=['master_id'=>$masterId,'start_time'=>$start,'duration_text'=>$duration.' мин'];$force=!empty($body['forceConflict']);
    try{$pdo->beginTransaction();$result=kareta_master_schedule_apply_exchange_plan($pdo,$order,$response,$force,'master_adjustment');if(empty($result['ok'])){$pdo->rollBack();kareta_json(array_merge(['ok'=>false],$result),409);}
        $plan=$result['plan']??[];$chatId=(string)($order['chat_id']??'');if(!empty($result['scheduled'])){$human=(new DateTimeImmutable((string)$plan['plannedStart']))->format('d.m.Y H:i');$text='Мастер уточнил время записи: '.$human.', плановая длительность '.$duration.' мин.';kareta_master_schedule_write_system_message($pdo,$orderId,$chatId,$text,(string)$plan['plannedStart'].'|'.$duration);try{kareta_notification_insert($pdo,['recipientUserId'=>(int)($order['client_user_id']??0)?:null,'recipientPhone'=>(string)($order['client_phone']??''),'recipientRole'=>'client','eventType'=>'order.schedule.updated','entityType'=>'order','entityId'=>$orderId,'title'=>'Мастер уточнил время записи','body'=>$human.' · '.$duration.' мин.','actionUrl'=>'#/orders/item/'.rawurlencode($orderId),'meta'=>['orderId'=>$orderId,'chatId'=>$chatId,'plannedStart'=>$plan['plannedStart'],'plannedEnd'=>$plan['plannedEnd']]]);}catch(Throwable $_){}}
        $pdo->commit();try{kareta_write_event($pdo,$orderId,'schedule_updated',['masterId'=>$masterId,'plannedStart'=>$plan['plannedStart']??'','plannedEnd'=>$plan['plannedEnd']??'','durationMin'=>$duration,'conflictOverride'=>!empty($plan['conflictOverride'])]);}catch(Throwable $_){}$recovery=function_exists('kareta_master_schedule_auto_recover')?kareta_master_schedule_auto_recover($pdo,$masterId,'extra_booking',substr((string)($plan['plannedStart']??''),0,10),$orderId,false):[];kareta_json(['ok'=>true,'result'=>$result,'recovery'=>$recovery]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'schedule_plan_save_failed','message'=>$e->getMessage()],500);}
}
function kareta_master_schedule_get(PDO $pdo): void {
    $master=kareta_master_workplace_profile($pdo);$mid=(string)$master['id'];$prefs=kareta_master_schedule_preferences($pdo,$mid);$orders=kareta_master_workplace_orders($pdo,$master);
    $timerTotals=[];$runningByOrder=[];$actualAll=0;$completedCount=0;$serviceAverages=[];
    if(kareta_table_exists($pdo,'work_order_timers')){
        $s=$pdo->prepare("SELECT order_id,SUM(CASE WHEN status='running' THEN TIMESTAMPDIFF(SECOND,started_at,NOW()) ELSE duration_sec END) total_sec,MAX(CASE WHEN status='running' THEN id ELSE NULL END) running_id,MAX(CASE WHEN status='running' THEN stage_key ELSE NULL END) running_stage,MAX(CASE WHEN status='running' THEN started_at ELSE NULL END) running_started FROM work_order_timers WHERE master_id=? GROUP BY order_id");$s->execute([$mid]);
        foreach($s->fetchAll(PDO::FETCH_ASSOC)?:[] as $r){$oid=(string)$r['order_id'];$m=max(0,(int)round(((int)$r['total_sec'])/60));$timerTotals[$oid]=$m;$actualAll+=$m;if($m>0)$completedCount++;if(!empty($r['running_id']))$runningByOrder[$oid]=['id'=>(string)$r['running_id'],'status'=>'running','stageKey'=>(string)$r['running_stage'],'startedAt'=>(string)$r['running_started']];}
        $s=$pdo->prepare("SELECT o.service_names,ROUND(AVG(t.total_sec)/60) avg_min FROM orders o JOIN (SELECT order_id,SUM(duration_sec) total_sec FROM work_order_timers WHERE master_id=? AND status='stopped' GROUP BY order_id) t ON CONVERT(t.order_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(o.id USING utf8mb4) COLLATE utf8mb4_unicode_ci WHERE o.service_names<>'' GROUP BY o.service_names");$s->execute([$mid]);foreach($s->fetchAll(PDO::FETCH_ASSOC)?:[] as $r)$serviceAverages[mb_strtolower(trim((string)$r['service_names']))]=max(30,(int)$r['avg_min']);
    }
    $plans=[];if(kareta_table_exists($pdo,'master_order_plans')){$s=$pdo->prepare("SELECT * FROM master_order_plans WHERE master_id=?");$s->execute([$mid]);foreach($s->fetchAll(PDO::FETCH_ASSOC)?:[] as $r)$plans[(string)$r['order_id']]=$r;}
    $arrival=[];if(kareta_table_exists($pdo,'order_arrival_states')){$s=$pdo->prepare("SELECT order_id,status,eta_minutes,eta_at,arrived_at,no_show_at,source,note,updated_at FROM order_arrival_states WHERE BINARY master_id=BINARY ?");$s->execute([$mid]);foreach($s->fetchAll(PDO::FETCH_ASSOC)?:[] as $r)$arrival[(string)$r['order_id']]=['status'=>(string)$r['status'],'etaMinutes'=>(int)$r['eta_minutes'],'etaAt'=>(string)($r['eta_at']??''),'arrivedAt'=>(string)($r['arrived_at']??''),'noShowAt'=>(string)($r['no_show_at']??''),'source'=>(string)$r['source'],'note'=>(string)$r['note'],'updatedAt'=>(string)$r['updated_at']];}
    $dayMap=[];$today=new DateTimeImmutable('today');
    for($i=0;$i<14;$i++){$d=$today->modify("+$i day")->format('Y-m-d');$bounds=kareta_master_schedule_day_bounds($pdo,$mid,$d);$blocks=function_exists('kareta_master_schedule_blocks_for_date')?kareta_master_schedule_blocks_for_date($pdo,$mid,$d,true):[];$dayMap[$d]=['date'=>$d,'isToday'=>$i===0,'startTime'=>$bounds['start']->format('H:i'),'endTime'=>$bounds['end']->format('H:i'),'isDayOff'=>!empty($bounds['isDayOff']),'note'=>(string)($bounds['note']??''),'scheduleSource'=>(string)($bounds['source']??'default'),'extension'=>$bounds['extension']??[],'blocks'=>$blocks,'items'=>[]];}
    $plannedCount=0;$averageSum=0;$averageN=0;
    foreach($orders as $o){$oid=(string)$o['id'];$plan=$plans[$oid]??[];$date=substr((string)($plan['planned_start']??$o['date']??''),0,10);if(!isset($dayMap[$date]))continue;$serviceKey=mb_strtolower(trim((string)($o['serviceNames']??'')));$avg=(int)($serviceAverages[$serviceKey]??($completedCount?round($actualAll/$completedCount):$prefs['defaultRepairMin']));$estimate=max(30,(int)($plan['estimated_repair_min']??$avg));$buffer=max(0,(int)($plan['buffer_min']??$prefs['intakeBufferMin']));$start=substr((string)($plan['planned_start']??($o['time']??'09:00')),11,5);if($start===''||$start===false)$start=substr((string)($o['time']??'09:00'),0,5)?:'09:00';$end=substr((string)($plan['planned_end']??''),11,5);if($end===''||$end===false)$end=kareta_master_schedule_add_minutes($start,$estimate+$buffer);$planStatus=strtolower((string)($plan['status']??'planned'));
        $dayMap[$date]['items'][]=['id'=>$oid,'status'=>(string)($o['status']??''),'statusLabel'=>kareta_master_schedule_status_label((string)($o['status']??'')),'planStatus'=>$planStatus,'noShow'=>$planStatus==='no_show','vehicleId'=>(string)($o['clientVehicleId']??''),'vehicleTitle'=>(string)($o['vehicleTitle']??$o['clientCar']??'Автомобиль'),'clientCar'=>(string)($o['clientCar']??''),'clientName'=>(string)($o['clientName']??''),'serviceNames'=>(string)($o['serviceNames']??''),'chatId'=>(string)($o['chatId']??''),'plannedStart'=>$start,'plannedEnd'=>$end,'estimatedRepairMin'=>$estimate,'averageRepairMin'=>$avg,'bufferMin'=>$buffer,'actualMinutes'=>(int)($timerTotals[$oid]??0),'timer'=>$runningByOrder[$oid]??null,'arrival'=>$arrival[$oid]??null,'autoRecoveryProtected'=>!empty($plan['auto_recovery_protected']),'conflict'=>false,'delayImpact'=>null];$plannedCount++;$averageSum+=$avg;$averageN++;
    }
    $weekForecast=[];
    foreach($dayMap as &$day){usort($day['items'],fn($a,$b)=>strcmp($a['plannedStart'],$b['plannedStart']));$lastEnd='';foreach($day['items'] as &$item){if(!$item['noShow']&&$lastEnd!==''&&strcmp($item['plannedStart'],$lastEnd)<0)$item['conflict']=true;if(!$item['noShow']&&strcmp($item['plannedEnd'],$lastEnd)>0)$lastEnd=$item['plannedEnd'];$plannedTs=strtotime($day['date'].' '.$item['plannedStart']);$item['latenessMin']=($plannedTs&&$plannedTs<time()&&!in_array(strtolower((string)$item['status']),['completed','done','delivered','closed','cancelled'],true)&&empty($item['timer'])&&!$item['noShow'])?max(0,(int)floor((time()-$plannedTs)/60)):0;}unset($item);
        $capacity=kareta_master_schedule_capacity_for_day($pdo,$mid,$day['date']);$day['capacity']=$capacity;$day['capacityWarning']=$capacity['loadPct']>(float)($prefs['capacityWarnPct']??90);$day['freeIntervals']=[];$bounds=kareta_master_schedule_day_bounds($pdo,$mid,$day['date']);$cursor=$bounds['start'];$busy=kareta_master_schedule_day_intervals($pdo,$mid,$day['date']);foreach($busy as $interval){$bs=$interval['start']<$bounds['start']?$bounds['start']:$interval['start'];$be=$interval['end']>$bounds['end']?$bounds['end']:$interval['end'];if($bs>$cursor&&($bs->getTimestamp()-$cursor->getTimestamp())>=900)$day['freeIntervals'][]=['start'=>$cursor->format('H:i'),'end'=>$bs->format('H:i'),'minutes'=>(int)(($bs->getTimestamp()-$cursor->getTimestamp())/60)];if($be>$cursor)$cursor=$be;}if(!$day['isDayOff']&&$bounds['end']>$cursor&&($bounds['end']->getTimestamp()-$cursor->getTimestamp())>=900)$day['freeIntervals'][]=['start'=>$cursor->format('H:i'),'end'=>$bounds['end']->format('H:i'),'minutes'=>(int)(($bounds['end']->getTimestamp()-$cursor->getTimestamp())/60)];
        foreach($day['items'] as $idx=>&$current){if(empty($current['timer'])||$current['noShow'])continue;$now=new DateTimeImmutable('now');$plannedEnd=new DateTimeImmutable($day['date'].' '.$current['plannedEnd']);$remaining=max(15,(int)$current['estimatedRepairMin']-(int)$current['actualMinutes']);$projected=$now->modify('+'.$remaining.' minutes');if($projected<=$plannedEnd)continue;$impacted=[];for($j=$idx+1;$j<count($day['items']);$j++){$next=$day['items'][$j];if($next['noShow'])continue;$nextStart=new DateTimeImmutable($day['date'].' '.$next['plannedStart']);if($nextStart<$projected)$impacted[]=['orderId'=>$next['id'],'vehicleTitle'=>$next['vehicleTitle'],'plannedStart'=>$nextStart->format('Y-m-d H:i:s'),'minutesLate'=>max(1,(int)(($projected->getTimestamp()-$nextStart->getTimestamp())/60))];}$current['delayImpact']=['projectedEnd'=>$projected->format('Y-m-d H:i:s'),'delayMin'=>max(1,(int)(($projected->getTimestamp()-$plannedEnd->getTimestamp())/60)),'impacted'=>$impacted];}unset($current);
        if(count($weekForecast)<7)$weekForecast[]=['date'=>$day['date'],'workMinutes'=>(int)$capacity['workMinutes'],'bookedMinutes'=>(int)$capacity['bookedMinutes'],'blockedMinutes'=>(int)$capacity['blockedMinutes'],'freeMinutes'=>(int)$capacity['freeMinutes'],'loadPct'=>(float)$capacity['loadPct'],'warning'=>!empty($day['capacityWarning'])];
    }unset($day);
    $weekly=function_exists('kareta_master_weekly_shift_rows')?kareta_master_weekly_shift_rows($pdo,$mid):[];$weekWork=array_sum(array_column($weekForecast,'workMinutes'));$weekBooked=array_sum(array_column($weekForecast,'bookedMinutes'));$weekBlocked=array_sum(array_column($weekForecast,'blockedMinutes'));$weekFree=array_sum(array_column($weekForecast,'freeMinutes'));
    $recentRecovery=function_exists('kareta_master_day_ops_recent_recovery')?kareta_master_day_ops_recent_recovery($pdo,$mid,8):[];$recoveryControl=function_exists('kareta_master_recovery_preview_data')?kareta_master_recovery_preview_data($pdo,$mid,'control_center',''):['items'=>[],'summary'=>[]];$recoveryNotifications=function_exists('kareta_master_recovery_notification_history')?kareta_master_recovery_notification_history($pdo,$mid,20):[];$needsRecovery=false;foreach($dayMap as $drow)foreach($drow['items'] as $it)if(!empty($it['conflict'])||!empty($it['delayImpact']['impacted'])){$needsRecovery=true;break 2;}
    kareta_json(['ok'=>true,'data'=>['master'=>['id'=>$mid,'name'=>(string)($master['name']??$master['full_name']??'Мастер')],'preferences'=>$prefs,'weeklyTemplate'=>$weekly,'days'=>array_values($dayMap),'autoRecovery'=>['enabled'=>!empty($prefs['autoRecoveryEnabled']),'notifyEnabled'=>!empty($prefs['autoNotifyEnabled']),'mode'=>(string)($prefs['autoRecoveryMode']??'auto'),'horizonDays'=>(int)($prefs['autoRecoveryHorizonDays']??14),'graceMin'=>(int)($prefs['autoRecoveryGraceMin']??15),'needsAttention'=>$needsRecovery,'recent'=>$recentRecovery,'controlCenter'=>$recoveryControl,'notifications'=>$recoveryNotifications],'analytics'=>['ordersPlanned'=>$plannedCount,'averageRepairMinutes'=>$averageN?(int)round($averageSum/$averageN):$prefs['defaultRepairMin'],'actualWorkedMinutes'=>$actualAll,'weekForecast'=>['days'=>$weekForecast,'workMinutes'=>$weekWork,'bookedMinutes'=>$weekBooked,'blockedMinutes'=>$weekBlocked,'freeMinutes'=>$weekFree,'loadPct'=>$weekWork>0?round($weekBooked*100/$weekWork,1):0]],'generatedAt'=>date(DATE_ATOM)]]);
}
function kareta_master_schedule_preferences_save(PDO $pdo,array $b): void {
    $master=kareta_master_workplace_profile($pdo);$mid=(string)$master['id'];$buffer=max(0,min(240,(int)($b['intakeBufferMin']??60)));$default=max(30,min(1440,(int)($b['defaultRepairMin']??120)));$responseSla=max(5,min(240,(int)($b['responseSlaMin']??15)));$slotStep=max(15,min(120,(int)($b['slotStepMin']??30)));$capacityWarn=max(50,min(120,(int)($b['capacityWarnPct']??90)));$autoRecovery=!array_key_exists('autoRecoveryEnabled',$b)||!empty($b['autoRecoveryEnabled']);$autoNotify=!array_key_exists('autoNotifyEnabled',$b)||!empty($b['autoNotifyEnabled']);$mode=strtolower(trim((string)($b['autoRecoveryMode']??'auto')));if(!in_array($mode,['off','notify','propose','auto'],true))$mode='auto';$horizon=max(1,min(30,(int)($b['autoRecoveryHorizonDays']??14)));$grace=max(0,min(120,(int)($b['autoRecoveryGraceMin']??15)));
    if(kareta_column_exists($pdo,'master_schedule_preferences','auto_recovery_enabled'))$pdo->prepare("INSERT INTO master_schedule_preferences(master_id,intake_buffer_min,default_repair_min,response_sla_min,slot_step_min,capacity_warn_pct,auto_recovery_enabled,auto_notify_enabled,auto_recovery_mode,auto_recovery_horizon_days,auto_recovery_grace_min) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE intake_buffer_min=VALUES(intake_buffer_min),default_repair_min=VALUES(default_repair_min),response_sla_min=VALUES(response_sla_min),slot_step_min=VALUES(slot_step_min),capacity_warn_pct=VALUES(capacity_warn_pct),auto_recovery_enabled=VALUES(auto_recovery_enabled),auto_notify_enabled=VALUES(auto_notify_enabled),auto_recovery_mode=VALUES(auto_recovery_mode),auto_recovery_horizon_days=VALUES(auto_recovery_horizon_days),auto_recovery_grace_min=VALUES(auto_recovery_grace_min),updated_at=CURRENT_TIMESTAMP")->execute([$mid,$buffer,$default,$responseSla,$slotStep,$capacityWarn,$autoRecovery?1:0,$autoNotify?1:0,$mode,$horizon,$grace]);
    else $pdo->prepare("INSERT INTO master_schedule_preferences(master_id,intake_buffer_min,default_repair_min,response_sla_min,slot_step_min,capacity_warn_pct) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE intake_buffer_min=VALUES(intake_buffer_min),default_repair_min=VALUES(default_repair_min),response_sla_min=VALUES(response_sla_min),slot_step_min=VALUES(slot_step_min),capacity_warn_pct=VALUES(capacity_warn_pct),updated_at=CURRENT_TIMESTAMP")->execute([$mid,$buffer,$default,$responseSla,$slotStep,$capacityWarn]);
    kareta_json(['ok'=>true,'preferences'=>kareta_master_schedule_preferences($pdo,$mid)]);
}
