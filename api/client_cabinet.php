<?php
declare(strict_types=1);

function kareta_client_cabinet_ensure(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `client_preferences`(
      `user_id` BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      `notify_orders` TINYINT(1) NOT NULL DEFAULT 1,
      `notify_promotions` TINYINT(1) NOT NULL DEFAULT 1,
      `notify_service` TINYINT(1) NOT NULL DEFAULT 1,
      `compact_mobile` TINYINT(1) NOT NULL DEFAULT 1,
      `more_menu_layout` ENUM('grid','arc','hex') NOT NULL DEFAULT 'arc',
      `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `client_first_entry_state`(
      `account_id` BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      `user_id` BIGINT UNSIGNED NULL,
      `context_id` BIGINT UNSIGNED NULL,
      `status` VARCHAR(24) NOT NULL DEFAULT 'not_started',
      `current_step` TINYINT UNSIGNED NOT NULL DEFAULT 1,
      `draft_json` JSON NULL,
      `revision` INT UNSIGNED NOT NULL DEFAULT 0,
      `dismissed_at` DATETIME NULL,
      `completed_at` DATETIME NULL,
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY `idx_client_first_entry_user` (`user_id`),
      KEY `idx_client_first_entry_status` (`status`,`updated_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `client_promotions`(
      `id` VARCHAR(64) NOT NULL PRIMARY KEY,
      `title` VARCHAR(191) NOT NULL,
      `description` VARCHAR(500) NOT NULL DEFAULT '',
      `badge` VARCHAR(64) NOT NULL DEFAULT '',
      `action_label` VARCHAR(80) NOT NULL DEFAULT 'Открыть',
      `action_url` VARCHAR(191) NOT NULL DEFAULT '#/services',
      `role_scope` VARCHAR(32) NOT NULL DEFAULT 'client',
      `active` TINYINT(1) NOT NULL DEFAULT 1,
      `starts_at` DATETIME NULL,
      `ends_at` DATETIME NULL,
      `sort` INT NOT NULL DEFAULT 0,
      `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY `idx_client_promotions_active` (`active`,`role_scope`,`sort`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS vehicle_maintenance_items(id VARCHAR(64) PRIMARY KEY,vehicle_id VARCHAR(64) NOT NULL,item_type VARCHAR(32) NOT NULL,title VARCHAR(191) NOT NULL,brand VARCHAR(120) NOT NULL DEFAULT '',model VARCHAR(120) NOT NULL DEFAULT '',installed_at DATE NULL,installed_mileage_km INT NULL,next_due_at DATE NULL,next_due_mileage_km INT NULL,warranty_until DATE NULL,note VARCHAR(500) NOT NULL DEFAULT '',status VARCHAR(24) NOT NULL DEFAULT 'active',created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_vmi_vehicle(vehicle_id,item_type,status),INDEX idx_vmi_due(next_due_at,next_due_mileage_km)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS vehicle_expenses(id VARCHAR(64) PRIMARY KEY,vehicle_id VARCHAR(64) NOT NULL,source_order_id VARCHAR(64) NOT NULL DEFAULT '',expense_type VARCHAR(32) NOT NULL DEFAULT 'service',title VARCHAR(191) NOT NULL,amount DECIMAL(12,2) NOT NULL DEFAULT 0,expense_date DATE NOT NULL,note VARCHAR(500) NOT NULL DEFAULT '',created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,INDEX idx_vehicle_expenses(vehicle_id,expense_date),INDEX idx_vehicle_expenses_order(source_order_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS vehicle_warranties(id VARCHAR(64) PRIMARY KEY,vehicle_id VARCHAR(64) NOT NULL,source_order_id VARCHAR(64) NOT NULL DEFAULT '',title VARCHAR(191) NOT NULL,provider_name VARCHAR(191) NOT NULL DEFAULT '',starts_at DATE NULL,expires_at DATE NULL,mileage_limit_km INT NULL,status VARCHAR(24) NOT NULL DEFAULT 'active',note VARCHAR(500) NOT NULL DEFAULT '',created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_vehicle_warranty(vehicle_id,status,expires_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}


function kareta_client_vehicle_reminders(array $vehicles, array $maintenance, array $warranties, array $documents=[]): array {
    $vehicleMap=[];
    foreach($vehicles as $v){$vehicleMap[(string)($v['id']??'')]=$v;}
    $today=new DateTimeImmutable('today');
    $rows=[];
    $push=static function(array $row) use (&$rows): void {$rows[]=$row;};
    foreach($maintenance as $item){
        $vid=(string)($item['vehicle_id']??''); if($vid===''||!isset($vehicleMap[$vid])) continue;
        $vehicle=$vehicleMap[$vid]; $mileage=(int)($vehicle['mileage_km']??0);
        $dueAt=(string)($item['next_due_at']??''); $dueMileage=(int)($item['next_due_mileage_km']??0);
        $days=null; if($dueAt!==''){try{$days=(int)$today->diff(new DateTimeImmutable($dueAt))->format('%r%a');}catch(Throwable $_){}}
        $kmLeft=$dueMileage>0?$dueMileage-$mileage:null;
        $level='planned';
        if(($days!==null&&$days<0)||($kmLeft!==null&&$kmLeft<0)) $level='overdue';
        elseif(($days!==null&&$days<=30)||($kmLeft!==null&&$kmLeft<=1000)) $level='soon';
        $push(['id'=>'maintenance:'.(string)($item['id']??''),'vehicle_id'=>$vid,'vehicle_title'=>trim(((string)($vehicle['brand']??'')).' '.((string)($vehicle['model']??''))),'type'=>'maintenance','level'=>$level,'title'=>(string)($item['title']??'Обслуживание'),'due_at'=>$dueAt,'due_mileage_km'=>$dueMileage?:null,'days_left'=>$days,'km_left'=>$kmLeft,'action_url'=>'#/cabinet/garage']);
    }
    foreach($warranties as $item){
        $vid=(string)($item['vehicle_id']??''); if($vid===''||!isset($vehicleMap[$vid])) continue;
        $expires=(string)($item['expires_at']??''); if($expires==='') continue;
        try{$days=(int)$today->diff(new DateTimeImmutable($expires))->format('%r%a');}catch(Throwable $_){continue;}
        $level=$days<0?'overdue':($days<=30?'soon':'planned');
        $vehicle=$vehicleMap[$vid];
        $push(['id'=>'warranty:'.(string)($item['id']??''),'vehicle_id'=>$vid,'vehicle_title'=>trim(((string)($vehicle['brand']??'')).' '.((string)($vehicle['model']??''))),'type'=>'warranty','level'=>$level,'title'=>(string)($item['title']??'Гарантия'),'due_at'=>$expires,'due_mileage_km'=>null,'days_left'=>$days,'km_left'=>null,'action_url'=>'#/cabinet/garage']);
    }
    foreach($documents as $item){
        $vid=(string)($item['vehicle_id']??''); if($vid===''||!isset($vehicleMap[$vid])) continue;
        $expires=(string)($item['expires_at']??''); if($expires==='') continue;
        try{$days=(int)$today->diff(new DateTimeImmutable($expires))->format('%r%a');}catch(Throwable $_){continue;}
        $threshold=max(1,(int)($item['reminder_days']??30));
        $level=$days<0?'overdue':($days<=$threshold?'soon':'planned');
        $vehicle=$vehicleMap[$vid];
        $push(['id'=>'document:'.(string)($item['id']??''),'vehicle_id'=>$vid,'vehicle_title'=>trim(((string)($vehicle['brand']??'')).' '.((string)($vehicle['model']??''))),'type'=>'document','level'=>$level,'title'=>(string)($item['title']??'Документ'),'due_at'=>$expires,'due_mileage_km'=>null,'days_left'=>$days,'km_left'=>null,'action_url'=>'#/cabinet/documents']);
    }
    $rank=['overdue'=>0,'soon'=>1,'planned'=>2];
    usort($rows,static fn($a,$b)=>($rank[$a['level']]??9)<=>($rank[$b['level']]??9) ?: strcmp((string)($a['due_at']??''),(string)($b['due_at']??'')));
    return $rows;
}

function kareta_client_sync_service_notifications(PDO $pdo, int $uid, string $phone, array $reminders): void {
    if (!function_exists('kareta_table_exists') || !kareta_table_exists($pdo,'notifications')) return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS vehicle_reminder_dispatch(reminder_key VARCHAR(191) PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,last_sent_at DATETIME NOT NULL,INDEX idx_vrd_user(user_id,last_sent_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    foreach($reminders as $r){
        if(!in_array((string)($r['level']??''),['overdue','soon'],true)) continue;
        $key=$uid.':'.(string)($r['id']??'');
        $st=$pdo->prepare("SELECT last_sent_at FROM vehicle_reminder_dispatch WHERE reminder_key=? LIMIT 1"); $st->execute([$key]); $last=$st->fetchColumn();
        if($last && strtotime((string)$last)>time()-604800) continue;
        $title=($r['level']==='overdue'?'Просрочено: ':'Скоро: ').(string)$r['title'];
        $body=trim((string)($r['vehicle_title']??'Автомобиль')).'. ';
        if(!empty($r['due_at'])) $body.='Срок: '.(string)$r['due_at'].'. ';
        if(isset($r['km_left'])&&$r['km_left']!==null) $body.=($r['km_left']<0?'Перепробег ':'Осталось ').number_format(abs((int)$r['km_left']),0,'.',' ').' км.';
        if(function_exists('kareta_notification_insert')) kareta_notification_insert($pdo,['recipientUserId'=>$uid,'recipientPhone'=>$phone,'recipientRole'=>'client','eventType'=>'vehicle_service_due','entityType'=>'vehicle','entityId'=>(string)($r['vehicle_id']??''),'title'=>$title,'body'=>$body,'actionUrl'=>'#/cabinet/garage','meta'=>$r]);
        $pdo->prepare("INSERT INTO vehicle_reminder_dispatch(reminder_key,user_id,last_sent_at) VALUES(?,?,NOW()) ON DUPLICATE KEY UPDATE last_sent_at=VALUES(last_sent_at)")->execute([$key,$uid]);
    }
}

function kareta_client_cabinet_actor(PDO $pdo, string $capability='vehicles.read', bool $write=false): array {
    $auth = kareta_require_api_capability($pdo,$capability,['client','master','sto','admin','owner']);
    $actor = kareta_resolve_api_actor($pdo);
    $uid=(int)($actor['id']??0); $phone=(string)($actor['phone']??'');
    if($uid<=0 && $phone==='') kareta_json(['ok'=>false,'error'=>'unauthorized'],401);
    if($write && $capability==='vehicles.update' && !in_array((string)($actor['role']??''),['client','master','sto','admin','owner'],true)) kareta_json(['ok'=>false,'error'=>'vehicle_write_forbidden'],403);
    return [$uid,$phone,$actor,$auth];
}

function kareta_client_first_entry_scope(PDO $pdo, string $capability='vehicles.read', bool $write=false): array {
    [$uid,$phone,$actor]=kareta_client_cabinet_actor($pdo,$capability,$write);
    kareta_client_cabinet_ensure($pdo);
    $accountId=(int)($actor['accountId']??0);
    if($accountId<=0 && $phone!==''){
        try{$st=$pdo->prepare("SELECT id FROM accounts WHERE phone=? LIMIT 1");$st->execute([$phone]);$accountId=(int)($st->fetchColumn()?:0);}catch(Throwable $_){}
    }
    if($accountId<=0)kareta_json(['ok'=>false,'error'=>'identity_account_unavailable'],401);
    $contextId=(int)($actor['contextId']??0)?:null;
    return [$accountId,$uid,$phone,$contextId,$actor];
}

function kareta_client_first_entry_sanitize_draft(array $draft): array {
    $clean=static fn($v,$max)=>kareta_clean_text((string)$v,$max);
    $year=preg_replace('/\D+/','',(string)($draft['year']??''))?:'';
    if(strlen($year)>4)$year=substr($year,0,4);
    $mileage=preg_replace('/\D+/','',(string)($draft['mileage']??''))?:'';
    if(strlen($mileage)>7)$mileage=substr($mileage,0,7);
    $vin=strtoupper(preg_replace('/[^A-HJ-NPR-Z0-9]/i','',(string)($draft['vin']??''))?:'');
    $plate=strtoupper(trim(preg_replace('/\s+/u',' ',(string)($draft['plateNumber']??''))?:''));
    return [
      'step'=>max(1,min(4,(int)($draft['step']??2))),
      'brandId'=>$clean($draft['brandId']??'',80),'brandName'=>$clean($draft['brandName']??'',80),
      'modelId'=>$clean($draft['modelId']??'',80),'modelName'=>$clean($draft['modelName']??'',120),
      'customModelName'=>$clean($draft['customModelName']??'',120),'year'=>$year,
      'generation'=>$clean($draft['generation']??'',64),'vin'=>substr($vin,0,17),'plateNumber'=>mb_substr($plate,0,24),
      'engineVolume'=>$clean($draft['engineVolume']??'',32),'fuelType'=>$clean($draft['fuelType']??'',64),
      'mileage'=>$mileage,'isDefault'=>!empty($draft['isDefault']),
      'clientUpdatedAt'=>max(0,(int)($draft['updatedAt']??$draft['clientUpdatedAt']??0)),
    ];
}

function kareta_client_first_entry_has_vehicle(PDO $pdo,int $uid,string $phone): bool {
    if($uid<=0 && $phone==='')return false;
    if($phone!==''){
        $st=$pdo->prepare("SELECT COUNT(*) FROM client_vehicles WHERE (user_id=? OR user_phone=? OR client_id IN (SELECT id FROM clients WHERE user_phone=? OR phone=?))");
        $st->execute([$uid?:0,$phone,$phone,$phone]);
    }else{
        $st=$pdo->prepare("SELECT COUNT(*) FROM client_vehicles WHERE user_id=?");$st->execute([$uid]);
    }
    return (int)$st->fetchColumn()>0;
}

function kareta_client_first_entry_row(PDO $pdo,int $accountId,int $uid,?int $contextId,bool $lock=false): array {
    $pdo->prepare("INSERT IGNORE INTO client_first_entry_state(account_id,user_id,context_id) VALUES(?,?,?)")->execute([$accountId,$uid?:null,$contextId]);
    $sql="SELECT account_id,user_id,context_id,status,current_step,draft_json,revision,dismissed_at,completed_at,created_at,updated_at FROM client_first_entry_state WHERE account_id=?".($lock?' FOR UPDATE':'');
    $st=$pdo->prepare($sql);$st->execute([$accountId]);$row=$st->fetch(PDO::FETCH_ASSOC)?:[];
    return $row;
}

function kareta_client_first_entry_payload(array $row,bool $hasVehicle=false): array {
    $draft=json_decode((string)($row['draft_json']??''),true);if(!is_array($draft))$draft=[];
    return [
      'status'=>(string)($row['status']??'not_started'),'currentStep'=>max(1,min(4,(int)($row['current_step']??1))),
      'revision'=>(int)($row['revision']??0),'draft'=>$draft,'hasVehicles'=>$hasVehicle,
      'dismissedAt'=>$row['dismissed_at']??null,'completedAt'=>$row['completed_at']??null,'updatedAt'=>$row['updated_at']??null,
    ];
}

function kareta_client_first_entry_current(?PDO $pdo): void {
    if(!$pdo)_no_db();[$accountId,$uid,$phone,$contextId]=kareta_client_first_entry_scope($pdo,'vehicles.read',false);
    $hasVehicle=kareta_client_first_entry_has_vehicle($pdo,$uid,$phone);
    $row=kareta_client_first_entry_row($pdo,$accountId,$uid,$contextId,false);
    if($hasVehicle && (string)($row['status']??'')!=='completed'){
        $pdo->prepare("UPDATE client_first_entry_state SET user_id=?,context_id=?,status='completed',current_step=4,draft_json=NULL,revision=revision+1,completed_at=COALESCE(completed_at,NOW()) WHERE account_id=?")
            ->execute([$uid?:null,$contextId,$accountId]);
        $row=kareta_client_first_entry_row($pdo,$accountId,$uid,$contextId,false);
    }
    kareta_json(['ok'=>true,'data'=>kareta_client_first_entry_payload($row,$hasVehicle)]);
}

function kareta_client_first_entry_save_draft(?PDO $pdo,array $b): void {
    if(!$pdo)_no_db();[$accountId,$uid,$phone,$contextId]=kareta_client_first_entry_scope($pdo,'vehicles.update',true);
    $expected=max(0,(int)($b['expectedRevision']??0));$draft=kareta_client_first_entry_sanitize_draft(is_array($b['draft']??null)?$b['draft']:[]);
    $step=max(1,min(4,(int)($b['currentStep']??$draft['step']??2)));
    $pdo->beginTransaction();
    try{
        $row=kareta_client_first_entry_row($pdo,$accountId,$uid,$contextId,true);$revision=(int)($row['revision']??0);
        if((string)($row['status']??'')==='completed'){$pdo->commit();kareta_json(['ok'=>true,'data'=>kareta_client_first_entry_payload($row,true),'alreadyCompleted'=>true]);}
        if($expected!==$revision){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'revision_conflict','data'=>kareta_client_first_entry_payload($row,false)],409);}
        $encoded=json_encode($draft,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
        $pdo->prepare("UPDATE client_first_entry_state SET user_id=?,context_id=?,status='in_progress',current_step=?,draft_json=?,revision=revision+1,dismissed_at=NULL WHERE account_id=?")
            ->execute([$uid?:null,$contextId,$step,$encoded,$accountId]);
        $pdo->commit();$row=kareta_client_first_entry_row($pdo,$accountId,$uid,$contextId,false);
        kareta_json(['ok'=>true,'data'=>kareta_client_first_entry_payload($row,false)]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function kareta_client_first_entry_dismiss(?PDO $pdo,array $b): void {
    if(!$pdo)_no_db();[$accountId,$uid,$phone,$contextId]=kareta_client_first_entry_scope($pdo,'vehicles.update',true);
    $expected=array_key_exists('expectedRevision',$b)?max(0,(int)$b['expectedRevision']):null;
    $pdo->beginTransaction();
    try{
        $row=kareta_client_first_entry_row($pdo,$accountId,$uid,$contextId,true);$revision=(int)($row['revision']??0);
        if((string)($row['status']??'')==='completed'){$pdo->commit();kareta_json(['ok'=>true,'data'=>kareta_client_first_entry_payload($row,true),'alreadyCompleted'=>true]);}
        if($expected!==null && $expected!==$revision){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'revision_conflict','data'=>kareta_client_first_entry_payload($row,false)],409);}
        $pdo->prepare("UPDATE client_first_entry_state SET user_id=?,context_id=?,status='dismissed',current_step=1,draft_json=NULL,revision=revision+1,dismissed_at=NOW() WHERE account_id=?")
            ->execute([$uid?:null,$contextId,$accountId]);
        $pdo->commit();$row=kareta_client_first_entry_row($pdo,$accountId,$uid,$contextId,false);
        kareta_json(['ok'=>true,'data'=>kareta_client_first_entry_payload($row,false)]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function kareta_client_first_entry_mark_completed(PDO $pdo,?array $actor=null): void {
    try{
        $actor=is_array($actor)?$actor:kareta_resolve_api_actor($pdo);$accountId=(int)($actor['accountId']??0);$uid=(int)($actor['id']??0);$contextId=(int)($actor['contextId']??0)?:null;
        if($accountId<=0)return;kareta_client_cabinet_ensure($pdo);
        $pdo->prepare("INSERT INTO client_first_entry_state(account_id,user_id,context_id,status,current_step,draft_json,revision,completed_at) VALUES(?,?,?,'completed',4,NULL,1,NOW()) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),context_id=VALUES(context_id),status='completed',current_step=4,draft_json=NULL,revision=revision+1,completed_at=COALESCE(completed_at,NOW())")
            ->execute([$accountId,$uid?:null,$contextId]);
    }catch(Throwable $_){}
}

function kareta_client_cabinet_get(?PDO $pdo): void {
    if (!$pdo) _no_db();
    [$uid,$phone,$actor]=kareta_client_cabinet_actor($pdo,'vehicles.read');
    kareta_client_cabinet_ensure($pdo);
    $u = kareta_session_user() ?: ['id'=>$uid,'phone'=>$phone,'name'=>(string)($actor['name']??''),'role'=>(string)($actor['role']??'client')];
    if (function_exists('kareta_ensure_column')) {
      kareta_ensure_column($pdo, 'users', 'avatar_url', "ALTER TABLE `users` ADD COLUMN `avatar_url` MEDIUMTEXT NULL AFTER `initials`");
      kareta_ensure_column($pdo, 'users', 'bio', "ALTER TABLE `users` ADD COLUMN `bio` TEXT NULL AFTER `avatar_url`");
    }

    $st=$pdo->prepare("SELECT id,phone,name,role,city,email,car,initials,avatar_url AS avatarUrl,bio,created_at,updated_at FROM users WHERE (id=? AND ?>0) OR phone=? ORDER BY (id=?) DESC LIMIT 1");
    $st->execute([$uid,$uid,$phone,$uid]);
    $user=$st->fetch(PDO::FETCH_ASSOC) ?: $u;

    if (function_exists('kareta_ensure_column')) {
      kareta_ensure_column($pdo, 'client_vehicles', 'generation', "ALTER TABLE `client_vehicles` ADD COLUMN `generation` VARCHAR(64) NULL DEFAULT NULL AFTER `year_label`");
      kareta_ensure_column($pdo, 'client_vehicles', 'engine_type', "ALTER TABLE `client_vehicles` ADD COLUMN `engine_type` VARCHAR(64) NULL DEFAULT NULL AFTER `mileage_km`");
      kareta_ensure_column($pdo, 'client_vehicles', 'engine_volume', "ALTER TABLE `client_vehicles` ADD COLUMN `engine_volume` VARCHAR(32) NULL DEFAULT NULL AFTER `engine_type`");
      kareta_ensure_column($pdo, 'client_vehicles', 'fuel_type', "ALTER TABLE `client_vehicles` ADD COLUMN `fuel_type` VARCHAR(64) NULL DEFAULT NULL AFTER `engine_volume`");
    }
    $vehicleSelect="id,title,brand,model,year_label,generation,plate,vin,color,icon,note,mileage_km,engine_type,engine_volume,fuel_type,service_at,service_note,is_default,active,updated_at";
    $st=$pdo->prepare("SELECT {$vehicleSelect} FROM client_vehicles WHERE active=1 AND ((user_id=? AND ?>0) OR (?<>'' AND user_phone=?)) ORDER BY is_default DESC,updated_at DESC");
    $st->execute([$uid,$uid,$phone,$phone]);
    $vehicles=$st->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $st=$pdo->prepare("SELECT {$vehicleSelect} FROM client_vehicles WHERE active=0 AND ((user_id=? AND ?>0) OR (?<>'' AND user_phone=?)) ORDER BY updated_at DESC LIMIT 50");
    $st->execute([$uid,$uid,$phone,$phone]);
    $archivedVehicles=$st->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $st=$pdo->prepare("SELECT id,num,status,service_names,vehicle_title,client_car,price,date,time,created_at,completed_at,client_vehicle_id FROM orders WHERE client_user_id=? OR client_phone=? ORDER BY created_at DESC LIMIT 100");
    $st->execute([$uid,$phone]);
    $orders=$st->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $documents=[];
    if (function_exists('kareta_table_exists') && kareta_table_exists($pdo,'vehicle_documents')) {
      $vehicleIds=array_values(array_filter(array_map(static fn($v)=>(string)($v['id']??''),$vehicles)));
      if ($vehicleIds) {
        $marks=implode(',',array_fill(0,count($vehicleIds),'?'));
        $documentNumberSelect = kareta_column_exists($pdo,'vehicle_documents','document_number') ? 'document_number' : (kareta_column_exists($pdo,'vehicle_documents','number') ? '`number` AS document_number' : "'' AS document_number");
        $issuedAtSelect = kareta_column_exists($pdo,'vehicle_documents','issued_at') ? 'issued_at' : 'NULL AS issued_at';
        $expiresAtSelect = kareta_column_exists($pdo,'vehicle_documents','expires_at') ? 'expires_at' : 'NULL AS expires_at';
        $fileUrlSelect = kareta_column_exists($pdo,'vehicle_documents','file_url') ? 'file_url' : (kareta_column_exists($pdo,'vehicle_documents','file') ? '`file` AS file_url' : "'' AS file_url");
        $visibilitySelect = kareta_column_exists($pdo,'vehicle_documents','visibility') ? 'visibility' : "'private' AS visibility";
        $issuerSelect = kareta_column_exists($pdo,'vehicle_documents','issuer_name') ? 'issuer_name' : "'' AS issuer_name";
        $noteSelect = kareta_column_exists($pdo,'vehicle_documents','note') ? 'note' : "'' AS note";
        $reminderSelect = kareta_column_exists($pdo,'vehicle_documents','reminder_days') ? 'reminder_days' : '30 AS reminder_days';
        $hasDocumentStatus = kareta_column_exists($pdo,'vehicle_documents','status');
        $statusSelect = $hasDocumentStatus ? 'status' : "'active' AS status";
        $statusWhere = $hasDocumentStatus ? " AND (status='active' OR status IS NULL)" : '';
        $sd=$pdo->prepare("SELECT id,vehicle_id,document_type,title,$documentNumberSelect,$issuedAtSelect,$expiresAtSelect,$fileUrlSelect,$visibilitySelect,$issuerSelect,$noteSelect,$reminderSelect,$statusSelect,created_at FROM vehicle_documents WHERE vehicle_id IN ($marks)$statusWhere ORDER BY expires_at IS NULL,expires_at,created_at DESC");
        $sd->execute($vehicleIds);
        $documents=$sd->fetchAll(PDO::FETCH_ASSOC) ?: [];
      }
    }
    $maintenance=[]; $expenses=[]; $warranties=[];
    $vehicleIds=array_values(array_filter(array_map(static fn($v)=>(string)($v['id']??''),$vehicles)));
    if ($vehicleIds) {
      $marks=implode(',',array_fill(0,count($vehicleIds),'?'));
      $sm=$pdo->prepare("SELECT * FROM vehicle_maintenance_items WHERE vehicle_id IN ($marks) AND status<>'deleted' ORDER BY next_due_at IS NULL,next_due_at,next_due_mileage_km IS NULL,next_due_mileage_km"); $sm->execute($vehicleIds); $maintenance=$sm->fetchAll(PDO::FETCH_ASSOC)?:[];
      $se=$pdo->prepare("SELECT * FROM vehicle_expenses WHERE vehicle_id IN ($marks) ORDER BY expense_date DESC,created_at DESC LIMIT 300"); $se->execute($vehicleIds); $expenses=$se->fetchAll(PDO::FETCH_ASSOC)?:[];
      $sw=$pdo->prepare("SELECT * FROM vehicle_warranties WHERE vehicle_id IN ($marks) AND status<>'deleted' ORDER BY expires_at IS NULL,expires_at"); $sw->execute($vehicleIds); $warranties=$sw->fetchAll(PDO::FETCH_ASSOC)?:[];
    }

    $orderCountByVehicle=[]; $spentByVehicle=[];
    foreach($orders as $order){$vid=(string)($order['client_vehicle_id']??''); if($vid==='')continue; $orderCountByVehicle[$vid]=($orderCountByVehicle[$vid]??0)+1; $spentByVehicle[$vid]=($spentByVehicle[$vid]??0)+(int)($order['price']??0);}
    $docCountByVehicle=[]; foreach($documents as $doc){$vid=(string)($doc['vehicle_id']??''); $docCountByVehicle[$vid]=($docCountByVehicle[$vid]??0)+1;}
    $maintenanceCountByVehicle=[]; foreach($maintenance as $item){$vid=(string)($item['vehicle_id']??''); $maintenanceCountByVehicle[$vid]=($maintenanceCountByVehicle[$vid]??0)+1;}
    $warrantyCountByVehicle=[]; foreach($warranties as $item){$vid=(string)($item['vehicle_id']??''); if(($item['status']??'active')==='active') $warrantyCountByVehicle[$vid]=($warrantyCountByVehicle[$vid]??0)+1;}
    $expenseByVehicle=[]; foreach($expenses as $item){$vid=(string)($item['vehicle_id']??''); $expenseByVehicle[$vid]=($expenseByVehicle[$vid]??0)+(float)($item['amount']??0);}
    foreach($vehicles as &$vehicle){$vid=(string)($vehicle['id']??''); $vehicle['repair_count']=$orderCountByVehicle[$vid]??0; $vehicle['spent_total']=($spentByVehicle[$vid]??0)+($expenseByVehicle[$vid]??0); $vehicle['document_count']=$docCountByVehicle[$vid]??0; $vehicle['maintenance_count']=$maintenanceCountByVehicle[$vid]??0; $vehicle['warranty_count']=$warrantyCountByVehicle[$vid]??0;} unset($vehicle);

    $pdo->prepare("INSERT IGNORE INTO client_preferences(user_id) VALUES(?)")->execute([$uid]);
    $st=$pdo->prepare("SELECT notify_orders,notify_promotions,notify_service,compact_mobile,more_menu_layout,updated_at FROM client_preferences WHERE user_id=? LIMIT 1");
    $st->execute([$uid]);
    $preferences=$st->fetch(PDO::FETCH_ASSOC) ?: [];

    $st=$pdo->prepare("SELECT id,title,description,badge,action_label,action_url,starts_at,ends_at FROM client_promotions WHERE active=1 AND role_scope IN ('client','all') AND (starts_at IS NULL OR starts_at<=NOW()) AND (ends_at IS NULL OR ends_at>=NOW()) ORDER BY sort ASC,created_at DESC");
    $st->execute();
    $promotions=$st->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $reminders=kareta_client_vehicle_reminders($vehicles,$maintenance,$warranties,$documents);
    if ((int)($preferences['notify_service'] ?? 1) !== 0) kareta_client_sync_service_notifications($pdo,$uid,$phone,$reminders);

    $metrics=[
      'vehicles'=>count($vehicles),
      'orders'=>count($orders),
      'activeOrders'=>count(array_filter($orders, static fn($r)=>!in_array((string)($r['status']??''),['done','completed','cancelled'],true))),
      'completedOrders'=>count(array_filter($orders, static fn($r)=>in_array((string)($r['status']??''),['done','completed'],true))),
      'spent'=>array_sum(array_map(static fn($r)=>(int)($r['price']??0),$orders)),
      'promotions'=>count($promotions),
      'serviceReminders'=>count(array_filter($reminders,static fn($r)=>in_array((string)($r['level']??''),['overdue','soon'],true))),
      'reviews'=>0,
      'favorites'=>0,
    ];
    $firstEntry=null;
    try{
      $accountId=(int)($actor['accountId']??0);$contextId=(int)($actor['contextId']??0)?:null;
      if($accountId>0){
        $row=kareta_client_first_entry_row($pdo,$accountId,$uid,$contextId,false);
        $hasVehicle=(bool)(count($vehicles)+count($archivedVehicles));
        if($hasVehicle && (string)($row['status']??'')!=='completed'){
          kareta_client_first_entry_mark_completed($pdo,$actor);
          $row=kareta_client_first_entry_row($pdo,$accountId,$uid,$contextId,false);
        }
        $firstEntry=kareta_client_first_entry_payload($row,$hasVehicle);
      }
    }catch(Throwable $_){}
    kareta_json(['ok'=>true,'data'=>compact('user','vehicles','archivedVehicles','orders','documents','maintenance','expenses','warranties','reminders','preferences','promotions','metrics','firstEntry')]);
}

function kareta_client_preferences_save(?PDO $pdo,array $b): void {
    if(!$pdo) _no_db();
    [$uid,$phone,$actor]=kareta_client_cabinet_actor($pdo,'vehicles.read');
    kareta_client_cabinet_ensure($pdo);
    $vals=[]; foreach(['notify_orders','notify_promotions','notify_service','compact_mobile'] as $k){$vals[$k]=!empty($b[$k])?1:0;}
    $layout=in_array((string)($b['more_menu_layout']??'arc'),['grid','arc','hex'],true)?(string)$b['more_menu_layout']:'arc';
    $vals['more_menu_layout']=$layout;
    $pdo->prepare("INSERT INTO client_preferences(user_id,notify_orders,notify_promotions,notify_service,compact_mobile,more_menu_layout) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE notify_orders=VALUES(notify_orders),notify_promotions=VALUES(notify_promotions),notify_service=VALUES(notify_service),compact_mobile=VALUES(compact_mobile),more_menu_layout=VALUES(more_menu_layout)")
      ->execute([$uid,$vals['notify_orders'],$vals['notify_promotions'],$vals['notify_service'],$vals['compact_mobile'],$layout]);
    kareta_json(['ok'=>true,'preferences'=>$vals]);
}


function kareta_client_vehicle_owned(PDO $pdo,string $vehicleId,int $uid,string $phone): bool {
    $st=$pdo->prepare("SELECT COUNT(*) FROM client_vehicles WHERE id=? AND active=1 AND ((user_id=? AND ?>0) OR (?<>'' AND user_phone=?))");
    $st->execute([$vehicleId,$uid,$uid,$phone,$phone]);
    return (int)$st->fetchColumn()>0;
}
function kareta_client_vehicle_context(PDO $pdo): array {
    [$uid,$phone]=kareta_client_cabinet_actor($pdo,'vehicles.update',true); kareta_client_cabinet_ensure($pdo);
    return [$uid,$phone];
}
function kareta_client_child_record_scope(PDO $pdo,string $table,string $id,string $vehicleId): void {
    if($id===''||!in_array($table,['vehicle_maintenance_items','vehicle_warranties'],true))return;
    $st=$pdo->prepare("SELECT vehicle_id FROM `{$table}` WHERE id=? LIMIT 1");$st->execute([$id]);$stored=$st->fetchColumn();
    if($stored!==false&&!hash_equals($vehicleId,(string)$stored))kareta_json(['ok'=>false,'error'=>'record_forbidden'],403);
}
function kareta_client_maintenance_save(?PDO $pdo,array $b): void {
    if(!$pdo) _no_db(); [$uid,$phone]=kareta_client_vehicle_context($pdo);
    $vehicleId=trim((string)($b['vehicleId']??'')); if($vehicleId===''||!kareta_client_vehicle_owned($pdo,$vehicleId,$uid,$phone)) kareta_json(['ok'=>false,'error'=>'vehicle_forbidden'],403);
    $title=kareta_clean_text($b['title']??'',191); if($title==='') kareta_json(['ok'=>false,'error'=>'title_required'],422);
    $types=['oil','filter','spark_plugs','belt','coolant','brake_fluid','tires','battery','other']; $type=in_array(($b['itemType']??''),$types,true)?$b['itemType']:'other';
    $id=trim((string)($b['id']??''))?:'vmi_'.bin2hex(random_bytes(8));
    kareta_client_child_record_scope($pdo,'vehicle_maintenance_items',$id,$vehicleId);
    $date=static fn($v)=>preg_match('~^\d{4}-\d{2}-\d{2}$~',(string)$v)?(string)$v:null;
    $pdo->prepare("INSERT INTO vehicle_maintenance_items(id,vehicle_id,item_type,title,brand,model,installed_at,installed_mileage_km,next_due_at,next_due_mileage_km,warranty_until,note,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE item_type=VALUES(item_type),title=VALUES(title),brand=VALUES(brand),model=VALUES(model),installed_at=VALUES(installed_at),installed_mileage_km=VALUES(installed_mileage_km),next_due_at=VALUES(next_due_at),next_due_mileage_km=VALUES(next_due_mileage_km),warranty_until=VALUES(warranty_until),note=VALUES(note),status=VALUES(status)")
      ->execute([$id,$vehicleId,$type,$title,kareta_clean_text($b['brand']??'',120),kareta_clean_text($b['model']??'',120),$date($b['installedAt']??''),(int)($b['installedMileageKm']??0)?:null,$date($b['nextDueAt']??''),(int)($b['nextDueMileageKm']??0)?:null,$date($b['warrantyUntil']??''),kareta_clean_text($b['note']??'',500),'active']);
    kareta_json(['ok'=>true,'id'=>$id]);
}
function kareta_client_expense_save(?PDO $pdo,array $b): void {
    if(!$pdo) _no_db(); [$uid,$phone]=kareta_client_vehicle_context($pdo);
    $vehicleId=trim((string)($b['vehicleId']??'')); if($vehicleId===''||!kareta_client_vehicle_owned($pdo,$vehicleId,$uid,$phone)) kareta_json(['ok'=>false,'error'=>'vehicle_forbidden'],403);
    $title=kareta_clean_text($b['title']??'',191); $amount=max(0,(float)($b['amount']??0)); if($title===''||$amount<=0) kareta_json(['ok'=>false,'error'=>'expense_invalid'],422);
    $date=preg_match('~^\d{4}-\d{2}-\d{2}$~',(string)($b['expenseDate']??''))?(string)$b['expenseDate']:date('Y-m-d');
    $id='vex_'.bin2hex(random_bytes(8));
    $pdo->prepare("INSERT INTO vehicle_expenses(id,vehicle_id,expense_type,title,amount,expense_date,note) VALUES(?,?,?,?,?,?,?)")->execute([$id,$vehicleId,kareta_clean_text($b['expenseType']??'other',32),$title,$amount,$date,kareta_clean_text($b['note']??'',500)]);
    kareta_json(['ok'=>true,'id'=>$id]);
}
function kareta_client_warranty_save(?PDO $pdo,array $b): void {
    if(!$pdo) _no_db(); [$uid,$phone]=kareta_client_vehicle_context($pdo);
    $vehicleId=trim((string)($b['vehicleId']??'')); if($vehicleId===''||!kareta_client_vehicle_owned($pdo,$vehicleId,$uid,$phone)) kareta_json(['ok'=>false,'error'=>'vehicle_forbidden'],403);
    $title=kareta_clean_text($b['title']??'',191); if($title==='') kareta_json(['ok'=>false,'error'=>'title_required'],422);
    $date=static fn($v)=>preg_match('~^\d{4}-\d{2}-\d{2}$~',(string)$v)?(string)$v:null;
    $id=trim((string)($b['id']??''))?:'vwr_'.bin2hex(random_bytes(8));
    kareta_client_child_record_scope($pdo,'vehicle_warranties',$id,$vehicleId);
    $pdo->prepare("INSERT INTO vehicle_warranties(id,vehicle_id,title,provider_name,starts_at,expires_at,mileage_limit_km,status,note) VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),provider_name=VALUES(provider_name),starts_at=VALUES(starts_at),expires_at=VALUES(expires_at),mileage_limit_km=VALUES(mileage_limit_km),status=VALUES(status),note=VALUES(note)")
      ->execute([$id,$vehicleId,$title,kareta_clean_text($b['providerName']??'',191),$date($b['startsAt']??''),$date($b['expiresAt']??''),(int)($b['mileageLimitKm']??0)?:null,'active',kareta_clean_text($b['note']??'',500)]);
    kareta_json(['ok'=>true,'id'=>$id]);
}


function kareta_client_document_save(?PDO $pdo,array $b): void {
    if(!$pdo) _no_db(); [$uid,$phone]=kareta_client_vehicle_context($pdo);
    $vehicleId=trim((string)($b['vehicleId']??''));
    if($vehicleId===''||!kareta_client_vehicle_owned($pdo,$vehicleId,$uid,$phone)) kareta_json(['ok'=>false,'error'=>'vehicle_forbidden'],403);
    $title=kareta_clean_text($b['title']??'',191); if($title==='') kareta_json(['ok'=>false,'error'=>'title_required'],422);
    $types=['insurance','inspection','registration','power_of_attorney','service','warranty','other'];
    $type=in_array((string)($b['documentType']??''),$types,true)?(string)$b['documentType']:'other';
    $date=static fn($v)=>preg_match('~^\d{4}-\d{2}-\d{2}$~',(string)$v)?(string)$v:null;
    $id=trim((string)($b['id']??''))?:'vdoc_'.bin2hex(random_bytes(8));
    if($id!=='' && isset($b['id'])){
      $st=$pdo->prepare("SELECT COUNT(*) FROM vehicle_documents vd JOIN client_vehicles cv ON cv.id=vd.vehicle_id WHERE vd.id=? AND cv.active=1 AND ((cv.user_id=? AND ?>0) OR (?<>'' AND cv.user_phone=?))");
      $st->execute([$id,$uid,$uid,$phone,$phone]); if((int)$st->fetchColumn()===0) kareta_json(['ok'=>false,'error'=>'document_forbidden'],403);
    }
    $pdo->prepare("INSERT INTO vehicle_documents(id,vehicle_id,document_type,title,document_number,issued_at,expires_at,file_url,visibility,issuer_name,note,reminder_days,status,created_by_user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE vehicle_id=VALUES(vehicle_id),document_type=VALUES(document_type),title=VALUES(title),document_number=VALUES(document_number),issued_at=VALUES(issued_at),expires_at=VALUES(expires_at),file_url=VALUES(file_url),visibility=VALUES(visibility),issuer_name=VALUES(issuer_name),note=VALUES(note),reminder_days=VALUES(reminder_days),status='active'")
      ->execute([$id,$vehicleId,$type,$title,kareta_clean_text($b['documentNumber']??'',120),$date($b['issuedAt']??''),$date($b['expiresAt']??''),trim((string)($b['fileUrl']??'')),in_array((string)($b['visibility']??''),['owner','service','public'],true)?(string)$b['visibility']:'owner',kareta_clean_text($b['issuerName']??'',191),kareta_clean_text($b['note']??'',500),max(1,min(365,(int)($b['reminderDays']??30))),$uid]);
    kareta_json(['ok'=>true,'id'=>$id]);
}
function kareta_client_document_delete(?PDO $pdo,array $b): void {
    if(!$pdo) _no_db(); [$uid,$phone]=kareta_client_vehicle_context($pdo);
    $id=trim((string)($b['id']??'')); if($id==='') kareta_json(['ok'=>false,'error'=>'id_required'],422);
    $st=$pdo->prepare("UPDATE vehicle_documents vd JOIN client_vehicles cv ON cv.id=vd.vehicle_id SET vd.status='deleted' WHERE vd.id=? AND cv.active=1 AND ((cv.user_id=? AND ?>0) OR (?<>'' AND cv.user_phone=?))");
    $st->execute([$id,$uid,$uid,$phone,$phone]); if($st->rowCount()===0) kareta_json(['ok'=>false,'error'=>'document_not_found'],404);
    kareta_json(['ok'=>true]);
}
