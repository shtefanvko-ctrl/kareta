<?php
declare(strict_types=1);

function kareta_community_groups_ensure(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS community_groups (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      group_type VARCHAR(32) NOT NULL DEFAULT 'INTEREST',
      name VARCHAR(191) NOT NULL,
      short_label VARCHAR(12) NOT NULL DEFAULT '',
      city VARCHAR(160) NOT NULL DEFAULT '',
      vehicle VARCHAR(191) NOT NULL DEFAULT '',
      description TEXT NULL,
      rules_json JSON NULL,
      members_count INT UNSIGNED NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_community_groups_active (active,sort_order,name),
      KEY idx_community_groups_type (group_type,active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS community_group_members (
      group_id VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      member_role VARCHAR(24) NOT NULL DEFAULT 'member',
      active TINYINT(1) NOT NULL DEFAULT 1,
      joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(group_id,user_id),
      KEY idx_community_group_members_user (user_id,active),
      KEY idx_community_group_members_group (group_id,active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function kareta_community_groups_list(?PDO $pdo, array $input=[]): void {
    if (!$pdo) kareta_json(['ok'=>true,'data'=>['items'=>[],'source'=>'database-unavailable']]);
    kareta_community_groups_ensure($pdo);
    $limit=max(1,min(100,(int)($input['limit']??50)));
    $viewerUserId=0;
    try{if(function_exists('kareta_master_wall_actor')){$viewer=kareta_master_wall_actor($pdo,false);$viewerUserId=(int)($viewer['userId']??0);}}catch(Throwable $_){}
    $rows=$pdo->query("SELECT g.*,
      (SELECT COUNT(*) FROM community_group_members gm WHERE gm.group_id=g.id AND gm.active=1) AS linked_members
      FROM community_groups g WHERE g.active=1
      ORDER BY g.sort_order ASC,g.name ASC LIMIT {$limit}")->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $items=[];
    foreach($rows as $row){
        $rules=json_decode((string)($row['rules_json']??'[]'),true);
        if(!is_array($rules))$rules=[];
        $items[]=[
          'id'=>(string)$row['id'],
          'type'=>(string)$row['group_type'],
          'name'=>(string)$row['name'],
          'short'=>(string)$row['short_label'],
          'members'=>max((int)($row['members_count']??0),(int)($row['linked_members']??0)),
          'linkedMembers'=>(int)($row['linked_members']??0),
          'city'=>(string)($row['city']??''),
          'vehicle'=>(string)($row['vehicle']??''),
          'description'=>(string)($row['description']??''),
          'rules'=>$rules,
          'joined'=>$viewerUserId>0 ? (bool)(function() use($pdo,$row,$viewerUserId){$q=$pdo->prepare("SELECT 1 FROM community_group_members WHERE group_id=? AND user_id=? AND active=1 LIMIT 1");$q->execute([(string)$row['id'],$viewerUserId]);return $q->fetchColumn();})() : false,
        ];
    }
    kareta_json(['ok'=>true,'data'=>['items'=>$items,'source'=>'community_groups']]);
}

function kareta_community_group_members(PDO $pdo,array $input): void {
    kareta_community_groups_ensure($pdo);
    $groupId=trim((string)($input['groupId']??$input['group_id']??''));
    if($groupId===''||!preg_match('/^[A-Za-z0-9_.:-]{1,64}$/',$groupId))kareta_json(['ok'=>false,'error'=>'invalid_group'],422);
    $q=$pdo->prepare("SELECT gm.user_id AS userId,gm.member_role AS memberRole,gm.joined_at AS joinedAt,
      COALESCE(NULLIF(u.name,''),'Участник') AS name,COALESCE(NULLIF(u.role,''),'client') AS role,
      COALESCE(NULLIF(u.initials,''),'К') AS initials,COALESCE(u.car,'') AS car
      FROM community_group_members gm
      LEFT JOIN users u ON u.id=gm.user_id
      WHERE gm.group_id=? AND gm.active=1
      ORDER BY CASE gm.member_role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END,gm.joined_at ASC
      LIMIT 100");
    $q->execute([$groupId]);
    kareta_json(['ok'=>true,'data'=>['items'=>$q->fetchAll(PDO::FETCH_ASSOC)?:[],'groupId'=>$groupId]]);
}

function kareta_community_group_membership_save(PDO $pdo, array $body): void {
    kareta_community_groups_ensure($pdo);
    $actor=kareta_require_api_session($pdo,['client','master','sto','seller','admin','owner']);
    $userId=(int)($actor['id']??$actor['userId']??0);
    if($userId<=0)kareta_json(['ok'=>false,'error'=>'auth_required'],401);
    $groupId=trim((string)($body['groupId']??$body['group_id']??''));
    if($groupId===''||!preg_match('/^[A-Za-z0-9_.:-]{1,64}$/',$groupId))kareta_json(['ok'=>false,'error'=>'invalid_group'],422);
    $q=$pdo->prepare("SELECT id FROM community_groups WHERE id=? AND active=1 LIMIT 1");$q->execute([$groupId]);
    if(!$q->fetchColumn())kareta_json(['ok'=>false,'error'=>'group_not_found'],404);
    $value=!array_key_exists('value',$body)||!empty($body['value']);
    $pdo->prepare("INSERT INTO community_group_members(group_id,user_id,member_role,active) VALUES(?,?,'member',?) ON DUPLICATE KEY UPDATE active=VALUES(active),member_role='member'")->execute([$groupId,$userId,$value?1:0]);
    $q=$pdo->prepare("SELECT GREATEST(g.members_count,(SELECT COUNT(*) FROM community_group_members gm WHERE gm.group_id=g.id AND gm.active=1)) FROM community_groups g WHERE g.id=? LIMIT 1");$q->execute([$groupId]);
    kareta_json(['ok'=>true,'data'=>['groupId'=>$groupId,'joined'=>$value,'members'=>(int)$q->fetchColumn()]]);
}

function kareta_community_posts_ensure(PDO $pdo): void {
    if (function_exists('kareta_master_wall_social_ensure')) {
        kareta_master_wall_social_ensure($pdo);
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS community_posts (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      author_account_id BIGINT UNSIGNED NULL,
      author_person_id BIGINT UNSIGNED NULL,
      author_user_id BIGINT UNSIGNED NULL,
      author_context_id BIGINT UNSIGNED NULL,
      author_entity_id VARCHAR(64) NULL,
      author_role VARCHAR(32) NOT NULL DEFAULT 'client',
      author_name VARCHAR(160) NOT NULL DEFAULT '',
      post_type VARCHAR(24) NOT NULL DEFAULT 'POST',
      group_id VARCHAR(64) NOT NULL DEFAULT '',
      title VARCHAR(255) NULL,
      text MEDIUMTEXT NOT NULL,
      category VARCHAR(64) NOT NULL DEFAULT '',
      city VARCHAR(160) NOT NULL DEFAULT '',
      vehicle_label VARCHAR(191) NOT NULL DEFAULT '',
      comments_enabled TINYINT(1) NOT NULL DEFAULT 1,
      visibility VARCHAR(24) NOT NULL DEFAULT 'public',
      active TINYINT(1) NOT NULL DEFAULT 1,
      published_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_community_posts_public (active,visibility,published_at),
      KEY idx_community_posts_type (post_type,published_at),
      KEY idx_community_posts_author (author_account_id,author_context_id,published_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    try { $pdo->exec("ALTER TABLE community_posts ADD COLUMN group_id VARCHAR(64) NOT NULL DEFAULT '' AFTER post_type"); } catch (Throwable $_) {}
    try { $pdo->exec("ALTER TABLE community_posts ADD INDEX idx_community_posts_group (group_id,active,published_at)"); } catch (Throwable $_) {}
}

function kareta_community_actor(PDO $pdo): array {
    $actor = kareta_require_api_session($pdo, ['client','master','sto','seller','admin','owner']);
    $context = is_array($actor['context'] ?? null) ? $actor['context'] : [];
    $role = strtolower(trim((string)($actor['role'] ?? 'client')));
    $name = trim((string)($actor['name'] ?? ''));
    $entityId = '';
    if ($role === 'master' && function_exists('kareta_master_workplace_profile')) {
        try {
            $master = kareta_master_workplace_profile($pdo);
            $entityId = trim((string)($master['id'] ?? ''));
            if ($name === '') $name = trim((string)($master['name'] ?? ''));
        } catch (Throwable $_) {}
    }
    if (in_array($role, ['sto','seller'], true)) {
        $entityId = trim((string)($context['organizationKey'] ?? $context['organization_key'] ?? $entityId));
        $orgName = trim((string)($context['organizationName'] ?? $context['organization_name'] ?? ''));
        if ($orgName !== '') $name = $orgName;
    }
    if ($name === '') {
        $name = [
            'master'=>'Мастер',
            'sto'=>'СТО',
            'seller'=>'Продавец',
            'admin'=>'Администратор',
            'owner'=>'Владелец'
        ][$role] ?? 'Пользователь';
    }
    return [
        'accountId'=>(int)($actor['accountId'] ?? $actor['account_id'] ?? 0),
        'personId'=>(int)($actor['personId'] ?? $actor['person_id'] ?? 0),
        'userId'=>(int)($actor['id'] ?? $actor['userId'] ?? 0),
        'contextId'=>(int)($actor['contextId'] ?? $context['id'] ?? 0),
        'entityId'=>$entityId,
        'role'=>$role,
        'name'=>$name,
    ];
}

function kareta_community_post_type(string $value): string {
    $type = strtoupper(trim($value));
    return in_array($type, ['POST','QUESTION','NEWS'], true) ? $type : 'POST';
}

function kareta_community_post_save(PDO $pdo, array $body): void {
    kareta_community_posts_ensure($pdo);
    $actor = kareta_community_actor($pdo);
    $post = is_array($body['post'] ?? null) ? $body['post'] : $body;
    $type = kareta_community_post_type((string)($post['type'] ?? $post['postType'] ?? 'POST'));
    $text = kareta_clean_text((string)($post['text'] ?? $post['body'] ?? ''), 12000);
    $groupId = trim((string)($post['groupId'] ?? $post['group_id'] ?? ''));
    if ($groupId !== '' && !preg_match('/^[A-Za-z0-9_.:-]{1,64}$/', $groupId)) $groupId = '';
    $title = kareta_clean_text((string)($post['title'] ?? ''), 255);
    $category = kareta_clean_text((string)($post['category'] ?? ''), 64);
    $city = kareta_clean_text((string)($post['city'] ?? ''), 160);
    $vehicle = kareta_clean_text((string)($post['vehicleLabel'] ?? $post['vehicle'] ?? ''), 191);
    $comments = !array_key_exists('comments', $post) || !empty($post['comments']);
    if (mb_strlen($text) < 3) {
        kareta_json(['ok'=>false,'error'=>'post_content_required','message'=>'Опишите публикацию подробнее.'],422);
    }
    if ($title === '') $title = mb_substr($text, 0, 90);
    $id = 'cp_'.substr(hash('sha256', ($actor['accountId'] ?: $actor['userId']).'|'.$actor['contextId'].'|'.microtime(true).'|'.random_int(1, PHP_INT_MAX)), 0, 24);
    $pdo->prepare("INSERT INTO community_posts(
      id,author_account_id,author_person_id,author_user_id,author_context_id,author_entity_id,
      author_role,author_name,post_type,group_id,title,text,category,city,vehicle_label,comments_enabled,
      visibility,active,published_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'public',1,NOW())")->execute([
        $id,
        $actor['accountId'] ?: null,
        $actor['personId'] ?: null,
        $actor['userId'] ?: null,
        $actor['contextId'] ?: null,
        $actor['entityId'] ?: null,
        $actor['role'],
        $actor['name'],
        $type,
        $groupId,
        $title,
        $text,
        $category,
        $city,
        $vehicle,
        $comments ? 1 : 0,
    ]);
    kareta_json(['ok'=>true,'data'=>['id'=>$id,'type'=>$type,'route'=>'#/community/post/'.rawurlencode('community:'.$id)]]);
}


function kareta_community_posts_list(?PDO $pdo, array $input): void {
    if (!$pdo) kareta_json(['ok'=>true,'data'=>['items'=>[],'source'=>'database-unavailable']]);
    kareta_community_posts_ensure($pdo);
    $limit = max(1, min(100, (int)($input['limit'] ?? 60)));
    $type = strtoupper(trim((string)($input['type'] ?? '')));
    $where = ["p.active=1", "p.visibility='public'"];
    $args = [];
    if (in_array($type, ['POST','QUESTION','NEWS'], true)) {
        $where[] = 'p.post_type=?';
        $args[] = $type;
    }
    $sql = "SELECT
      p.id,p.author_account_id AS authorAccountId,p.author_person_id AS authorPersonId,
      p.author_user_id AS authorUserId,p.author_context_id AS authorContextId,
      p.author_entity_id AS authorEntityId,p.author_role AS authorRole,p.author_name AS authorName,
      p.post_type AS type,p.group_id AS groupId,p.title,p.text,p.category,p.city,p.vehicle_label AS vehicleLabel,
      p.comments_enabled AS commentsEnabled,COALESCE(p.published_at,p.created_at) AS publishedAt,
      (SELECT COUNT(*) FROM master_wall_reactions r WHERE r.entity_key=CONCAT('community:',p.id) AND r.reaction='like') AS likesCount,
      (SELECT COUNT(*) FROM master_wall_comments_social c WHERE c.entity_key=CONCAT('community:',p.id) AND c.active=1) AS commentsCount
      FROM community_posts p
      WHERE ".implode(' AND ', $where)."
      ORDER BY COALESCE(p.published_at,p.created_at) DESC
      LIMIT {$limit}";
    $q = $pdo->prepare($sql);
    $q->execute($args);
    $items = $q->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $entityKeys = array_map(static fn($row) => 'community:'.(string)$row['id'], $items);
    $states = function_exists('kareta_master_wall_social_states')
        ? kareta_master_wall_social_states($pdo, $entityKeys)
        : [];
    foreach ($items as &$item) {
        $key = 'community:'.(string)$item['id'];
        $state = $states[$key] ?? [];
        $item['entityKey'] = $key;
        $item['likedByMe'] = !empty($state['liked']);
        $item['savedByMe'] = !empty($state['saved']);
        $item['commentsEnabled'] = !empty($item['commentsEnabled']);
        $item['likesCount'] = (int)($item['likesCount'] ?? 0);
        $item['commentsCount'] = (int)($item['commentsCount'] ?? 0);
    }
    unset($item);
    kareta_json(['ok'=>true,'data'=>['items'=>$items,'source'=>'community_posts']]);
}
