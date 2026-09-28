<?php
declare(strict_types=1);

function kareta_master_order_lifecycle_ensure(PDO $pdo): void {
    $tables=['master_order_diagnostics','work_order_part_reservations','work_order_quality_checks','work_order_handovers','work_order_warranties','work_order_publication_policies'];
    $ready=true;foreach($tables as $table){if(!kareta_table_exists($pdo,$table)){$ready=false;break;}}
    if($ready){if(function_exists('kareta_ensure_extra_quotes_table'))kareta_ensure_extra_quotes_table($pdo);return;}
    $migration = require __DIR__ . '/migrations/104_master_order_full_lifecycle.php';
    if (is_array($migration) && isset($migration['run']) && is_callable($migration['run'])) {
        ($migration['run'])($pdo);
    }
    if (function_exists('kareta_ensure_extra_quotes_table')) kareta_ensure_extra_quotes_table($pdo);
}

function kareta_master_order_lifecycle_actor(PDO $pdo): array {
    $user = kareta_session_user() ?: [];
    $role = function_exists('kareta_work_order_effective_role') ? kareta_work_order_effective_role($pdo) : strtolower((string)($user['role'] ?? 'client'));
    $auth = function_exists('kareta_auth_resolve') ? kareta_auth_resolve($pdo, false) : [];
    $masterId = '';
    if ($role === 'master' && function_exists('kareta_master_workplace_profile')) {
        $profile = kareta_master_workplace_profile($pdo);
        $masterId = trim((string)($profile['id'] ?? ''));
    }
    return [
        'role'=>$role,
        'userId'=>(int)($user['id'] ?? 0),
        'accountId'=>(int)($auth['account']['id'] ?? 0),
        'contextId'=>(int)($auth['context']['id'] ?? 0),
        'masterId'=>$masterId,
    ];
}

function kareta_master_order_lifecycle_require_role(PDO $pdo, array $roles): array {
    $actor = kareta_master_order_lifecycle_actor($pdo);
    if (!in_array((string)$actor['role'], $roles, true)) {
        kareta_json(['ok'=>false,'error'=>'forbidden','message'=>'Действие недоступно в текущем типе аккаунта'],403);
    }
    return $actor;
}

function kareta_master_order_lifecycle_order(PDO $pdo, string $orderId, bool $professionalWrite=false): array {
    if ($orderId === '') kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    return kareta_work_order_require($pdo, $orderId, $professionalWrite);
}

function kareta_master_order_lifecycle_require_stage(PDO $pdo,string $orderId,array $allowed): array {
    $workflow=kareta_sto_workflow_ensure($pdo,$orderId);
    $stage=(string)($workflow['current_stage']??'intake');
    if(!in_array($stage,$allowed,true))kareta_json(['ok'=>false,'error'=>'lifecycle_stage_conflict','message'=>'Действие недоступно на этапе «'.($stage?:'intake').'»','currentStage'=>$stage,'allowedStages'=>$allowed],409);
    return $workflow;
}

function kareta_master_order_lifecycle_decode($value): array {
    if (is_array($value)) return $value;
    $decoded = json_decode((string)$value, true);
    return is_array($decoded) ? $decoded : [];
}

function kareta_master_order_lifecycle_latest_quality(PDO $pdo, string $orderId): ?array {
    $q=$pdo->prepare("SELECT id,attempt_no AS attemptNo,result,road_test AS roadTest,no_leaks AS noLeaks,no_fault_codes AS noFaultCodes,fasteners_checked AS fastenersChecked,client_request_verified AS clientRequestVerified,notes,checked_at AS checkedAt FROM work_order_quality_checks WHERE order_id=? ORDER BY attempt_no DESC,created_at DESC LIMIT 1");
    $q->execute([$orderId]);
    $row=$q->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function kareta_master_order_lifecycle_snapshot(PDO $pdo, string $orderId, ?array $order=null): array {
    kareta_master_order_lifecycle_ensure($pdo);
    if (function_exists('kareta_master_aftercare_ensure')) kareta_master_aftercare_ensure($pdo);
    $order = $order ?: kareta_master_order_lifecycle_order($pdo,$orderId,false);
    $actor = kareta_master_order_lifecycle_actor($pdo);

    $q=$pdo->prepare("SELECT id,complaints,findings,recommendations,measurements_json AS measurements,parts_required AS partsRequired,status,completed_at AS completedAt,updated_at AS updatedAt FROM master_order_diagnostics WHERE order_id=? LIMIT 1");
    $q->execute([$orderId]);$diagnostics=$q->fetch(PDO::FETCH_ASSOC)?:null;
    if($diagnostics)$diagnostics['measurements']=kareta_master_order_lifecycle_decode($diagnostics['measurements']??'');

    $q=$pdo->prepare("SELECT id,title,labor_price AS laborPrice,parts_price AS partsPrice,total_price AS totalPrice,items_json AS items,comment,status,created_at AS createdAt,decided_at AS decidedAt FROM order_extra_quotes WHERE order_id=? ORDER BY created_at DESC");
    $q->execute([$orderId]);$extraQuotes=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
    foreach($extraQuotes as &$quote)$quote['items']=kareta_master_order_lifecycle_decode($quote['items']??'');unset($quote);

    $q=$pdo->prepare("SELECT id,claim_id AS claimId,part_key AS partKey,part_name AS partName,sku,oem,supplier_label AS supplierLabel,warehouse_id AS warehouseId,product_id AS productId,qty_requested AS qtyRequested,qty_reserved AS qtyReserved,qty_issued AS qtyIssued,qty_returned AS qtyReturned,unit_price AS unitPrice,cost_unit_price AS costUnitPrice,status,stock_status AS stockStatus,note,reserved_at AS reservedAt,expires_at AS expiresAt FROM work_order_part_reservations WHERE order_id=? ORDER BY created_at,id");
    $q->execute([$orderId]);$reservations=$q->fetchAll(PDO::FETCH_ASSOC)?:[];

    $q=$pdo->prepare("SELECT id,attempt_no AS attemptNo,result,road_test AS roadTest,no_leaks AS noLeaks,no_fault_codes AS noFaultCodes,fasteners_checked AS fastenersChecked,client_request_verified AS clientRequestVerified,notes,checked_at AS checkedAt FROM work_order_quality_checks WHERE order_id=? ORDER BY attempt_no DESC,created_at DESC");
    $q->execute([$orderId]);$qualityChecks=$q->fetchAll(PDO::FETCH_ASSOC)?:[];

    $q=$pdo->prepare("SELECT id,status,payment_status AS paymentStatus,odometer_km AS odometerKm,fuel_level AS fuelLevel,keys_count AS keysCount,documents_json AS documents,notes,prepared_at AS preparedAt,accepted_at AS acceptedAt FROM work_order_handovers WHERE order_id=? LIMIT 1");
    $q->execute([$orderId]);$handover=$q->fetch(PDO::FETCH_ASSOC)?:null;
    if($handover)$handover['documents']=kareta_master_order_lifecycle_decode($handover['documents']??'');

    $q=$pdo->prepare("SELECT id,warranty_days AS warrantyDays,scope_text AS scopeText,exclusions_text AS exclusionsText,status,starts_at AS startsAt,ends_at AS endsAt FROM work_order_warranties WHERE order_id=? LIMIT 1");
    $q->execute([$orderId]);$warranty=$q->fetch(PDO::FETCH_ASSOC)?:null;

    $q=$pdo->prepare("SELECT id,client_consent AS clientConsent,auto_publish AS autoPublish,anonymize_client AS anonymizeClient,COALESCE(show_price,0) AS showPrice,consented_at AS consentedAt,published_post_id AS publishedPostId,published_at AS publishedAt FROM work_order_publication_policies WHERE order_id=? LIMIT 1");
    $q->execute([$orderId]);$publicationPolicy=$q->fetch(PDO::FETCH_ASSOC)?:null;

    $partsRequired = !empty($diagnostics['partsRequired']);
    $reservationReady = !$partsRequired || (count($reservations)>0 && !array_filter($reservations,static fn(array $row):bool=>!in_array((string)($row['status']??''),['reserved','issued'],true) || (float)($row['qtyReserved']??0)<(float)($row['qtyRequested']??0)));
    $quality = $qualityChecks[0] ?? null;
    $pendingQuotes = count(array_filter($extraQuotes,static fn(array $row):bool=>(string)($row['status']??'')==='pending'));
    $runningTimer=0;
    if(kareta_table_exists($pdo,'work_order_timers')){$t=$pdo->prepare("SELECT COUNT(*) FROM work_order_timers WHERE order_id=? AND status='running'");$t->execute([$orderId]);$runningTimer=(int)$t->fetchColumn();}

    $aftercare = function_exists('kareta_master_aftercare_snapshot') ? kareta_master_aftercare_snapshot($pdo,$orderId,$order) : null;
    return [
        'actor'=>$actor,
        'diagnostics'=>$diagnostics,
        'extraQuotes'=>$extraQuotes,
        'reservations'=>$reservations,
        'qualityChecks'=>$qualityChecks,
        'handover'=>$handover,
        'warranty'=>$warranty,
        'publicationPolicy'=>$publicationPolicy,
        'aftercare'=>$aftercare,
        'readiness'=>[
            'diagnosticsComplete'=>($diagnostics && (string)$diagnostics['status']==='completed'),
            'pendingExtraQuotes'=>$pendingQuotes,
            'partsRequired'=>$partsRequired,
            'partsReserved'=>$reservationReady,
            'workTimerRunning'=>$runningTimer>0,
            'qualityPassed'=>($quality && (string)$quality['result']==='pass'),
            'handoverReady'=>($handover && in_array((string)$handover['status'],['ready','accepted'],true)),
            'handoverAccepted'=>($handover && (string)$handover['status']==='accepted'),
            'warrantyActive'=>($warranty && (string)$warranty['status']==='active'),
            'publicationConsented'=>($publicationPolicy && !empty($publicationPolicy['clientConsent'])),
            'autoPublish'=>($publicationPolicy && !empty($publicationPolicy['autoPublish'])),
        ],
    ];
}

function kareta_master_order_lifecycle_default_checklist(PDO $pdo,string $orderId): void {
    $items=[
        ['diag_complaint','diagnostics','Зафиксировать жалобу клиента',10],
        ['diag_scan','diagnostics','Считать ошибки и параметры диагностики',20],
        ['diag_visual','diagnostics','Провести визуальный осмотр',30],
        ['repair_confirm','in_progress','Сверить выполненные работы с заказ-нарядом',40],
        ['quality_fasteners','quality_control','Проверить крепёж и соединения',50],
        ['quality_leaks','quality_control','Проверить отсутствие течей',60],
        ['quality_faults','quality_control','Повторно проверить ошибки',70],
        ['quality_result','quality_control','Подтвердить устранение жалобы клиента',80],
    ];
    $ins=$pdo->prepare("INSERT IGNORE INTO work_order_checklist_items(id,order_id,stage_key,title,done,sort_order) VALUES(?,?,?,?,0,?)");
    foreach($items as [$suffix,$stage,$title,$sort])$ins->execute(['woc_'.$orderId.'_'.$suffix,$orderId,$stage,$title,$sort]);
}

function kareta_master_order_accept(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);
    $orderId=trim((string)($body['orderId']??$body['id']??''));$order=kareta_master_order_lifecycle_order($pdo,$orderId,true);
    kareta_master_order_lifecycle_ensure($pdo);kareta_master_order_lifecycle_default_checklist($pdo,$orderId);
    $workflow=kareta_master_order_lifecycle_require_stage($pdo,$orderId,['intake','diagnostics']);
    if((string)($workflow['current_stage']??'intake')==='intake')kareta_sto_workflow_transition_apply($pdo,$orderId,'diagnostics','Заказ принят мастером',['source'=>'master_order_accept']);
    $pdo->prepare("UPDATE orders SET status='process',updated_at=NOW() WHERE id=?")->execute([$orderId]);
    kareta_write_event($pdo,$orderId,'master_order_accepted',['masterId'=>$actor['masterId']]);
    kareta_json(['ok'=>true,'data'=>kareta_master_order_lifecycle_snapshot($pdo,$orderId,$order)]);
}

function kareta_master_order_diagnostics_save(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);
    $orderId=trim((string)($body['orderId']??''));$order=kareta_master_order_lifecycle_order($pdo,$orderId,true);kareta_master_order_lifecycle_ensure($pdo);
    kareta_master_order_lifecycle_require_stage($pdo,$orderId,['diagnostics']);
    $complete=!empty($body['complete']);
    $complaints=mb_substr(trim((string)($body['complaints']??'')),0,4000);
    $findings=mb_substr(trim((string)($body['findings']??'')),0,12000);
    $recommendations=mb_substr(trim((string)($body['recommendations']??'')),0,12000);
    if($complete&&($complaints===''||$findings===''))kareta_json(['ok'=>false,'error'=>'diagnostics_incomplete','message'=>'Для завершения диагностики заполните жалобу клиента и результаты проверки'],422);
    $measurements=is_array($body['measurements']??null)?$body['measurements']:[];
    $id='mod_'.$orderId;
    $st=$pdo->prepare("INSERT INTO master_order_diagnostics(id,order_id,complaints,findings,recommendations,measurements_json,parts_required,status,diagnosed_by_user_id,diagnosed_by_context_id,completed_at) VALUES(?,?,?,?,?,?,?,?,?,?,IF(?=1,NOW(),NULL)) ON DUPLICATE KEY UPDATE complaints=VALUES(complaints),findings=VALUES(findings),recommendations=VALUES(recommendations),measurements_json=VALUES(measurements_json),parts_required=VALUES(parts_required),status=VALUES(status),diagnosed_by_user_id=VALUES(diagnosed_by_user_id),diagnosed_by_context_id=VALUES(diagnosed_by_context_id),completed_at=IF(VALUES(status)='completed',COALESCE(completed_at,NOW()),NULL),updated_at=NOW()");
    $st->execute([$id,$orderId,$complaints,$findings,$recommendations,json_encode($measurements,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),!empty($body['partsRequired'])?1:0,$complete?'completed':'draft',$actor['userId']?:null,$actor['contextId']?:null,$complete?1:0]);
    kareta_write_event($pdo,$orderId,$complete?'diagnostics_completed':'diagnostics_saved',['partsRequired'=>!empty($body['partsRequired'])]);
    if($complete){$workflow=kareta_sto_workflow_ensure($pdo,$orderId);if((string)$workflow['current_stage']==='diagnostics')kareta_sto_workflow_transition_apply($pdo,$orderId,'estimate','Диагностика завершена',['source'=>'diagnostics_save']);}
    kareta_json(['ok'=>true,'data'=>kareta_master_order_lifecycle_snapshot($pdo,$orderId,$order)]);
}

function kareta_master_order_extra_request(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);
    $orderId=trim((string)($body['orderId']??''));$order=kareta_master_order_lifecycle_order($pdo,$orderId,true);kareta_master_order_lifecycle_ensure($pdo);kareta_master_order_lifecycle_require_stage($pdo,$orderId,['estimate']);
    $title=mb_substr(trim((string)($body['title']??'')),0,255);$labor=max(0,(float)($body['laborPrice']??0));$parts=max(0,(float)($body['partsPrice']??0));$items=is_array($body['items']??null)?$body['items']:[];$comment=mb_substr(trim((string)($body['comment']??'')),0,4000);
    if($title===''||$comment==='')kareta_json(['ok'=>false,'error'=>'extra_work_details_required','message'=>'Укажите название и причину дополнительных работ'],422);
    $id='eq_'.bin2hex(random_bytes(8));
    $pdo->prepare("INSERT INTO order_extra_quotes(id,order_id,master_id,title,labor_price,parts_price,total_price,items_json,comment,status) VALUES(?,?,?,?,?,?,?,?,?,'pending')")->execute([$id,$orderId,$actor['masterId']?:($order['master_id']??null),$title,$labor,$parts,$labor+$parts,json_encode($items,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$comment]);
    kareta_sto_workflow_approval_record($pdo,$orderId,'estimate','pending',$labor+$parts,['quoteId'=>$id,'title'=>$title]);
    $workflow=kareta_sto_workflow_ensure($pdo,$orderId);if((string)$workflow['current_stage']==='estimate')kareta_sto_workflow_transition_apply($pdo,$orderId,'approval','Дополнительные работы отправлены клиенту',['quoteId'=>$id]);
    kareta_write_event($pdo,$orderId,'extra_work_requested',['quoteId'=>$id,'total'=>$labor+$parts]);
    try{kareta_notification_insert($pdo,['recipientUserId'=>(int)($order['client_user_id']??0)?:null,'recipientPhone'=>(string)($order['client_phone']??''),'recipientRole'=>'client','eventType'=>'extra_quote.proposed','entityType'=>'order','entityId'=>$orderId,'title'=>'Нужно согласовать дополнительные работы','body'=>$title.' — '.number_format($labor+$parts,0,'.',' ').' ₸','actionUrl'=>'#/orders/item/'.rawurlencode($orderId),'meta'=>['quoteId'=>$id]]);}catch(Throwable $_){}
    kareta_json(['ok'=>true,'quoteId'=>$id]);
}

function kareta_master_order_estimate_skip(PDO $pdo,array $body): void {
    kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);
    $orderId=trim((string)($body['orderId']??''));kareta_master_order_lifecycle_order($pdo,$orderId,true);kareta_master_order_lifecycle_ensure($pdo);kareta_master_order_lifecycle_require_stage($pdo,$orderId,['estimate']);
    kareta_sto_workflow_approval_record($pdo,$orderId,'estimate','approved',isset($body['amount'])?(float)$body['amount']:null,['noAdditionalWork'=>true]);
    $workflow=kareta_sto_workflow_ensure($pdo,$orderId);$stage=(string)$workflow['current_stage'];
    if($stage==='estimate')kareta_sto_workflow_transition_apply($pdo,$orderId,'approval','Дополнительные работы не требуются');
    $workflow=kareta_sto_workflow_ensure($pdo,$orderId);if((string)$workflow['current_stage']==='approval')kareta_sto_workflow_transition_apply($pdo,$orderId,'work_order','Смета подтверждена без допработ');
    kareta_write_event($pdo,$orderId,'estimate_confirmed_without_extras',[]);kareta_json(['ok'=>true]);
}

function kareta_client_order_extra_decide(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['client','admin','owner']);
    $quoteId=trim((string)($body['quoteId']??''));$decision=trim((string)($body['decision']??''));if(!in_array($decision,['approved','declined'],true))kareta_json(['ok'=>false,'error'=>'decision_invalid'],422);
    kareta_master_order_lifecycle_ensure($pdo);$q=$pdo->prepare("SELECT * FROM order_extra_quotes WHERE id=? LIMIT 1");$q->execute([$quoteId]);$quote=$q->fetch(PDO::FETCH_ASSOC);if(!$quote)kareta_json(['ok'=>false,'error'=>'quote_not_found'],404);
    $orderId=(string)$quote['order_id'];$order=kareta_master_order_lifecycle_order($pdo,$orderId,false);if((string)$actor['role']==='client'&&!kareta_work_order_can_view($pdo,$order))kareta_json(['ok'=>false,'error'=>'forbidden'],403);
    kareta_master_order_lifecycle_require_stage($pdo,$orderId,['approval']);
    if((string)$quote['status']!=='pending')kareta_json(['ok'=>false,'error'=>'already_decided'],409);
    $dbStatus=$decision==='approved'?'accepted':'declined';$pdo->prepare("UPDATE order_extra_quotes SET status=?,decided_at=NOW() WHERE id=?")->execute([$dbStatus,$quoteId]);
    if($decision==='approved'){$pdo->prepare("UPDATE orders SET price=COALESCE(price,0)+?,updated_at=NOW() WHERE id=?")->execute([(float)$quote['total_price'],$orderId]);}
    kareta_sto_workflow_approval_record($pdo,$orderId,'estimate',$decision==='approved'?'approved':'declined',(float)$quote['total_price'],['quoteId'=>$quoteId]);
    $workflow=kareta_sto_workflow_ensure($pdo,$orderId);
    if((string)$workflow['current_stage']==='approval'){
        if($decision==='declined'){
            $pdo->prepare("UPDATE order_extra_quotes SET status='cancelled',decided_at=NOW() WHERE order_id=? AND status='pending' AND id<>?")->execute([$orderId,$quoteId]);
            kareta_sto_workflow_transition_apply($pdo,$orderId,'estimate','Клиент отклонил дополнительные работы',['quoteId'=>$quoteId]);
        }else{
            $pending=$pdo->prepare("SELECT COUNT(*) FROM order_extra_quotes WHERE order_id=? AND status='pending'");$pending->execute([$orderId]);
            if((int)$pending->fetchColumn()===0)kareta_sto_workflow_transition_apply($pdo,$orderId,'work_order','Клиент согласовал дополнительные работы',['quoteId'=>$quoteId]);
        }
    }
    kareta_write_event($pdo,$orderId,'extra_work_'.$decision,['quoteId'=>$quoteId,'userId'=>$actor['userId']]);kareta_json(['ok'=>true,'status'=>$decision]);
}

function kareta_master_order_parts_reserve(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);$orderId=trim((string)($body['orderId']??''));$order=kareta_master_order_lifecycle_order($pdo,$orderId,true);kareta_master_order_lifecycle_ensure($pdo);kareta_master_order_lifecycle_require_stage($pdo,$orderId,['work_order','parts_reservation']);
    $partName=mb_substr(trim((string)($body['partName']??$body['name']??'')),0,255);if($partName==='')kareta_json(['ok'=>false,'error'=>'part_name_required'],422);
    $partKey=trim((string)($body['partKey']??''));if($partKey==='')$partKey=substr(hash('sha256',mb_strtolower($partName).'|'.($body['oem']??'').'|'.($body['sku']??'')),0,32);
    $requested=max(.001,(float)($body['qtyRequested']??$body['qty']??1));$reserved=max(0,(float)($body['qtyReserved']??$requested));$status=(string)($body['status']??($reserved>=$requested?'reserved':'partial'));if(!in_array($status,['requested','partial','reserved','unavailable','issued','returned'],true))$status='requested';
    $id='wpr_'.$orderId.'_'.substr($partKey,0,32);
    $pdo->prepare("INSERT INTO work_order_part_reservations(id,order_id,part_key,part_name,sku,oem,supplier_label,qty_requested,qty_reserved,unit_price,status,note,reserved_by_user_id,reserved_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,IF(? IN ('reserved','issued'),NOW(),NULL),?) ON DUPLICATE KEY UPDATE part_name=VALUES(part_name),sku=VALUES(sku),oem=VALUES(oem),supplier_label=VALUES(supplier_label),qty_requested=VALUES(qty_requested),qty_reserved=VALUES(qty_reserved),unit_price=VALUES(unit_price),status=VALUES(status),note=VALUES(note),reserved_by_user_id=VALUES(reserved_by_user_id),reserved_at=IF(VALUES(status) IN ('reserved','issued'),COALESCE(reserved_at,NOW()),NULL),expires_at=VALUES(expires_at),updated_at=NOW()")->execute([$id,$orderId,$partKey,$partName,mb_substr(trim((string)($body['sku']??'')),0,120),mb_substr(trim((string)($body['oem']??'')),0,120),mb_substr(trim((string)($body['supplierLabel']??'')),0,191),$requested,$reserved,max(0,(float)($body['unitPrice']??0)),$status,mb_substr(trim((string)($body['note']??'')),0,500),$actor['userId']?:null,$status,$body['expiresAt']??null]);
    kareta_write_event($pdo,$orderId,'part_reservation_saved',['partKey'=>$partKey,'status'=>$status]);kareta_json(['ok'=>true,'data'=>kareta_master_order_lifecycle_snapshot($pdo,$orderId,$order)]);
}

function kareta_master_order_parts_complete(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);$orderId=trim((string)($body['orderId']??''));$order=kareta_master_order_lifecycle_order($pdo,$orderId,true);kareta_master_order_lifecycle_ensure($pdo);if(function_exists('kareta_master_aftercare_ensure'))kareta_master_aftercare_ensure($pdo);kareta_master_order_lifecycle_require_stage($pdo,$orderId,['work_order','parts_reservation']);
    $snapshot=kareta_master_order_lifecycle_snapshot($pdo,$orderId,$order);$noParts=!empty($body['noPartsRequired']);
    if($noParts&&!empty($snapshot['readiness']['partsRequired']))kareta_json(['ok'=>false,'error'=>'parts_required_by_diagnostics','message'=>'Диагностика требует запчасти — начать ремонт без полного резерва нельзя'],422);
    if(!$noParts&&!$snapshot['readiness']['partsReserved'])kareta_json(['ok'=>false,'error'=>'parts_not_reserved','message'=>'Не все необходимые запчасти зарезервированы'],422);
    if(!$noParts&&function_exists('kareta_master_aftercare_issue_reserved_inventory')){
        $pdo->beginTransaction();
        try{kareta_master_aftercare_issue_reserved_inventory($pdo,$orderId,$order,$actor);$pdo->commit();}
        catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'inventory_issue_failed','message'=>'Не удалось списать зарезервированные детали со склада','detail'=>$e->getMessage()],409);}
    }
    $workflow=kareta_sto_workflow_ensure($pdo,$orderId);if((string)$workflow['current_stage']==='work_order'&&!$noParts)kareta_sto_workflow_transition_apply($pdo,$orderId,'parts_reservation','Запчасти зарезервированы');
    $workflow=kareta_sto_workflow_ensure($pdo,$orderId);if(in_array((string)$workflow['current_stage'],['work_order','parts_reservation'],true))kareta_sto_workflow_transition_apply($pdo,$orderId,'in_progress',$noParts?'Работа не требует запчастей':'Запчасти выданы со склада в работу');
    if(function_exists('kareta_master_aftercare_recalculate'))kareta_master_aftercare_recalculate($pdo,$orderId,$order);
    kareta_write_event($pdo,$orderId,$noParts?'parts_not_required':'parts_inventory_issued',[]);kareta_json(['ok'=>true]);
}

function kareta_master_order_work_complete(PDO $pdo,array $body): void {
    kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);$orderId=trim((string)($body['orderId']??''));kareta_master_order_lifecycle_order($pdo,$orderId,true);kareta_master_order_lifecycle_ensure($pdo);kareta_master_order_lifecycle_require_stage($pdo,$orderId,['in_progress']);
    $snapshot=kareta_master_order_lifecycle_snapshot($pdo,$orderId);if($snapshot['readiness']['workTimerRunning'])kareta_json(['ok'=>false,'error'=>'work_timer_running','message'=>'Сначала завершите активный рабочий таймер'],422);
    $workflow=kareta_sto_workflow_ensure($pdo,$orderId);if((string)$workflow['current_stage']==='in_progress')kareta_sto_workflow_transition_apply($pdo,$orderId,'quality_control','Работы завершены, автомобиль передан на контроль качества');
    kareta_write_event($pdo,$orderId,'repair_completed_for_quality',[]);kareta_json(['ok'=>true]);
}

function kareta_master_order_quality_save(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);$orderId=trim((string)($body['orderId']??''));kareta_master_order_lifecycle_order($pdo,$orderId,true);kareta_master_order_lifecycle_ensure($pdo);kareta_master_order_lifecycle_require_stage($pdo,$orderId,['quality_control']);
    $result=(string)($body['result']??'pending');if(!in_array($result,['pass','fail'],true))kareta_json(['ok'=>false,'error'=>'quality_result_required'],422);
    if($result==='pass'){
        $requiredChecks=[
            'noLeaks'=>'Проверка герметичности',
            'noFaultCodes'=>'Проверка кодов неисправностей',
            'fastenersChecked'=>'Контроль крепежа',
            'clientRequestVerified'=>'Проверка обращения клиента',
        ];
        $missing=[];foreach($requiredChecks as $field=>$label){if(empty($body[$field]))$missing[]=$label;}
        if($missing)kareta_json(['ok'=>false,'error'=>'quality_checks_incomplete','message'=>'Нельзя завершить контроль качества: '.implode(', ',$missing),'missingChecks'=>array_keys(array_filter($requiredChecks,fn($label,$field)=>empty($body[$field]),ARRAY_FILTER_USE_BOTH))],422);
    }
    $nq=$pdo->prepare("SELECT COALESCE(MAX(attempt_no),0)+1 FROM work_order_quality_checks WHERE order_id=?");$nq->execute([$orderId]);$attempt=(int)$nq->fetchColumn();$id='woq_'.$orderId.'_'.$attempt;
    $pdo->prepare("INSERT INTO work_order_quality_checks(id,order_id,attempt_no,result,road_test,no_leaks,no_fault_codes,fasteners_checked,client_request_verified,notes,checked_by_user_id,checked_by_context_id,checked_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NOW())")->execute([$id,$orderId,$attempt,$result,!empty($body['roadTest'])?1:0,!empty($body['noLeaks'])?1:0,!empty($body['noFaultCodes'])?1:0,!empty($body['fastenersChecked'])?1:0,!empty($body['clientRequestVerified'])?1:0,mb_substr(trim((string)($body['notes']??'')),0,4000),$actor['userId']?:null,$actor['contextId']?:null]);
    kareta_sto_workflow_approval_record($pdo,$orderId,'quality',$result==='pass'?'approved':'declined',null,['qualityCheckId'=>$id,'attempt'=>$attempt]);
    $workflow=kareta_sto_workflow_ensure($pdo,$orderId);if((string)$workflow['current_stage']==='quality_control')kareta_sto_workflow_transition_apply($pdo,$orderId,$result==='pass'?'payment':'in_progress',$result==='pass'?'Контроль качества пройден':'Контроль качества выявил доработки',['qualityCheckId'=>$id]);
    kareta_write_event($pdo,$orderId,'quality_'.$result,['qualityCheckId'=>$id,'attempt'=>$attempt]);kareta_json(['ok'=>true]);
}

function kareta_master_order_warranty_configure(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);$orderId=trim((string)($body['orderId']??''));$order=kareta_master_order_lifecycle_order($pdo,$orderId,true);kareta_master_order_lifecycle_ensure($pdo);kareta_master_order_lifecycle_require_stage($pdo,$orderId,['payment','delivery','warranty']);
    $days=max(0,min(3650,(int)($body['warrantyDays']??0)));$id='wow_'.$orderId;
    $pdo->prepare("INSERT INTO work_order_warranties(id,order_id,master_id,sto_id,warranty_days,scope_text,exclusions_text,status) VALUES(?,?,?,?,?,?,?,'draft') ON DUPLICATE KEY UPDATE master_id=VALUES(master_id),sto_id=VALUES(sto_id),warranty_days=VALUES(warranty_days),scope_text=VALUES(scope_text),exclusions_text=VALUES(exclusions_text),updated_at=NOW()")->execute([$id,$orderId,(string)($order['master_id']??$actor['masterId']),(string)($order['sto_id']??''),$days,mb_substr(trim((string)($body['scopeText']??'')),0,8000),mb_substr(trim((string)($body['exclusionsText']??'')),0,8000)]);
    kareta_write_event($pdo,$orderId,'warranty_configured',['days'=>$days]);kareta_json(['ok'=>true]);
}

function kareta_master_order_handover_prepare(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);$orderId=trim((string)($body['orderId']??''));$order=kareta_master_order_lifecycle_order($pdo,$orderId,true);kareta_master_order_lifecycle_ensure($pdo);kareta_master_order_lifecycle_require_stage($pdo,$orderId,['payment','delivery']);
    $snapshot=kareta_master_order_lifecycle_snapshot($pdo,$orderId,$order);if(!$snapshot['readiness']['qualityPassed'])kareta_json(['ok'=>false,'error'=>'quality_not_passed','message'=>'Выдача доступна только после успешного контроля качества'],422);
    $payment=(string)($body['paymentStatus']??'not_required');if(!in_array($payment,['not_required','paid','pending'],true))$payment='pending';$id='woh_'.$orderId;
    $documents=is_array($body['documents']??null)?$body['documents']:[];$handoverStatus=in_array($payment,['paid','not_required'],true)?'ready':'draft';
    $pdo->prepare("INSERT INTO work_order_handovers(id,order_id,status,payment_status,odometer_km,fuel_level,keys_count,documents_json,notes,prepared_by_user_id,prepared_at) VALUES(?,?,?,?,?,?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE status=VALUES(status),payment_status=VALUES(payment_status),odometer_km=VALUES(odometer_km),fuel_level=VALUES(fuel_level),keys_count=VALUES(keys_count),documents_json=VALUES(documents_json),notes=VALUES(notes),prepared_by_user_id=VALUES(prepared_by_user_id),prepared_at=NOW(),updated_at=NOW()")->execute([$id,$orderId,$handoverStatus,$payment,isset($body['odometerKm'])?(int)$body['odometerKm']:null,mb_substr(trim((string)($body['fuelLevel']??'')),0,24),max(0,(int)($body['keysCount']??1)),json_encode($documents,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),mb_substr(trim((string)($body['notes']??'')),0,4000),$actor['userId']?:null]);
    if(in_array($payment,['paid','not_required'],true))kareta_sto_workflow_approval_record($pdo,$orderId,'payment','approved',isset($body['amount'])?(float)$body['amount']:null,['paymentStatus'=>$payment]);
    $workflow=kareta_sto_workflow_ensure($pdo,$orderId);if((string)$workflow['current_stage']==='payment'&&in_array($payment,['paid','not_required'],true))kareta_sto_workflow_transition_apply($pdo,$orderId,'delivery','Автомобиль подготовлен к выдаче');
    if($handoverStatus==='ready')$pdo->prepare("UPDATE orders SET status='done_pending_client',car_handover_pending=1,updated_at=NOW() WHERE id=?")->execute([$orderId]);
    else $pdo->prepare("UPDATE orders SET status='process',car_handover_pending=0,updated_at=NOW() WHERE id=?")->execute([$orderId]);
    kareta_write_event($pdo,$orderId,$handoverStatus==='ready'?'handover_ready':'handover_payment_pending',['paymentStatus'=>$payment]);kareta_json(['ok'=>true,'status'=>$handoverStatus]);
}

function kareta_client_order_publication_consent(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['client','admin','owner']);$orderId=trim((string)($body['orderId']??''));$order=kareta_master_order_lifecycle_order($pdo,$orderId,false);kareta_master_order_lifecycle_ensure($pdo);kareta_master_order_lifecycle_require_stage($pdo,$orderId,['delivery','warranty','completed']);
    $consent=!empty($body['clientConsent']);$auto=$consent&&!empty($body['autoPublish']);$showPrice=$consent&&!empty($body['showPrice']);$id='wopp_'.$orderId;
    $pdo->prepare("INSERT INTO work_order_publication_policies(id,order_id,client_consent,auto_publish,anonymize_client,show_price,consented_by_user_id,consented_at) VALUES(?,?,?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE client_consent=VALUES(client_consent),auto_publish=VALUES(auto_publish),anonymize_client=VALUES(anonymize_client),show_price=VALUES(show_price),consented_by_user_id=VALUES(consented_by_user_id),consented_at=NOW(),updated_at=NOW()")->execute([$id,$orderId,$consent?1:0,$auto?1:0,!empty($body['anonymizeClient'])?1:0,$showPrice?1:0,$actor['userId']?:null]);
    kareta_write_event($pdo,$orderId,$consent?'publication_consent_granted':'publication_consent_revoked',['autoPublish'=>$auto,'showPrice'=>$showPrice]);kareta_json(['ok'=>true,'data'=>kareta_master_order_lifecycle_snapshot($pdo,$orderId,$order)]);
}

function kareta_client_order_handover_confirm(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['client','admin','owner']);$orderId=trim((string)($body['orderId']??$body['id']??''));$order=kareta_master_order_lifecycle_order($pdo,$orderId,false);kareta_master_order_lifecycle_ensure($pdo);
    $workflow=kareta_sto_workflow_ensure($pdo,$orderId);$currentStage=(string)($workflow['current_stage']??'intake');
    if($currentStage==='completed')kareta_json(['ok'=>true,'idempotent'=>true,'data'=>kareta_master_order_lifecycle_snapshot($pdo,$orderId,$order)]);
    kareta_master_order_lifecycle_require_stage($pdo,$orderId,['delivery']);
    $q=$pdo->prepare("SELECT * FROM work_order_handovers WHERE order_id=? LIMIT 1");$q->execute([$orderId]);$handover=$q->fetch(PDO::FETCH_ASSOC);if(!$handover||!in_array((string)$handover['status'],['ready','accepted'],true))kareta_json(['ok'=>false,'error'=>'handover_not_ready'],422);
    $pdo->prepare("UPDATE work_order_handovers SET status='accepted',accepted_by_user_id=?,accepted_at=NOW(),updated_at=NOW() WHERE order_id=?")->execute([$actor['userId']?:null,$orderId]);
    $pdo->prepare("UPDATE orders SET status='done',car_handover_pending=0,car_handover_confirmed=1,closed_at=COALESCE(closed_at,NOW()),updated_at=NOW() WHERE id=?")->execute([$orderId]);
    $w=$pdo->prepare("SELECT * FROM work_order_warranties WHERE order_id=? LIMIT 1");$w->execute([$orderId]);$warranty=$w->fetch(PDO::FETCH_ASSOC);
    if(!$warranty){$id='wow_'.$orderId;$pdo->prepare("INSERT INTO work_order_warranties(id,order_id,master_id,sto_id,warranty_days,scope_text,status) VALUES(?,?,?,?,0,'Гарантия не заявлена','active')")->execute([$id,$orderId,(string)($order['master_id']??''),(string)($order['sto_id']??'')]);$warranty=['warranty_days'=>0];}
    $days=max(0,(int)($warranty['warranty_days']??0));$endsSql=$days>0?"DATE_ADD(NOW(),INTERVAL {$days} DAY)":"NULL";$pdo->prepare("UPDATE work_order_warranties SET status='active',starts_at=NOW(),ends_at={$endsSql},activated_by_user_id=?,updated_at=NOW() WHERE order_id=?")->execute([$actor['userId']?:null,$orderId]);
    $workflow=kareta_sto_workflow_ensure($pdo,$orderId);if((string)$workflow['current_stage']==='delivery')kareta_sto_workflow_transition_apply($pdo,$orderId,'warranty','Автомобиль выдан клиенту, гарантия активирована');
    $post=null;$policyQ=$pdo->prepare("SELECT * FROM work_order_publication_policies WHERE order_id=? LIMIT 1");$policyQ->execute([$orderId]);$policy=$policyQ->fetch(PDO::FETCH_ASSOC)?:[];
    if(!empty($policy['client_consent'])&&!empty($policy['auto_publish'])&&function_exists('kareta_work_post_publish_internal')){
        try{$post=kareta_work_post_publish_internal($pdo,$order,['clientConsent'=>true,'consentVerified'=>true,'anonymizeClient'=>!empty($policy['anonymize_client']),'showPrice'=>!empty($policy['show_price']),'automatic'=>true]);$pdo->prepare("UPDATE work_order_publication_policies SET published_post_id=?,published_at=NOW(),updated_at=NOW() WHERE order_id=?")->execute([(string)($post['id']??''),$orderId]);}catch(Throwable $e){kareta_log_error('auto_work_post_publish',$e->getMessage());}
    }
    $workflow=kareta_sto_workflow_ensure($pdo,$orderId);if((string)$workflow['current_stage']==='warranty')kareta_sto_workflow_transition_apply($pdo,$orderId,'completed','Заказ завершён, гарантия действует отдельно',['postId'=>$post['id']??'']);
    if(function_exists('kareta_master_aftercare_recalculate'))kareta_master_aftercare_recalculate($pdo,$orderId,$order);
    kareta_write_event($pdo,$orderId,'handover_accepted',['warrantyDays'=>$days,'postId'=>$post['id']??'']);kareta_json(['ok'=>true,'post'=>$post,'data'=>kareta_master_order_lifecycle_snapshot($pdo,$orderId,$order)]);
}
