<?php
declare(strict_types=1);

function kareta_work_order_effective_role(PDO $pdo): string {
    $legacy = strtolower((string)(kareta_session_user()['role'] ?? 'client'));
    if (function_exists('kareta_master_workplace_identity_context')) {
        $identity = kareta_master_workplace_identity_context($pdo);
        $context = is_array($identity['context'] ?? null) ? $identity['context'] : [];
        $type = strtolower((string)($context['type'] ?? $context['contextType'] ?? ''));
        $profile = strtolower((string)($context['profileType'] ?? ''));
        $organization = strtolower((string)($context['organizationType'] ?? ''));
        if ($type === 'profile' && $profile === 'master') return 'master';
        if ($type === 'organization') return $organization === 'parts_store' ? 'seller' : 'sto';
        if ($type === 'personal') return 'client';
    }
    return $legacy;
}

function kareta_work_order_can_view(PDO $pdo, array $order): bool {
    if (kareta_has_role('admin') || kareta_has_role('owner')) return true;
    $user = kareta_session_user();
    $uid = (int)($user['id'] ?? 0);
    $phone = kareta_normalize_phone((string)($user['phone'] ?? ''));
    $role = kareta_work_order_effective_role($pdo);
    if ($role === 'client') {
        return ((int)($order['client_user_id'] ?? 0) === $uid)
            || ($phone !== '' && kareta_normalize_phone((string)($order['client_phone'] ?? '')) === $phone);
    }
    if ($role === 'master') {
        $masterId = '';
        if (function_exists('kareta_master_workplace_profile')) {
            $profile = kareta_master_workplace_profile($pdo);
            $masterId = trim((string)($profile['id'] ?? ''));
        }
        if ($masterId !== '' && $masterId === (string)($order['master_id'] ?? '')) return true;
        return trim((string)($order['master_id'] ?? '')) === '' && (int)($order['master_user_id'] ?? 0) === $uid;
    }
    if ($role === 'sto') {
        $st=$pdo->prepare("SELECT id FROM sto_profiles WHERE user_id=? OR user_phone=? OR contact_phone=? LIMIT 1");
        $st->execute([$uid ?: -1,$phone,$phone]);
        return (string)($st->fetchColumn() ?: '') === (string)($order['sto_id'] ?? '');
    }
    return false;
}

function kareta_work_order_require(PDO $pdo, string $id, bool $write=false): array {
    $st=$pdo->prepare("SELECT * FROM orders WHERE id=? LIMIT 1");
    $st->execute([$id]);
    $order=$st->fetch(PDO::FETCH_ASSOC);
    if(!$order) kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    if(!kareta_work_order_can_view($pdo,$order)) kareta_json(['ok'=>false,'error'=>'forbidden'],403);
    if($write && !in_array(kareta_work_order_effective_role($pdo),['master','sto','admin','owner'],true)) kareta_json(['ok'=>false,'error'=>'forbidden'],403);
    return $order;
}

function kareta_work_order_decode($value): array {
    if(is_array($value)) return $value;
    $decoded=json_decode((string)$value,true);
    return is_array($decoded)?$decoded:[];
}

function kareta_work_order_detail(PDO $pdo, array $input): void {
    $id=trim((string)($input['id']??''));
    if($id==='') kareta_json(['ok'=>false,'error'=>'id_required'],400);
    $order=kareta_work_order_require($pdo,$id,false);
    $order=_fmt_order($order);
    foreach(['stages','reports','orderParts','serviceIds'] as $key){ if(isset($order[$key])) $order[$key]=kareta_work_order_decode($order[$key]); }

    if(!kareta_table_exists($pdo,'work_order_checklist_items')) $pdo->exec("CREATE TABLE IF NOT EXISTS work_order_checklist_items (id VARCHAR(64) PRIMARY KEY,order_id VARCHAR(64) NOT NULL,stage_key VARCHAR(64) NOT NULL DEFAULT '',title VARCHAR(255) NOT NULL,done TINYINT(1) NOT NULL DEFAULT 0,sort_order INT NOT NULL DEFAULT 0,completed_by_user_id BIGINT NULL,completed_at DATETIME NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_woc_order(order_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    if(!kareta_table_exists($pdo,'work_order_media')) $pdo->exec("CREATE TABLE IF NOT EXISTS work_order_media (id VARCHAR(64) PRIMARY KEY,order_id VARCHAR(64) NOT NULL,stage_key VARCHAR(64) NOT NULL DEFAULT '',media_type VARCHAR(24) NOT NULL DEFAULT 'photo',file_url VARCHAR(500) NOT NULL,caption VARCHAR(500) NOT NULL DEFAULT '',visibility VARCHAR(24) NOT NULL DEFAULT 'client',created_by_user_id BIGINT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_wom_order(order_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    if(!kareta_table_exists($pdo,'work_order_publication_drafts')) $pdo->exec("CREATE TABLE IF NOT EXISTS work_order_publication_drafts (id VARCHAR(64) PRIMARY KEY,order_id VARCHAR(64) NOT NULL UNIQUE,master_id VARCHAR(64) NOT NULL DEFAULT '',sto_id VARCHAR(64) NOT NULL DEFAULT '',title VARCHAR(255) NOT NULL,body MEDIUMTEXT NULL,status VARCHAR(24) NOT NULL DEFAULT 'draft',visibility VARCHAR(24) NOT NULL DEFAULT 'public',cover_url VARCHAR(500) NOT NULL DEFAULT '',created_by_user_id BIGINT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $q=$pdo->prepare("SELECT id,stage_key AS stageKey,title,done,sort_order AS sortOrder,completed_at AS completedAt FROM work_order_checklist_items WHERE order_id=? ORDER BY sort_order,id");
    $q->execute([$id]); $checklist=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
    $q=$pdo->prepare("SELECT id,stage_key AS stageKey,media_type AS mediaType,file_url AS fileUrl,caption,visibility,created_at AS createdAt FROM work_order_media WHERE order_id=? ORDER BY created_at DESC");
    $q->execute([$id]); $media=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
    $q=$pdo->prepare("SELECT id,title,body,status,visibility,cover_url AS coverUrl,created_at AS createdAt,updated_at AS updatedAt FROM work_order_publication_drafts WHERE order_id=? ORDER BY updated_at DESC LIMIT 1");
    $q->execute([$id]); $publication=$q->fetch(PDO::FETCH_ASSOC)?:null;
    $timers=[];
    if(kareta_table_exists($pdo,'work_order_timers')){
        $q=$pdo->prepare("SELECT id,stage_key AS stageKey,started_at AS startedAt,stopped_at AS stoppedAt,duration_sec AS durationSec,status,note FROM work_order_timers WHERE order_id=? ORDER BY started_at DESC LIMIT 50");
        $q->execute([$id]); $timers=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
    }
    $events=[];
    if(kareta_table_exists($pdo,'order_events')){
        $q=$pdo->prepare("SELECT id,event_type AS eventType,actor_role AS actorRole,meta,created_at AS createdAt FROM order_events WHERE order_id=? ORDER BY created_at DESC,id DESC LIMIT 100");
        $q->execute([$id]); $events=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
        foreach($events as &$event){$event['meta']=kareta_work_order_decode($event['meta']??'');} unset($event);
    }
    kareta_json(['ok'=>true,'data'=>['order'=>$order,'checklist'=>$checklist,'media'=>$media,'events'=>$events,'publication'=>$publication,'timers'=>$timers]]);
}

function kareta_work_order_checklist_toggle(PDO $pdo,array $b): void {
    $orderId=trim((string)($b['orderId']??'')); $itemId=trim((string)($b['itemId']??''));
    kareta_work_order_require($pdo,$orderId,true);
    $done=!empty($b['done'])?1:0;
    $st=$pdo->prepare("UPDATE work_order_checklist_items SET done=?,completed_by_user_id=?,completed_at=IF(?=1,NOW(),NULL) WHERE id=? AND order_id=?");
    $st->execute([$done,(int)(kareta_session_user()['id']??0)?:null,$done,$itemId,$orderId]);
    kareta_write_event($pdo,$orderId,'checklist_updated',['itemId'=>$itemId,'done'=>$done]);
    kareta_json(['ok'=>true]);
}

function kareta_work_order_media_save(PDO $pdo,array $b): void {
    $orderId=trim((string)($b['orderId']??'')); kareta_work_order_require($pdo,$orderId,true);
    $url=trim((string)($b['fileUrl']??'')); if($url==='') kareta_json(['ok'=>false,'error'=>'file_url_required'],400);
    $id='wom_'.bin2hex(random_bytes(8));
    $type=in_array(($b['mediaType']??''),['photo','video','document'],true)?$b['mediaType']:'photo';
    $st=$pdo->prepare("INSERT INTO work_order_media(id,order_id,stage_key,media_type,file_url,caption,visibility,created_by_user_id) VALUES(?,?,?,?,?,?,?,?)");
    $st->execute([$id,$orderId,trim((string)($b['stageKey']??'')),$type,$url,mb_substr(trim((string)($b['caption']??'')),0,500),in_array(($b['visibility']??''),['private','client','public'],true)?$b['visibility']:'client',(int)(kareta_session_user()['id']??0)?:null]);
    kareta_write_event($pdo,$orderId,'media_added',['mediaId'=>$id,'type'=>$type]);
    kareta_json(['ok'=>true,'id'=>$id]);
}

function kareta_work_order_publication_prepare(PDO $pdo,array $b): void {
    $orderId=trim((string)($b['orderId']??'')); $order=kareta_work_order_require($pdo,$orderId,true);
    $title=trim((string)($b['title']??''));
    if($title==='') $title=trim((string)($order['service_names']??'Выполненная работа'));
    $reports=kareta_work_order_decode($order['reports']??'');
    $parts=kareta_work_order_decode($order['order_parts']??'');
    $lines=[];
    foreach($reports as $r){$t=trim((string)($r['text']??$r['body']??'')); if($t!=='')$lines[]='• '.$t;}
    if($parts){$lines[]='Использовано деталей: '.count($parts).'.';}
    $body=trim((string)($b['body']??''));
    if($body==='') $body="Автомобиль: ".trim((string)($order['client_car']??$order['vehicle_title']??''))."\n\nЧто сделано:\n".($lines?implode("\n",$lines):'Работы выполнены по заказ-наряду.')."\n\nРезультат проверен мастером.";
    $id='wop_'.$orderId;
    $st=$pdo->prepare("INSERT INTO work_order_publication_drafts(id,order_id,master_id,sto_id,title,body,status,visibility,cover_url,created_by_user_id) VALUES(?,?,?,?,?,?,'draft','public',?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),body=VALUES(body),cover_url=VALUES(cover_url),updated_at=NOW()");
    $st->execute([$id,$orderId,(string)($order['master_id']??''),(string)($order['sto_id']??''),$title,$body,trim((string)($b['coverUrl']??'')),(int)(kareta_session_user()['id']??0)?:null]);
    kareta_write_event($pdo,$orderId,'publication_draft_prepared',['draftId'=>$id]);
    kareta_json(['ok'=>true,'draft'=>['id'=>$id,'title'=>$title,'body'=>$body,'status'=>'draft']]);
}
