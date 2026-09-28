<?php
declare(strict_types=1);

function kareta_master_social_ensure(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `master_social_relations` (
      `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      `user_id` BIGINT UNSIGNED NOT NULL,
      `master_id` VARCHAR(64) NOT NULL,
      `is_following` TINYINT(1) NOT NULL DEFAULT 0,
      `is_liked` TINYINT(1) NOT NULL DEFAULT 0,
      `follow_news` TINYINT(1) NOT NULL DEFAULT 1,
      `follow_works` TINYINT(1) NOT NULL DEFAULT 1,
      `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY `uq_master_social_user_master` (`user_id`,`master_id`),
      KEY `idx_master_social_master_follow` (`master_id`,`is_following`),
      KEY `idx_master_social_master_like` (`master_id`,`is_liked`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function kareta_master_social_actor_id(): int {
    $user = kareta_session_user() ?: [];
    return (int)($user['id'] ?? 0);
}

function kareta_master_social_states(PDO $pdo, array $masterIds): array {
    $userId = kareta_master_social_actor_id();
    if ($userId <= 0 || !$masterIds) return [];
    kareta_master_social_ensure($pdo);
    $ids = array_values(array_unique(array_filter(array_map('strval',$masterIds))));
    if (!$ids) return [];
    $marks = implode(',', array_fill(0,count($ids),'?'));
    $st = $pdo->prepare("SELECT master_id,is_following,is_liked,follow_news,follow_works FROM master_social_relations WHERE user_id=? AND master_id IN ($marks)");
    $st->execute(array_merge([$userId],$ids));
    $out=[];
    foreach($st->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row){
        $out[(string)$row['master_id']] = [
            'following'=>(bool)$row['is_following'],
            'liked'=>(bool)$row['is_liked'],
            'followNews'=>(bool)$row['follow_news'],
            'followWorks'=>(bool)$row['follow_works'],
        ];
    }
    return $out;
}

function kareta_master_social_counts(PDO $pdo, array $masterIds): array {
    if (!$masterIds) return [];
    kareta_master_social_ensure($pdo);
    $ids = array_values(array_unique(array_filter(array_map('strval',$masterIds))));
    if (!$ids) return [];
    $marks = implode(',', array_fill(0,count($ids),'?'));
    $st = $pdo->prepare("SELECT master_id,SUM(is_following=1) followers,SUM(is_liked=1) likes FROM master_social_relations WHERE master_id IN ($marks) GROUP BY master_id");
    $st->execute($ids);
    $out=[];
    foreach($st->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row){
        $out[(string)$row['master_id']] = ['followers'=>(int)$row['followers'],'likes'=>(int)$row['likes']];
    }
    return $out;
}

function kareta_master_social_update(PDO $pdo, array $body): void {
    $userId = kareta_master_social_actor_id();
    if ($userId <= 0) kareta_json(['ok'=>false,'error'=>'auth_required','message'=>'Войдите в аккаунт.'],401);
    $masterId = trim((string)($body['masterId'] ?? $body['master_id'] ?? ''));
    if ($masterId==='') kareta_json(['ok'=>false,'error'=>'master_required','message'=>'Мастер не указан.'],422);
    $field = (string)($body['field'] ?? 'following');
    $allowed = ['following'=>'is_following','liked'=>'is_liked','followNews'=>'follow_news','followWorks'=>'follow_works'];
    if (!isset($allowed[$field])) kareta_json(['ok'=>false,'error'=>'invalid_field'],422);
    $value = !empty($body['value']) ? 1 : 0;
    kareta_master_social_ensure($pdo);
    $pdo->prepare("INSERT INTO master_social_relations(user_id,master_id,{$allowed[$field]}) VALUES(?,?,?) ON DUPLICATE KEY UPDATE {$allowed[$field]}=VALUES({$allowed[$field]}),updated_at=CURRENT_TIMESTAMP")
        ->execute([$userId,$masterId,$value]);
    $states=kareta_master_social_states($pdo,[$masterId]);
    $counts=kareta_master_social_counts($pdo,[$masterId]);
    kareta_json(['ok'=>true,'state'=>$states[$masterId]??[],'counts'=>$counts[$masterId]??['followers'=>0,'likes'=>0]]);
}


function kareta_sto_social_ensure(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `sto_social_relations` (
      `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      `user_id` BIGINT UNSIGNED NOT NULL,
      `sto_id` VARCHAR(64) NOT NULL,
      `is_following` TINYINT(1) NOT NULL DEFAULT 0,
      `follow_news` TINYINT(1) NOT NULL DEFAULT 1,
      `follow_works` TINYINT(1) NOT NULL DEFAULT 1,
      `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY `uq_sto_social_user_sto` (`user_id`,`sto_id`),
      KEY `idx_sto_social_follow` (`sto_id`,`is_following`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function kareta_sto_social_states(PDO $pdo, array $stoIds): array {
    $userId = kareta_master_social_actor_id();
    if ($userId <= 0 || !$stoIds) return [];
    kareta_sto_social_ensure($pdo);
    $ids = array_values(array_unique(array_filter(array_map('strval',$stoIds))));
    if (!$ids) return [];
    $marks = implode(',', array_fill(0,count($ids),'?'));
    $st = $pdo->prepare("SELECT sto_id,is_following,follow_news,follow_works FROM sto_social_relations WHERE user_id=? AND sto_id IN ($marks)");
    $st->execute(array_merge([$userId],$ids));
    $out=[];
    foreach($st->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row){
        $out[(string)$row['sto_id']] = [
            'following'=>(bool)$row['is_following'],
            'followNews'=>(bool)$row['follow_news'],
            'followWorks'=>(bool)$row['follow_works'],
        ];
    }
    return $out;
}


function kareta_sto_social_counts(PDO $pdo, array $stoIds): array {
    if (!$stoIds) return [];
    kareta_sto_social_ensure($pdo);
    $ids = array_values(array_unique(array_filter(array_map('strval', $stoIds))));
    if (!$ids) return [];
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $st = $pdo->prepare("SELECT sto_id,SUM(is_following=1) followers FROM sto_social_relations WHERE sto_id IN ($marks) GROUP BY sto_id");
    $st->execute($ids);
    $out = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $out[(string)$row['sto_id']] = ['followers'=>(int)$row['followers']];
    }
    return $out;
}

function kareta_sto_social_update(PDO $pdo, array $body): void {
    $userId = kareta_master_social_actor_id();
    if ($userId <= 0) kareta_json(['ok'=>false,'error'=>'auth_required','message'=>'Войдите в аккаунт.'],401);
    $stoId = trim((string)($body['stoId'] ?? $body['sto_id'] ?? ''));
    if ($stoId==='') kareta_json(['ok'=>false,'error'=>'sto_required','message'=>'СТО не указано.'],422);
    $field = (string)($body['field'] ?? 'following');
    $allowed = ['following'=>'is_following','followNews'=>'follow_news','followWorks'=>'follow_works'];
    if (!isset($allowed[$field])) kareta_json(['ok'=>false,'error'=>'invalid_field'],422);
    $value = !empty($body['value']) ? 1 : 0;
    kareta_sto_social_ensure($pdo);
    $pdo->prepare("INSERT INTO sto_social_relations(user_id,sto_id,{$allowed[$field]}) VALUES(?,?,?) ON DUPLICATE KEY UPDATE {$allowed[$field]}=VALUES({$allowed[$field]}),updated_at=CURRENT_TIMESTAMP")
        ->execute([$userId,$stoId,$value]);
    $states=kareta_sto_social_states($pdo,[$stoId]);
    kareta_json(['ok'=>true,'state'=>$states[$stoId]??[]]);
}

function kareta_master_social_following(PDO $pdo): void {
    $userId = kareta_master_social_actor_id();
    if ($userId <= 0) kareta_json(['ok'=>false,'error'=>'auth_required','message'=>'Войдите в аккаунт.'],401);

    kareta_master_social_ensure($pdo);
    kareta_sto_social_ensure($pdo);

    $payload = function_exists('kareta_masters_catalog_payload')
        ? kareta_masters_catalog_payload($pdo)
        : ['masters'=>[], 'stations'=>[]];

    $masterRows = array_values($payload['masters'] ?? []);
    $stationRows = array_values($payload['stos'] ?? $payload['stations'] ?? []);
    $masterIds = array_values(array_filter(array_map(static fn(array $row): string => (string)($row['id'] ?? ''), $masterRows)));
    $stationIds = array_values(array_filter(array_map(static fn(array $row): string => (string)($row['id'] ?? ''), $stationRows)));

    $masterStates = kareta_master_social_states($pdo, $masterIds);
    $masterCounts = kareta_master_social_counts($pdo, $masterIds);
    $stationStates = kareta_sto_social_states($pdo, $stationIds);
    $stationCounts = kareta_sto_social_counts($pdo, $stationIds);

    $items = [];
    foreach ($masterRows as $row) {
        $id = (string)($row['id'] ?? '');
        $social = $masterStates[$id] ?? ['following'=>false,'liked'=>false,'followNews'=>true,'followWorks'=>true];
        if (empty($social['following'])) continue;
        $row['type'] = 'master';
        $row['social_state'] = $social;
        $row['followers_count'] = (int)($masterCounts[$id]['followers'] ?? 0);
        $items[] = $row;
    }
    foreach ($stationRows as $row) {
        $id = (string)($row['id'] ?? '');
        $social = $stationStates[$id] ?? ['following'=>false,'followNews'=>true,'followWorks'=>true];
        if (empty($social['following'])) continue;
        $row['type'] = 'sto';
        $row['social_state'] = $social;
        $row['followers_count'] = (int)($stationCounts[$id]['followers'] ?? 0);
        $items[] = $row;
    }

    usort($items, static function(array $a, array $b): int {
        return strnatcasecmp((string)($a['name'] ?? ''), (string)($b['name'] ?? ''));
    });

    kareta_json([
        'ok'=>true,
        'items'=>$items,
        'total'=>count($items),
        'masters_total'=>count(array_filter($items, static fn(array $row): bool => ($row['type'] ?? '') === 'master')),
        'stations_total'=>count(array_filter($items, static fn(array $row): bool => ($row['type'] ?? '') === 'sto')),
    ]);
}

