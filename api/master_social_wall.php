<?php
declare(strict_types=1);

function kareta_master_wall_social_ensure(PDO $pdo): void {
    if (function_exists('kareta_master_wall_ensure_table')) {
        try { kareta_master_wall_ensure_table($pdo); } catch (Throwable $_) {}
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS `master_wall_posts` (
      `id` VARCHAR(64) NOT NULL PRIMARY KEY,
      `master_id` VARCHAR(64) NOT NULL DEFAULT '',
      `master_user_id` BIGINT UNSIGNED NULL,
      `master_name` VARCHAR(191) NOT NULL DEFAULT '',
      `order_id` VARCHAR(64) NOT NULL DEFAULT '',
      `post_type` VARCHAR(32) NOT NULL DEFAULT 'note',
      `stage_code` VARCHAR(32) NOT NULL DEFAULT '',
      `category` VARCHAR(64) NOT NULL DEFAULT 'note',
      `preview` TEXT NULL,
      `title` VARCHAR(255) NULL,
      `text` MEDIUMTEXT NULL,
      `links_json` JSON NULL,
      `photos_json` JSON NULL,
      `files_json` JSON NULL,
      `steps_json` JSON NULL,
      `parts_json` JSON NULL,
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      `active` TINYINT(1) NOT NULL DEFAULT 1,
      KEY `idx_master_wall_master_id` (`master_id`),
      KEY `idx_master_wall_active_created` (`active`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $columns=[
      'visibility'=>"ALTER TABLE `master_wall_posts` ADD COLUMN `visibility` VARCHAR(24) NOT NULL DEFAULT 'public' AFTER `category`",
      'linked_product_id'=>"ALTER TABLE `master_wall_posts` ADD COLUMN `linked_product_id` VARCHAR(64) NULL AFTER `visibility`",
      'video_url'=>"ALTER TABLE `master_wall_posts` ADD COLUMN `video_url` VARCHAR(500) NULL AFTER `linked_product_id`",
      'published_at'=>"ALTER TABLE `master_wall_posts` ADD COLUMN `published_at` DATETIME NULL AFTER `video_url`",
    ];
    foreach($columns as $column=>$sql){try{kareta_ensure_column($pdo,'master_wall_posts',$column,$sql);}catch(Throwable $_){}}
    try{$pdo->exec("CREATE INDEX idx_master_wall_public ON master_wall_posts(master_id,active,visibility,published_at)");}catch(Throwable $_){}

    $pdo->exec("CREATE TABLE IF NOT EXISTS `master_wall_reactions` (
      `id` VARCHAR(64) NOT NULL PRIMARY KEY,
      `entity_key` VARCHAR(160) NOT NULL,
      `actor_key` VARCHAR(80) NOT NULL,
      `account_id` BIGINT NULL,
      `user_id` BIGINT NULL,
      `reaction` VARCHAR(24) NOT NULL DEFAULT 'like',
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY `uq_master_wall_reaction` (`entity_key`,`actor_key`,`reaction`),
      KEY `idx_master_wall_reaction_entity` (`entity_key`,`reaction`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `master_wall_saved` (
      `id` VARCHAR(64) NOT NULL PRIMARY KEY,
      `entity_key` VARCHAR(160) NOT NULL,
      `actor_key` VARCHAR(80) NOT NULL,
      `account_id` BIGINT NULL,
      `user_id` BIGINT NULL,
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY `uq_master_wall_saved` (`entity_key`,`actor_key`),
      KEY `idx_master_wall_saved_actor` (`actor_key`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `master_wall_comments_social` (
      `id` VARCHAR(64) NOT NULL PRIMARY KEY,
      `entity_key` VARCHAR(160) NOT NULL,
      `parent_id` VARCHAR(64) NOT NULL DEFAULT '',
      `actor_key` VARCHAR(80) NOT NULL,
      `account_id` BIGINT NULL,
      `person_id` BIGINT NULL,
      `user_id` BIGINT NULL,
      `author_name` VARCHAR(160) NOT NULL,
      `author_role` VARCHAR(32) NOT NULL DEFAULT 'client',
      `author_master_id` VARCHAR(64) NULL,
      `body` TEXT NOT NULL,
      `active` TINYINT(1) NOT NULL DEFAULT 1,
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY `idx_master_wall_comment_entity` (`entity_key`,`active`,`created_at`),
      KEY `idx_master_wall_comment_parent` (`parent_id`,`active`,`created_at`),
      KEY `idx_master_wall_comment_actor` (`actor_key`,`active`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function kareta_master_wall_actor(?PDO $pdo=null,bool $required=false): array {
    $actor=[];
    try { if($pdo && function_exists('kareta_resolve_api_actor')) $actor=kareta_resolve_api_actor($pdo); } catch(Throwable $_) {}
    if(!$actor){$actor=function_exists('kareta_session_user')?(kareta_session_user()?:[]):[];}
    $accountId=(int)($actor['accountId']??$actor['account_id']??0);
    $userId=(int)($actor['id']??$actor['userId']??0);
    $personId=(int)($actor['personId']??$actor['person_id']??0);
    $actorKey=$accountId>0?'a:'.$accountId:($userId>0?'u:'.$userId:'');
    if($required&&$actorKey==='')kareta_json(['ok'=>false,'error'=>'auth_required','message'=>'Войдите в аккаунт.'],401);
    return ['actorKey'=>$actorKey,'accountId'=>$accountId,'userId'=>$userId,'personId'=>$personId,'role'=>(string)($actor['role']??'client'),'name'=>(string)($actor['name']??''),'phone'=>(string)($actor['phone']??'')];
}

function kareta_master_wall_current_master(PDO $pdo): array {
    kareta_require_api_capability($pdo,'profile.manage',['master','admin','owner']);
    $master=function_exists('kareta_master_workplace_profile')?kareta_master_workplace_profile($pdo):[];
    if(trim((string)($master['id']??''))==='')kareta_json(['ok'=>false,'error'=>'master_profile_not_found','message'=>'Профиль Мастера не найден для текущего типа аккаунта'],409);
    return $master;
}

function kareta_master_wall_clean_url(string $value): string {
    $value=trim($value);if($value==='')return '';
    if(str_starts_with($value,'/'))return mb_substr($value,0,500);
    if(!preg_match('~^https?://~i',$value))return '';
    return mb_substr($value,0,500);
}

function kareta_master_wall_type(string $type): string {
    $type=strtolower(trim($type));
    return in_array($type,['note','advice','news','video','part'],true)?$type:'note';
}

function kareta_master_wall_type_label(string $type): string {
    return ['note'=>'Публикация','advice'=>'Совет','news'=>'Новость','video'=>'Видео','part'=>'Запчасть'][$type]??'Публикация';
}

function kareta_master_wall_product(PDO $pdo,string $id): ?array {
    if($id===''||!kareta_table_exists($pdo,'seller_products'))return null;
    try{$q=$pdo->prepare("SELECT p.id,p.name,p.sku,p.oem_number,p.brand,p.price,p.stock_qty,p.image_url,sp.store_name FROM seller_products p LEFT JOIN seller_profiles sp ON sp.user_id=p.seller_user_id WHERE p.id=? AND p.status='active' LIMIT 1");$q->execute([$id]);$r=$q->fetch(PDO::FETCH_ASSOC)?:null;if(!$r)return null;return ['id'=>(string)$r['id'],'name'=>(string)$r['name'],'sku'=>(string)($r['sku']??''),'oem'=>(string)($r['oem_number']??''),'brand'=>(string)($r['brand']??''),'price'=>(float)($r['price']??0),'stockQty'=>(int)($r['stock_qty']??0),'imageUrl'=>(string)($r['image_url']??''),'storeName'=>(string)($r['store_name']??'')];}catch(Throwable $_){return null;}
}

function kareta_master_wall_social_states(PDO $pdo,array $entityKeys): array {
    $actor=kareta_master_wall_actor($pdo,false);$key=$actor['actorKey'];if($key===''||!$entityKeys)return [];
    $entityKeys=array_values(array_unique(array_filter(array_map('strval',$entityKeys))));if(!$entityKeys)return [];
    $marks=implode(',',array_fill(0,count($entityKeys),'?'));$out=[];
    $q=$pdo->prepare("SELECT entity_key,reaction FROM master_wall_reactions WHERE actor_key=? AND entity_key IN ($marks)");$q->execute(array_merge([$key],$entityKeys));foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r){$out[(string)$r['entity_key']]['liked']=((string)$r['reaction']==='like');}
    $q=$pdo->prepare("SELECT entity_key FROM master_wall_saved WHERE actor_key=? AND entity_key IN ($marks)");$q->execute(array_merge([$key],$entityKeys));foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r){$out[(string)$r['entity_key']]['saved']=true;}
    return $out;
}

function kareta_master_social_wall_feed(?PDO $pdo,array $input): void {
    if(!$pdo)kareta_json(['ok'=>true,'data'=>['items'=>[],'counts'=>[]]]);
    kareta_master_wall_social_ensure($pdo);kareta_work_posts_ensure($pdo);
    $masterId=trim((string)($input['masterId']??$input['master_id']??''));if($masterId==='')kareta_json(['ok'=>false,'error'=>'master_required'],422);
    try{$q=$pdo->prepare("SELECT COALESCE(profile_visible,1) FROM masters WHERE id=? LIMIT 1");$q->execute([$masterId]);$visible=$q->fetchColumn();if($visible!==false&&(int)$visible===0)kareta_json(['ok'=>false,'error'=>'provider_profile_hidden'],404);}catch(Throwable $_){}
    $limit=max(1,min(120,(int)($input['limit']??80)));$items=[];
    try{
      $q=$pdo->prepare("SELECT p.*, (SELECT COUNT(*) FROM master_wall_reactions r WHERE r.entity_key=CONCAT('post:',p.id) AND r.reaction='like') likes_count, (SELECT COUNT(*) FROM master_wall_comments_social c WHERE c.entity_key=CONCAT('post:',p.id) AND c.active=1) comments_count FROM master_wall_posts p WHERE p.master_id=? AND p.active=1 AND COALESCE(p.visibility,'public')='public' ORDER BY COALESCE(p.published_at,p.created_at) DESC LIMIT {$limit}");$q->execute([$masterId]);
      foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r){$type=kareta_master_wall_type((string)($r['post_type']??$r['category']??'note'));$photos=json_decode((string)($r['photos_json']??'[]'),true);if(!is_array($photos))$photos=[];$photos=array_values(array_filter(array_map(static fn($x)=>is_string($x)?kareta_master_wall_clean_url($x):'',array_slice($photos,0,8))));$linked=trim((string)($r['linked_product_id']??''));$items[]=['source'=>'post','entityKey'=>'post:'.(string)$r['id'],'id'=>(string)$r['id'],'kind'=>$type,'kindLabel'=>kareta_master_wall_type_label($type),'title'=>(string)($r['title']??''),'text'=>(string)($r['text']??''),'preview'=>(string)($r['preview']??''),'photos'=>$photos,'image'=>$photos[0]??'','videoUrl'=>(string)($r['video_url']??''),'linkedProductId'=>$linked,'product'=>$linked!==''?kareta_master_wall_product($pdo,$linked):null,'date'=>(string)($r['published_at']??$r['created_at']??''),'likes'=>(int)($r['likes_count']??0),'comments'=>(int)($r['comments_count']??0),'views'=>0,'href'=>'','editable'=>false];}
    }catch(Throwable $e){if(function_exists('kareta_log_error'))kareta_log_error('master_wall_feed_posts',$e->getMessage());}
    try{
      $q=$pdo->prepare("SELECT wp.id,wp.title,wp.summary,wp.cover_url,wp.published_at,wp.created_at,wp.views_count,wp.likes_count,(SELECT COUNT(*) FROM work_post_comments c WHERE c.post_id=wp.id AND c.active=1) comments_count FROM work_posts wp WHERE wp.master_id=? AND wp.status='published' AND wp.visibility='public' ORDER BY COALESCE(wp.published_at,wp.created_at) DESC LIMIT {$limit}");$q->execute([$masterId]);foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r){$items[]=['source'=>'work','entityKey'=>'work:'.(string)$r['id'],'id'=>(string)$r['id'],'kind'=>'work','kindLabel'=>'Выполненная работа','title'=>(string)($r['title']??'Выполненная работа'),'text'=>(string)($r['summary']??''),'preview'=>(string)($r['summary']??''),'photos'=>[],'image'=>(string)($r['cover_url']??''),'videoUrl'=>'','linkedProductId'=>'','product'=>null,'date'=>(string)($r['published_at']??$r['created_at']??''),'likes'=>(int)($r['likes_count']??0),'comments'=>(int)($r['comments_count']??0),'views'=>(int)($r['views_count']??0),'href'=>'#/works/item/'.rawurlencode((string)$r['id']),'editable'=>false];}
    }catch(Throwable $e){if(function_exists('kareta_log_error'))kareta_log_error('master_wall_feed_works',$e->getMessage());}
    // Legacy master-authored news is preserved in the unified wall until it is edited/recreated through the new wall editor.
    try{
      $q=$pdo->prepare("SELECT user_id FROM masters WHERE id=? LIMIT 1");$q->execute([$masterId]);$author=(int)($q->fetchColumn()?:0);if($author>0&&kareta_table_exists($pdo,'news_articles')){$n=$pdo->prepare("SELECT n.id,n.title,n.intro,n.body,n.cover_url,n.published_at,n.created_at,n.views_count,(SELECT COUNT(*) FROM master_wall_reactions r WHERE r.entity_key=CONCAT('news:',n.id) AND r.reaction='like') likes_count,(SELECT COUNT(*) FROM master_wall_comments_social c WHERE c.entity_key=CONCAT('news:',n.id) AND c.active=1) comments_count FROM news_articles n WHERE n.author_user_id=? AND n.active=1 ORDER BY COALESCE(n.published_at,n.created_at) DESC LIMIT {$limit}");$n->execute([$author]);foreach($n->fetchAll(PDO::FETCH_ASSOC)?:[] as $r){$items[]=['source'=>'news','entityKey'=>'news:'.(string)$r['id'],'id'=>(string)$r['id'],'kind'=>'news','kindLabel'=>'Новость','title'=>(string)($r['title']??'Новость'),'text'=>(string)($r['intro']??$r['body']??''),'preview'=>(string)($r['intro']??''),'photos'=>[],'image'=>(string)($r['cover_url']??''),'videoUrl'=>'','linkedProductId'=>'','product'=>null,'date'=>(string)($r['published_at']??$r['created_at']??''),'likes'=>(int)($r['likes_count']??0),'comments'=>(int)($r['comments_count']??0),'views'=>(int)($r['views_count']??0),'href'=>'#/news/'.rawurlencode((string)$r['id']),'editable'=>false];}}
    }catch(Throwable $e){if(function_exists('kareta_log_error'))kareta_log_error('master_wall_feed_legacy_news',$e->getMessage());}
    usort($items,static fn($a,$b)=>strcmp((string)($b['date']??''),(string)($a['date']??'')));$items=array_slice($items,0,$limit);
    $states=kareta_master_wall_social_states($pdo,array_column($items,'entityKey'));foreach($items as &$item){$state=$states[$item['entityKey']]??[];$item['liked']=!empty($state['liked']);$item['saved']=!empty($state['saved']);}unset($item);
    $counts=['all'=>count($items),'works'=>0,'posts'=>0,'advice'=>0,'news'=>0,'video'=>0,'parts'=>0];foreach($items as $i){if($i['kind']==='work')$counts['works']++;elseif($i['kind']==='advice')$counts['advice']++;elseif($i['kind']==='news')$counts['news']++;elseif($i['kind']==='video')$counts['video']++;elseif($i['kind']==='part')$counts['parts']++;else $counts['posts']++;}
    kareta_json(['ok'=>true,'data'=>['items'=>$items,'counts'=>$counts,'masterId'=>$masterId]]);
}

function kareta_master_social_wall_mine(PDO $pdo): void {
    kareta_master_wall_social_ensure($pdo);$master=kareta_master_wall_current_master($pdo);$masterId=(string)$master['id'];
    $q=$pdo->prepare("SELECT p.*, (SELECT COUNT(*) FROM master_wall_reactions r WHERE r.entity_key=CONCAT('post:',p.id) AND r.reaction='like') likes_count,(SELECT COUNT(*) FROM master_wall_comments_social c WHERE c.entity_key=CONCAT('post:',p.id) AND c.active=1) comments_count FROM master_wall_posts p WHERE p.master_id=? AND p.active=1 ORDER BY COALESCE(p.published_at,p.created_at) DESC LIMIT 200");$q->execute([$masterId]);$items=[];
    foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r){$type=kareta_master_wall_type((string)($r['post_type']??$r['category']??'note'));$photos=json_decode((string)($r['photos_json']??'[]'),true);if(!is_array($photos))$photos=[];$linked=trim((string)($r['linked_product_id']??''));$items[]=['id'=>(string)$r['id'],'kind'=>$type,'kindLabel'=>kareta_master_wall_type_label($type),'title'=>(string)($r['title']??''),'text'=>(string)($r['text']??''),'preview'=>(string)($r['preview']??''),'photos'=>array_values($photos),'videoUrl'=>(string)($r['video_url']??''),'linkedProductId'=>$linked,'product'=>$linked!==''?kareta_master_wall_product($pdo,$linked):null,'visibility'=>(string)($r['visibility']??'public'),'date'=>(string)($r['published_at']??$r['created_at']??''),'likes'=>(int)($r['likes_count']??0),'comments'=>(int)($r['comments_count']??0)];}
    $workCount=0;try{$w=$pdo->prepare("SELECT COUNT(*) FROM work_posts WHERE master_id=? AND status='published' AND visibility='public'");$w->execute([$masterId]);$workCount=(int)$w->fetchColumn();}catch(Throwable $_){}
    $counts=['published'=>count(array_filter($items,fn($x)=>$x['visibility']==='public')),'drafts'=>count(array_filter($items,fn($x)=>$x['visibility']!=='public')),'works'=>$workCount,'all'=>count($items)+$workCount];
    kareta_json(['ok'=>true,'data'=>['master'=>['id'=>$masterId,'name'=>(string)($master['name']??'Мастер')],'items'=>$items,'counts'=>$counts]]);
}

function kareta_master_social_wall_save(PDO $pdo,array $body): void {
    kareta_master_wall_social_ensure($pdo);$master=kareta_master_wall_current_master($pdo);$masterId=(string)$master['id'];$actor=kareta_master_wall_actor($pdo,true);
    $post=is_array($body['post']??null)?$body['post']:$body;$id=trim((string)($post['id']??''));$type=kareta_master_wall_type((string)($post['kind']??$post['postType']??'note'));
    $title=kareta_clean_text((string)($post['title']??''),255);$text=kareta_clean_text((string)($post['text']??$post['body']??''),12000);$preview=kareta_clean_text((string)($post['preview']??''),500);
    if($title===''&&$text==='')kareta_json(['ok'=>false,'error'=>'post_content_required','message'=>'Добавьте заголовок или текст публикации.'],422);
    if($title==='')$title=mb_substr($text,0,90);if($preview==='')$preview=mb_substr($text,0,240);
    $visibility=(string)($post['visibility']??'public');$visibility=$visibility==='draft'?'draft':'public';$video=kareta_master_wall_clean_url((string)($post['videoUrl']??''));$linked=trim((string)($post['linkedProductId']??''));
    if($type!=='video')$video='';if($type!=='part')$linked='';if($type==='video'&&$video==='')kareta_json(['ok'=>false,'error'=>'video_url_required','message'=>'Для видеопубликации добавьте ссылку на видео.'],422);if($type==='part'&&$linked!==''&&!kareta_master_wall_product($pdo,$linked))kareta_json(['ok'=>false,'error'=>'product_not_found','message'=>'Активная запчасть не найдена.'],422);
    $photos=[];$rawPhotos=$post['photos']??[];if(is_string($rawPhotos))$rawPhotos=preg_split('/[\r\n,]+/',$rawPhotos)?:[];if(is_array($rawPhotos)){foreach(array_slice($rawPhotos,0,8) as $x){$u=kareta_master_wall_clean_url((string)$x);if($u!=='')$photos[]=$u;}}
    if($id==='')$id='mwp_'.substr(hash('sha256',$masterId.'|'.microtime(true).'|'.random_int(1,PHP_INT_MAX)),0,24);else{$q=$pdo->prepare("SELECT master_id FROM master_wall_posts WHERE id=? AND active=1 LIMIT 1");$q->execute([$id]);$owner=(string)($q->fetchColumn()?:'');if($owner!==''&&$owner!==$masterId)kareta_json(['ok'=>false,'error'=>'forbidden','message'=>'Нельзя редактировать чужую публикацию.'],403);}
    $publishedAt=$visibility==='public'?date('Y-m-d H:i:s'):null;$pdo->prepare("INSERT INTO master_wall_posts(id,master_id,master_user_id,master_name,order_id,post_type,stage_code,category,visibility,linked_product_id,video_url,published_at,preview,title,text,links_json,photos_json,files_json,steps_json,parts_json,created_at,updated_at,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW(),1) ON DUPLICATE KEY UPDATE post_type=VALUES(post_type),category=VALUES(category),visibility=VALUES(visibility),linked_product_id=VALUES(linked_product_id),video_url=VALUES(video_url),published_at=CASE WHEN VALUES(visibility)='public' THEN COALESCE(master_wall_posts.published_at,VALUES(published_at)) ELSE NULL END,preview=VALUES(preview),title=VALUES(title),text=VALUES(text),photos_json=VALUES(photos_json),master_name=VALUES(master_name),updated_at=NOW(),active=1")->execute([$id,$masterId,$actor['userId']?:null,(string)($master['name']??$actor['name']??'Мастер'),'',$type,'',$type,$visibility,$linked?:null,$video?:null,$publishedAt,$preview,$title,$text,'[]',json_encode($photos,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),'[]','[]','[]']);
    kareta_json(['ok'=>true,'data'=>['id'=>$id,'visibility'=>$visibility,'kind'=>$type,'route'=>'#/master/wall']]);
}

function kareta_master_social_wall_delete(PDO $pdo,array $body): void {
    kareta_master_wall_social_ensure($pdo);$master=kareta_master_wall_current_master($pdo);$id=trim((string)($body['id']??''));if($id==='')kareta_json(['ok'=>false,'error'=>'id_required'],422);$q=$pdo->prepare("UPDATE master_wall_posts SET active=0,updated_at=NOW() WHERE id=? AND master_id=?");$q->execute([$id,(string)$master['id']]);if($q->rowCount()<1)kareta_json(['ok'=>false,'error'=>'not_found_or_forbidden'],404);kareta_json(['ok'=>true,'data'=>['deleted'=>true,'id'=>$id]]);
}

function kareta_master_social_wall_react(PDO $pdo,array $body): void {
    kareta_master_wall_social_ensure($pdo);$actor=kareta_master_wall_actor($pdo,true);$entity=trim((string)($body['entityKey']??''));if(!preg_match('/^(post|news|community):[A-Za-z0-9_.:-]{1,120}$/',$entity))kareta_json(['ok'=>false,'error'=>'invalid_entity'],422);$value=!empty($body['value']);
    if($value){$id='mwr_'.substr(hash('sha256',$entity.'|'.$actor['actorKey'].'|like'),0,24);$pdo->prepare("INSERT IGNORE INTO master_wall_reactions(id,entity_key,actor_key,account_id,user_id,reaction) VALUES(?,?,?,?,?,'like')")->execute([$id,$entity,$actor['actorKey'],$actor['accountId']?:null,$actor['userId']?:null]);}else{$pdo->prepare("DELETE FROM master_wall_reactions WHERE entity_key=? AND actor_key=? AND reaction='like'")->execute([$entity,$actor['actorKey']]);}
    $q=$pdo->prepare("SELECT COUNT(*) FROM master_wall_reactions WHERE entity_key=? AND reaction='like'");$q->execute([$entity]);kareta_json(['ok'=>true,'data'=>['liked'=>$value,'likesCount'=>(int)$q->fetchColumn()]]);
}

function kareta_master_social_wall_save_state(PDO $pdo,array $body): void {
    kareta_master_wall_social_ensure($pdo);$actor=kareta_master_wall_actor($pdo,true);$entity=trim((string)($body['entityKey']??''));if(!preg_match('/^(post|news|community):[A-Za-z0-9_.:-]{1,120}$/',$entity))kareta_json(['ok'=>false,'error'=>'invalid_entity'],422);$value=!empty($body['value']);if($value){$id='mws_'.substr(hash('sha256',$entity.'|'.$actor['actorKey']),0,24);$pdo->prepare("INSERT IGNORE INTO master_wall_saved(id,entity_key,actor_key,account_id,user_id) VALUES(?,?,?,?,?)")->execute([$id,$entity,$actor['actorKey'],$actor['accountId']?:null,$actor['userId']?:null]);}else{$pdo->prepare("DELETE FROM master_wall_saved WHERE entity_key=? AND actor_key=?")->execute([$entity,$actor['actorKey']]);}kareta_json(['ok'=>true,'data'=>['saved'=>$value]]);
}

function kareta_master_social_wall_comments(PDO $pdo,array $input): void {
    kareta_master_wall_social_ensure($pdo);$entity=trim((string)($input['entityKey']??''));if(!preg_match('/^(post|news|community):[A-Za-z0-9_.:-]{1,120}$/',$entity))kareta_json(['ok'=>false,'error'=>'invalid_entity'],422);$actor=kareta_master_wall_actor($pdo,false);$q=$pdo->prepare("SELECT id,parent_id,actor_key,account_id,person_id,user_id,author_name,author_role,author_master_id,body,created_at FROM master_wall_comments_social WHERE entity_key=? AND active=1 ORDER BY created_at ASC LIMIT 300");$q->execute([$entity]);$items=[];foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r){$items[]=['id'=>(string)$r['id'],'parentId'=>(string)($r['parent_id']??''),'authorName'=>(string)$r['author_name'],'authorRole'=>(string)$r['author_role'],'authorMasterId'=>(string)($r['author_master_id']??''),'body'=>(string)$r['body'],'createdAt'=>(string)$r['created_at'],'canDelete'=>$actor['actorKey']!==''&&$actor['actorKey']===(string)$r['actor_key']];}kareta_json(['ok'=>true,'data'=>['items'=>$items,'count'=>count($items)]]);
}

function kareta_master_social_wall_comment_add(PDO $pdo,array $body): void {
    kareta_master_wall_social_ensure($pdo);$actor=kareta_master_wall_actor($pdo,true);$entity=trim((string)($body['entityKey']??''));$text=kareta_clean_text((string)($body['text']??$body['body']??''),1500);$parent=trim((string)($body['parentId']??''));if(!preg_match('/^(post|news|community):[A-Za-z0-9_.:-]{1,120}$/',$entity)||$text==='')kareta_json(['ok'=>false,'error'=>'comment_required'],422);
    if($parent!==''){$q=$pdo->prepare("SELECT id,parent_id FROM master_wall_comments_social WHERE id=? AND entity_key=? AND active=1 LIMIT 1");$q->execute([$parent,$entity]);$pr=$q->fetch(PDO::FETCH_ASSOC)?:[];if(!$pr)kareta_json(['ok'=>false,'error'=>'parent_not_found'],404);if(trim((string)($pr['parent_id']??''))!=='')$parent=(string)$pr['parent_id'];}
    $masterId='';if($actor['role']==='master'&&function_exists('kareta_master_workplace_profile')){try{$m=kareta_master_workplace_profile($pdo);$masterId=(string)($m['id']??'');}catch(Throwable $_){}}
    $name=trim($actor['name']);if($name==='')$name=$actor['role']==='master'?'Мастер':'Пользователь';$id='mwc_'.substr(hash('sha256',$entity.'|'.$actor['actorKey'].'|'.microtime(true).'|'.$text),0,24);$pdo->prepare("INSERT INTO master_wall_comments_social(id,entity_key,parent_id,actor_key,account_id,person_id,user_id,author_name,author_role,author_master_id,body,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)")->execute([$id,$entity,$parent,$actor['actorKey'],$actor['accountId']?:null,$actor['personId']?:null,$actor['userId']?:null,$name,$actor['role'],$masterId?:null,$text]);kareta_json(['ok'=>true,'data'=>['comment'=>['id'=>$id,'parentId'=>$parent,'authorName'=>$name,'authorRole'=>$actor['role'],'authorMasterId'=>$masterId,'body'=>$text,'createdAt'=>date('Y-m-d H:i:s'),'canDelete'=>true]]]);
}

function kareta_master_social_wall_comment_delete(PDO $pdo,array $body): void {
    kareta_master_wall_social_ensure($pdo);$actor=kareta_master_wall_actor($pdo,true);$id=trim((string)($body['id']??$body['commentId']??''));if($id==='')kareta_json(['ok'=>false,'error'=>'id_required'],422);$q=$pdo->prepare("SELECT actor_key FROM master_wall_comments_social WHERE id=? AND active=1 LIMIT 1");$q->execute([$id]);$owner=(string)($q->fetchColumn()?:'');if($owner==='')kareta_json(['ok'=>false,'error'=>'not_found'],404);if($owner!==$actor['actorKey']&&!in_array($actor['role'],['admin','owner'],true))kareta_json(['ok'=>false,'error'=>'forbidden'],403);$pdo->prepare("UPDATE master_wall_comments_social SET active=0 WHERE id=? OR parent_id=?")->execute([$id,$id]);kareta_json(['ok'=>true,'data'=>['deleted'=>true]]);
}

function kareta_master_social_wall_community(?PDO $pdo,array $input): void {
    if(!$pdo)kareta_json(['ok'=>true,'data'=>['items'=>[]]]);
    kareta_master_wall_social_ensure($pdo);$limit=max(1,min(80,(int)($input['limit']??30)));$items=[];
    try{
      $q=$pdo->query("SELECT p.id,p.master_id,p.post_type,p.title,p.preview,p.text,p.photos_json,p.video_url,p.linked_product_id,COALESCE(p.published_at,p.created_at) published_at,COALESCE(NULLIF(u.name,''),m.name) master_name,COALESCE(u.avatar_url,'') avatar_url,(SELECT COUNT(*) FROM master_wall_reactions r WHERE r.entity_key=CONCAT('post:',p.id) AND r.reaction='like') likes_count,(SELECT COUNT(*) FROM master_wall_comments_social c WHERE c.entity_key=CONCAT('post:',p.id) AND c.active=1) comments_count FROM master_wall_posts p JOIN masters m ON m.id=p.master_id LEFT JOIN users u ON u.id=m.user_id WHERE p.active=1 AND COALESCE(p.visibility,'public')='public' AND COALESCE(m.profile_visible,1)=1 ORDER BY COALESCE(p.published_at,p.created_at) DESC LIMIT {$limit}");
      foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r){$photos=json_decode((string)($r['photos_json']??'[]'),true);if(!is_array($photos))$photos=[];$type=kareta_master_wall_type((string)($r['post_type']??'note'));$linked=trim((string)($r['linked_product_id']??''));$items[]=['id'=>(string)$r['id'],'entityKey'=>'post:'.(string)$r['id'],'masterId'=>(string)$r['master_id'],'masterName'=>(string)($r['master_name']??'Мастер'),'avatarUrl'=>(string)($r['avatar_url']??''),'kind'=>$type,'kindLabel'=>kareta_master_wall_type_label($type),'title'=>(string)($r['title']??''),'text'=>(string)($r['preview']??$r['text']??''),'image'=>(string)($photos[0]??''),'videoUrl'=>(string)($r['video_url']??''),'linkedProductId'=>$linked,'product'=>$linked!==''?kareta_master_wall_product($pdo,$linked):null,'publishedAt'=>(string)($r['published_at']??''),'likesCount'=>(int)($r['likes_count']??0),'commentsCount'=>(int)($r['comments_count']??0)];}
    }catch(Throwable $e){if(function_exists('kareta_log_error'))kareta_log_error('master_wall_community',$e->getMessage());}
    $states=kareta_master_wall_social_states($pdo,array_column($items,'entityKey'));foreach($items as &$item){$st=$states[$item['entityKey']]??[];$item['likedByMe']=!empty($st['liked']);$item['savedByMe']=!empty($st['saved']);}unset($item);
    kareta_json(['ok'=>true,'data'=>['items'=>$items]]);
}
