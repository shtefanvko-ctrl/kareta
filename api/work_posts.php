<?php
declare(strict_types=1);

function kareta_work_posts_ensure(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS work_posts (
      id VARCHAR(64) PRIMARY KEY,
      order_id VARCHAR(64) NOT NULL DEFAULT '',
      master_id VARCHAR(64) NOT NULL DEFAULT '',
      sto_id VARCHAR(64) NOT NULL DEFAULT '',
      vehicle_id VARCHAR(64) NOT NULL DEFAULT '',
      author_user_id BIGINT NULL,
      post_type VARCHAR(32) NOT NULL DEFAULT 'repair',
      title VARCHAR(255) NOT NULL,
      summary TEXT NULL,
      body MEDIUMTEXT NULL,
      vehicle_label VARCHAR(255) NOT NULL DEFAULT '',
      service_label VARCHAR(255) NOT NULL DEFAULT '',
      master_name VARCHAR(191) NOT NULL DEFAULT '',
      sto_name VARCHAR(191) NOT NULL DEFAULT '',
      cover_url VARCHAR(500) NOT NULL DEFAULT '',
      visibility VARCHAR(24) NOT NULL DEFAULT 'public',
      status VARCHAR(24) NOT NULL DEFAULT 'published',
      client_consent TINYINT(1) NOT NULL DEFAULT 0,
      views_count INT UNSIGNED NOT NULL DEFAULT 0,
      likes_count INT UNSIGNED NOT NULL DEFAULT 0,
      published_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_work_posts_order(order_id),
      INDEX idx_work_posts_public(status,visibility,published_at),
      INDEX idx_work_posts_master(master_id,published_at),
      INDEX idx_work_posts_sto(sto_id,published_at),
      INDEX idx_work_posts_vehicle(vehicle_id,published_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS work_post_media (
      id VARCHAR(64) PRIMARY KEY,
      post_id VARCHAR(64) NOT NULL,
      media_type VARCHAR(24) NOT NULL DEFAULT 'photo',
      file_url VARCHAR(500) NOT NULL,
      caption VARCHAR(500) NOT NULL DEFAULT '',
      stage_key VARCHAR(64) NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_work_post_media(post_id,sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS work_post_likes (
      id VARCHAR(64) PRIMARY KEY,
      post_id VARCHAR(64) NOT NULL,
      user_id BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_work_post_like(post_id,user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS work_post_saved (
      id VARCHAR(64) PRIMARY KEY,
      post_id VARCHAR(64) NOT NULL,
      user_id BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_work_post_saved(post_id,user_id),
      INDEX idx_work_post_saved_user(user_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS work_post_comments (
      id VARCHAR(64) PRIMARY KEY,
      post_id VARCHAR(64) NOT NULL,
      user_id BIGINT NULL,
      author_name VARCHAR(160) NOT NULL,
      author_role VARCHAR(32) NOT NULL DEFAULT 'client',
      body TEXT NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_work_post_comments_post(post_id,active,created_at),
      INDEX idx_work_post_comments_user(user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    try { kareta_ensure_column($pdo, 'work_post_comments', 'parent_id', "ALTER TABLE `work_post_comments` ADD COLUMN `parent_id` VARCHAR(64) NOT NULL DEFAULT '' AFTER `post_id`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'work_post_comments', 'account_id', "ALTER TABLE `work_post_comments` ADD COLUMN `account_id` BIGINT NULL AFTER `user_id`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'work_post_comments', 'person_id', "ALTER TABLE `work_post_comments` ADD COLUMN `person_id` BIGINT NULL AFTER `account_id`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'work_post_comments', 'author_master_id', "ALTER TABLE `work_post_comments` ADD COLUMN `author_master_id` VARCHAR(64) NULL AFTER `author_role`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'work_post_comments', 'author_sto_id', "ALTER TABLE `work_post_comments` ADD COLUMN `author_sto_id` VARCHAR(64) NULL AFTER `author_master_id`"); } catch (Throwable $_) {}
    try { $pdo->exec("CREATE INDEX idx_work_post_comments_parent ON work_post_comments(parent_id,active,created_at)"); } catch (Throwable $_) {}
    try { $pdo->exec("CREATE INDEX idx_work_post_comments_account ON work_post_comments(account_id,active,created_at)"); } catch (Throwable $_) {}
    $portfolioColumns=[
      'problem_text'=>"ALTER TABLE `work_posts` ADD COLUMN `problem_text` MEDIUMTEXT NULL AFTER `body`",
      'diagnosis_text'=>"ALTER TABLE `work_posts` ADD COLUMN `diagnosis_text` MEDIUMTEXT NULL AFTER `problem_text`",
      'solution_text'=>"ALTER TABLE `work_posts` ADD COLUMN `solution_text` MEDIUMTEXT NULL AFTER `diagnosis_text`",
      'parts_json'=>"ALTER TABLE `work_posts` ADD COLUMN `parts_json` JSON NULL AFTER `solution_text`",
      'duration_minutes'=>"ALTER TABLE `work_posts` ADD COLUMN `duration_minutes` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `parts_json`",
      'public_price'=>"ALTER TABLE `work_posts` ADD COLUMN `public_price` DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `duration_minutes`",
      'price_visible'=>"ALTER TABLE `work_posts` ADD COLUMN `price_visible` TINYINT(1) NOT NULL DEFAULT 0 AFTER `public_price`",
      'warranty_days'=>"ALTER TABLE `work_posts` ADD COLUMN `warranty_days` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `price_visible`",
      'completed_at'=>"ALTER TABLE `work_posts` ADD COLUMN `completed_at` DATETIME NULL AFTER `warranty_days`",
    ];
    foreach($portfolioColumns as $column=>$sql){try{kareta_ensure_column($pdo,'work_posts',$column,$sql);}catch(Throwable $_){}}
}

function kareta_work_post_story_snapshot(PDO $pdo,array $order,string $solutionText='',bool $showPrice=false): array {
    $orderId=trim((string)($order['id']??''));
    $story=['problemText'=>'','diagnosisText'=>'','solutionText'=>trim($solutionText),'parts'=>[],'durationMinutes'=>0,'publicPrice'=>0.0,'priceVisible'=>$showPrice,'warrantyDays'=>0,'completedAt'=>null];
    if($orderId==='')return $story;
    try{if(kareta_table_exists($pdo,'master_order_diagnostics')){$q=$pdo->prepare("SELECT complaints,findings FROM master_order_diagnostics WHERE order_id=? AND status='completed' LIMIT 1");$q->execute([$orderId]);$d=$q->fetch(PDO::FETCH_ASSOC)?:[];$story['problemText']=trim((string)($d['complaints']??''));$story['diagnosisText']=trim((string)($d['findings']??''));}}catch(Throwable $_){}
    try{if(kareta_table_exists($pdo,'work_order_handovers')){$q=$pdo->prepare("SELECT notes,accepted_at FROM work_order_handovers WHERE order_id=? AND status='accepted' LIMIT 1");$q->execute([$orderId]);$h=$q->fetch(PDO::FETCH_ASSOC)?:[];if($story['solutionText']===''&&trim((string)($h['notes']??''))!=='')$story['solutionText']=trim((string)$h['notes']);$story['completedAt']=$h['accepted_at']??null;}}catch(Throwable $_){}
    try{if(kareta_table_exists($pdo,'work_order_part_reservations')){$qtyColumn=kareta_column_exists($pdo,'work_order_part_reservations','qty_issued')?'qty_issued':'qty_reserved';$q=$pdo->prepare("SELECT part_name AS name,sku,oem,supplier_label AS supplier,{$qtyColumn} AS qty,unit_price AS unitPrice FROM work_order_part_reservations WHERE order_id=? AND ({$qtyColumn}>0 OR status IN ('reserved','issued','used','completed')) ORDER BY created_at");$q->execute([$orderId]);foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $part){$story['parts'][]=['name'=>(string)($part['name']??''),'sku'=>(string)($part['sku']??''),'oem'=>(string)($part['oem']??''),'supplier'=>(string)($part['supplier']??''),'qty'=>(float)($part['qty']??0),'unitPrice'=>$showPrice?(float)($part['unitPrice']??0):0.0];}}}catch(Throwable $_){}
    try{if(kareta_table_exists($pdo,'work_order_timers')){$q=$pdo->prepare("SELECT COALESCE(SUM(duration_sec),0) FROM work_order_timers WHERE order_id=? AND status='stopped'");$q->execute([$orderId]);$story['durationMinutes']=(int)round(((int)$q->fetchColumn())/60);}}catch(Throwable $_){}
    try{if(kareta_table_exists($pdo,'work_order_warranties')){$q=$pdo->prepare("SELECT warranty_days FROM work_order_warranties WHERE order_id=? LIMIT 1");$q->execute([$orderId]);$story['warrantyDays']=max(0,(int)($q->fetchColumn()?:0));}}catch(Throwable $_){}
    if($showPrice){try{if(kareta_table_exists($pdo,'work_order_financial_results')){$q=$pdo->prepare("SELECT revenue_total FROM work_order_financial_results WHERE order_id=? LIMIT 1");$q->execute([$orderId]);$story['publicPrice']=max(0,(float)($q->fetchColumn()?:0));}}catch(Throwable $_){}if($story['publicPrice']<=0)$story['publicPrice']=max(0,(float)($order['price']??0));}
    if(!$story['completedAt'])$story['completedAt']=$order['closed_at']??$order['completed_at']??$order['updated_at']??null;
    return $story;
}


function kareta_work_post_row(PDO $pdo,string $id,bool $publicOnly=true): array {
    kareta_work_posts_ensure($pdo);
    $sql="SELECT * FROM work_posts WHERE id=?".($publicOnly?" AND status='published' AND visibility='public'":"")." LIMIT 1";
    $st=$pdo->prepare($sql);$st->execute([$id]);$row=$st->fetch(PDO::FETCH_ASSOC);
    if(!$row) kareta_json(['ok'=>false,'error'=>'work_post_not_found'],404);
    return $row;
}

function kareta_work_posts_list(?PDO $pdo,array $input): void {
    if(!$pdo) kareta_json(['ok'=>true,'data'=>kareta_fallback_work_posts($input)]);
    kareta_work_posts_ensure($pdo);
    $where=["status='published'","visibility='public'"]; $args=[];
    foreach(['master_id'=>'masterId','sto_id'=>'stoId','vehicle_id'=>'vehicleId','post_type'=>'type'] as $column=>$key){$value=trim((string)($input[$key]??''));if($value!==''){$where[]="$column=?";$args[]=$value;}}
    $limit=max(1,min(60,(int)($input['limit']??24)));
    $uid=(int)(kareta_session_user()['id']??0);
    $st=$pdo->prepare("SELECT wp.id,wp.order_id AS orderId,wp.master_id AS masterId,wp.sto_id AS stoId,wp.vehicle_id AS vehicleId,wp.post_type AS type,wp.title,wp.summary,wp.body,wp.problem_text AS problemText,wp.diagnosis_text AS diagnosisText,wp.solution_text AS solutionText,wp.duration_minutes AS durationMinutes,wp.public_price AS publicPrice,wp.price_visible AS priceVisible,wp.warranty_days AS warrantyDays,wp.completed_at AS completedAt,wp.vehicle_label AS vehicleLabel,wp.service_label AS serviceLabel,wp.master_name AS masterName,wp.sto_name AS stoName,wp.cover_url AS coverUrl,wp.views_count AS viewsCount,wp.likes_count AS likesCount,wp.published_at AS publishedAt,(SELECT COUNT(*) FROM work_post_comments c WHERE c.post_id=wp.id AND c.active=1) AS commentsCount,".($uid>0?"EXISTS(SELECT 1 FROM work_post_likes l WHERE l.post_id=wp.id AND l.user_id=".$uid.")":"0")." AS likedByMe,".($uid>0?"EXISTS(SELECT 1 FROM work_post_saved s WHERE s.post_id=wp.id AND s.user_id=".$uid.")":"0")." AS savedByMe FROM work_posts wp WHERE ".implode(' AND ',array_map(static fn($x)=>str_replace(['status','visibility','master_id','sto_id','vehicle_id','post_type'],['wp.status','wp.visibility','wp.master_id','wp.sto_id','wp.vehicle_id','wp.post_type'],$x),$where))." ORDER BY wp.published_at DESC,wp.created_at DESC LIMIT $limit");
    $st->execute($args);$items=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
    if($items){$ids=array_column($items,'id');$ph=implode(',',array_fill(0,count($ids),'?'));$q=$pdo->prepare("SELECT id,post_id AS postId,media_type AS mediaType,file_url AS fileUrl,caption,stage_key AS stageKey,sort_order AS sortOrder FROM work_post_media WHERE post_id IN ($ph) ORDER BY sort_order,created_at");$q->execute($ids);$map=[];foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $media)$map[$media['postId']][]=$media;foreach($items as &$item)$item['media']=$map[$item['id']]??[];unset($item);}
    if(!$items) kareta_json(['ok'=>true,'data'=>kareta_fallback_work_posts($input)]);
    kareta_json(['ok'=>true,'data'=>['items'=>$items,'total'=>count($items),'source'=>'mysql']]);
}

function kareta_work_post_detail(?PDO $pdo,array $input): void {
    $id=trim((string)($input['id']??''));if($id==='')kareta_json(['ok'=>false,'error'=>'id_required'],400);
    if(!$pdo){ $post=kareta_fallback_work_post($id); if(!$post) kareta_json(['ok'=>false,'error'=>'work_post_not_found'],404); kareta_json(['ok'=>true,'data'=>['post'=>$post]]); }
    try { $post=kareta_work_post_row($pdo,$id,true); } catch(Throwable $e) { $post=kareta_fallback_work_post($id); if(!$post) throw $e; kareta_json(['ok'=>true,'data'=>['post'=>$post]]); }
    $q=$pdo->prepare("SELECT id,media_type AS mediaType,file_url AS fileUrl,caption,stage_key AS stageKey,sort_order AS sortOrder FROM work_post_media WHERE post_id=? ORDER BY sort_order,created_at");$q->execute([$id]);
    $pdo->prepare("UPDATE work_posts SET views_count=views_count+1 WHERE id=?")->execute([$id]);
    $post['media']=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
    $uid=(int)(kareta_session_user()['id']??0);
    $post['likedByMe']=false;$post['savedByMe']=false;
    if($uid>0){
      $x=$pdo->prepare("SELECT EXISTS(SELECT 1 FROM work_post_likes WHERE post_id=? AND user_id=?) liked,EXISTS(SELECT 1 FROM work_post_saved WHERE post_id=? AND user_id=?) saved");
      $x->execute([$id,$uid,$id,$uid]);$state=$x->fetch(PDO::FETCH_ASSOC)?:[];
      $post['likedByMe']=!empty($state['liked']);$post['savedByMe']=!empty($state['saved']);
    }
    $c=$pdo->prepare("SELECT COUNT(*) FROM work_post_comments WHERE post_id=? AND active=1");$c->execute([$id]);$post['commentsCount']=(int)$c->fetchColumn();
    $post['problemText']=(string)($post['problem_text']??'');$post['diagnosisText']=(string)($post['diagnosis_text']??'');$post['solutionText']=(string)($post['solution_text']??'');
    $decodedParts=json_decode((string)($post['parts_json']??'[]'),true);$post['parts']=is_array($decodedParts)?$decodedParts:[];
    $post['durationMinutes']=(int)($post['duration_minutes']??0);$post['priceVisible']=!empty($post['price_visible']);$post['publicPrice']=$post['priceVisible']?(float)($post['public_price']??0):0;$post['warrantyDays']=(int)($post['warranty_days']??0);$post['completedAt']=$post['completed_at']??null;
    if((string)($post['order_id']??'')!==''&&$post['problemText']===''&&$post['diagnosisText']===''){
      try{$order=kareta_work_order_require($pdo,(string)$post['order_id'],false);$story=kareta_work_post_story_snapshot($pdo,$order,$post['solutionText'],!empty($post['price_visible']));foreach($story as $k=>$v){$current=$post[$k]??null;if(($current===null||$current===''||$current===[]||$current===0||$current===false)&&$v!==''&&$v!==[]&&$v!==0)$post[$k]=$v;}}catch(Throwable $_){}
    }
    kareta_json(['ok'=>true,'data'=>['post'=>$post]]);
}

function kareta_work_post_publish_internal(PDO $pdo,array $order,array $body=[]): array {
    kareta_work_posts_ensure($pdo);
    $orderId=trim((string)($order['id']??$body['orderId']??''));
    if($orderId==='')throw new InvalidArgumentException('order_id_required');
    $draftQ=$pdo->prepare("SELECT * FROM work_order_publication_drafts WHERE order_id=? LIMIT 1");$draftQ->execute([$orderId]);$draft=$draftQ->fetch(PDO::FETCH_ASSOC)?:[];
    $title=trim((string)($body['title']??$draft['title']??$order['service_names']??'Выполненная работа'));
    $bodyText=trim((string)($body['body']??$draft['body']??'Работа выполнена и проверена мастером.'));
    $summary=trim((string)($body['summary']??mb_substr(preg_replace('/\s+/u',' ',$bodyText),0,220)));
    $consent=(!empty($body['clientConsent'])&&!empty($body['consentVerified']))?1:0;
    if(!$consent)throw new DomainException('client_consent_required');
    $cover=trim((string)($body['coverUrl']??$draft['cover_url']??''));
    if($cover===''){ $m=$pdo->prepare("SELECT file_url FROM work_order_media WHERE order_id=? AND visibility='public' ORDER BY FIELD(stage_key,'after','process','repair','before'),created_at DESC LIMIT 1");$m->execute([$orderId]);$cover=(string)($m->fetchColumn()?:''); }
    $handoverAccepted=false;try{if(kareta_table_exists($pdo,'work_order_handovers')){$hq=$pdo->prepare("SELECT COUNT(*) FROM work_order_handovers WHERE order_id=? AND status='accepted'");$hq->execute([$orderId]);$handoverAccepted=(int)$hq->fetchColumn()>0;}}catch(Throwable $_){}
    if(!$handoverAccepted&&!in_array(strtolower((string)($order['status']??'')),['done','completed','closed'],true))throw new DomainException('repair_not_completed');
    $id='work_'.$orderId;
    $anonymize=!empty($body['anonymizeClient']);
    $vehicle=$anonymize?(string)($order['vehicle_title']??'Автомобиль клиента'):(string)($order['client_car']??$order['vehicle_title']??'Автомобиль');
    $service=(string)($order['service_names']??'Ремонт автомобиля');
    if($anonymize){
        foreach([(string)($order['client_name']??''),(string)($order['client_phone']??''),(string)($order['vin']??''),(string)($order['client_car']??'')] as $private){if($private!=='')$bodyText=str_replace($private,$private===(string)($order['client_car']??'')?'Автомобиль клиента':'[скрыто]',$bodyText);}
        $summary=mb_substr(preg_replace('/\s+/u',' ',$bodyText),0,220);
    }
    $authorId=(int)($body['authorUserId']??kareta_session_user()['id']??0)?:null;
    $showPrice=!empty($body['showPrice']);$story=kareta_work_post_story_snapshot($pdo,$order,$bodyText,$showPrice);
    $partsJson=json_encode($story['parts'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    $st=$pdo->prepare("INSERT INTO work_posts(id,order_id,master_id,sto_id,vehicle_id,author_user_id,post_type,title,summary,body,problem_text,diagnosis_text,solution_text,parts_json,duration_minutes,public_price,price_visible,warranty_days,completed_at,vehicle_label,service_label,master_name,sto_name,cover_url,visibility,status,client_consent,published_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'public','published',1,NOW()) ON DUPLICATE KEY UPDATE title=VALUES(title),summary=VALUES(summary),body=VALUES(body),problem_text=VALUES(problem_text),diagnosis_text=VALUES(diagnosis_text),solution_text=VALUES(solution_text),parts_json=VALUES(parts_json),duration_minutes=VALUES(duration_minutes),public_price=VALUES(public_price),price_visible=VALUES(price_visible),warranty_days=VALUES(warranty_days),completed_at=VALUES(completed_at),cover_url=VALUES(cover_url),master_name=VALUES(master_name),sto_name=VALUES(sto_name),client_consent=1,status='published',visibility='public',published_at=NOW(),updated_at=NOW()");
    $st->execute([$id,$orderId,(string)($order['master_id']??''),(string)($order['sto_id']??''),(string)($order['client_vehicle_id']??''),$authorId,trim((string)($body['type']??'repair')),$title,$summary,$bodyText,$story['problemText'],$story['diagnosisText'],$story['solutionText'],$partsJson,$story['durationMinutes'],$story['publicPrice'],$story['priceVisible']?1:0,$story['warrantyDays'],$story['completedAt'],$vehicle,$service,(string)($order['master_name']??''),(string)($order['sto_name']??''),$cover]);
    $pdo->prepare("DELETE FROM work_post_media WHERE post_id=?")->execute([$id]);
    $q=$pdo->prepare("SELECT id,media_type,file_url,caption,stage_key FROM work_order_media WHERE order_id=? AND visibility='public' ORDER BY created_at");$q->execute([$orderId]);$ins=$pdo->prepare("INSERT INTO work_post_media(id,post_id,media_type,file_url,caption,stage_key,sort_order) VALUES(?,?,?,?,?,?,?)");$i=0;foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $media){$ins->execute(['wpm_'.bin2hex(random_bytes(8)),$id,$media['media_type'],$media['file_url'],$media['caption'],$media['stage_key'],$i++]);}
    $pdo->prepare("UPDATE work_order_publication_drafts SET status='published',visibility='public',updated_at=NOW() WHERE order_id=?")->execute([$orderId]);
    kareta_write_event($pdo,$orderId,!empty($body['automatic'])?'work_post_auto_published':'work_post_published',['postId'=>$id]);
    return ['id'=>$id,'route'=>'#/works/item/'.$id,'automatic'=>!empty($body['automatic'])];
}

function kareta_work_post_publish(PDO $pdo,array $body): void {
    $orderId=trim((string)($body['orderId']??''));$order=kareta_work_order_require($pdo,$orderId,true);
    $verified=false;
    if(kareta_table_exists($pdo,'work_order_publication_policies')){
        $q=$pdo->prepare("SELECT client_consent FROM work_order_publication_policies WHERE order_id=? LIMIT 1");$q->execute([$orderId]);$verified=(int)($q->fetchColumn()?:0)===1;
    }
    $body['clientConsent']=$verified;$body['consentVerified']=$verified;
    if($verified){$q=$pdo->prepare("SELECT anonymize_client,COALESCE(show_price,0) show_price FROM work_order_publication_policies WHERE order_id=? LIMIT 1");$q->execute([$orderId]);$policy=$q->fetch(PDO::FETCH_ASSOC)?:[];$body['anonymizeClient']=(int)($policy['anonymize_client']??0)===1;$body['showPrice']=(int)($policy['show_price']??0)===1;}
    try{$post=kareta_work_post_publish_internal($pdo,$order,$body);kareta_json(['ok'=>true,'post'=>$post]);}
    catch(DomainException $e){$msg=$e->getMessage()==='repair_not_completed'?'Работу можно опубликовать только после подтверждённой выдачи автомобиля':'Нужно подтверждение клиента на публикацию материалов';kareta_json(['ok'=>false,'error'=>$e->getMessage(),'message'=>$msg],422);}
}


function kareta_master_works_portfolio(PDO $pdo,array $input=[]): void {
    kareta_require_api_capability($pdo,'profile.manage',['master','admin','owner']);
    kareta_work_posts_ensure($pdo);
    $master=function_exists('kareta_master_workplace_profile')?kareta_master_workplace_profile($pdo):[];
    $masterId=trim((string)($master['id']??''));
    if($masterId==='')kareta_json(['ok'=>false,'error'=>'master_profile_not_found','message'=>'Профиль Мастера не найден для текущего типа аккаунта'],409);
    $published=[];$candidates=[];
    try{
        $q=$pdo->prepare("SELECT wp.id,wp.order_id AS orderId,wp.title,wp.summary,wp.problem_text AS problemText,wp.diagnosis_text AS diagnosisText,wp.solution_text AS solutionText,wp.vehicle_label AS vehicleLabel,wp.service_label AS serviceLabel,wp.cover_url AS coverUrl,wp.duration_minutes AS durationMinutes,wp.public_price AS publicPrice,wp.price_visible AS priceVisible,wp.warranty_days AS warrantyDays,wp.completed_at AS completedAt,wp.views_count AS viewsCount,wp.likes_count AS likesCount,wp.published_at AS publishedAt,(SELECT COUNT(*) FROM work_post_comments c WHERE c.post_id=wp.id AND c.active=1) commentsCount,(SELECT COUNT(*) FROM work_post_media m WHERE m.post_id=wp.id) mediaCount FROM work_posts wp WHERE BINARY wp.master_id=BINARY ? ORDER BY wp.published_at DESC,wp.created_at DESC LIMIT 80");
        $q->execute([$masterId]);$published=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
    }catch(Throwable $e){if(function_exists('kareta_log_error'))kareta_log_error('master_portfolio_published',$e->getMessage());}
    try{
        if(kareta_table_exists($pdo,'orders')&&kareta_table_exists($pdo,'work_order_handovers')){
            $showPriceExpr=(kareta_table_exists($pdo,'work_order_publication_policies')&&kareta_column_exists($pdo,'work_order_publication_policies','show_price'))?'COALESCE(pol.show_price,0)':'0';
            $policyJoin=kareta_table_exists($pdo,'work_order_publication_policies')?'LEFT JOIN work_order_publication_policies pol ON BINARY pol.order_id=BINARY o.id':'';
            $draftJoin=kareta_table_exists($pdo,'work_order_publication_drafts')?'LEFT JOIN work_order_publication_drafts d ON BINARY d.order_id=BINARY o.id':'';
            $draftCols=kareta_table_exists($pdo,'work_order_publication_drafts')?"COALESCE(d.title,'') draftTitle,COALESCE(d.body,'') draftBody,COALESCE(d.cover_url,'') coverUrl":"'' draftTitle,'' draftBody,'' coverUrl";
            $policyCols=kareta_table_exists($pdo,'work_order_publication_policies')?"COALESCE(pol.client_consent,0) clientConsent,COALESCE(pol.auto_publish,0) autoPublish,COALESCE(pol.anonymize_client,1) anonymizeClient,{$showPriceExpr} showPrice":"0 clientConsent,0 autoPublish,1 anonymizeClient,0 showPrice";
            $sql="SELECT o.id AS orderId,COALESCE(NULLIF(o.vehicle_title,''),NULLIF(o.client_car,''),'Автомобиль') vehicleLabel,COALESCE(NULLIF(o.service_names,''),'Ремонт автомобиля') serviceLabel,COALESCE(o.price,0) orderPrice,o.status,h.accepted_at AS completedAt,{$policyCols},{$draftCols},(SELECT COUNT(*) FROM work_order_media wom WHERE BINARY wom.order_id=BINARY o.id AND wom.visibility='public') mediaCount FROM orders o JOIN work_order_handovers h ON BINARY h.order_id=BINARY o.id AND h.status='accepted' {$policyJoin} {$draftJoin} LEFT JOIN work_posts wp ON BINARY wp.order_id=BINARY o.id WHERE BINARY o.master_id=BINARY ? AND wp.id IS NULL ORDER BY h.accepted_at DESC LIMIT 60";
            $q=$pdo->prepare($sql);$q->execute([$masterId]);$candidates=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
            foreach($candidates as &$candidate){$candidate['readyToPublish']=!empty($candidate['clientConsent']);$candidate['awaitingConsent']=empty($candidate['clientConsent']);}unset($candidate);
        }
    }catch(Throwable $e){if(function_exists('kareta_log_error'))kareta_log_error('master_portfolio_candidates',$e->getMessage());}
    $ready=count(array_filter($candidates,static fn($x)=>!empty($x['readyToPublish'])));$waiting=count($candidates)-$ready;
    kareta_json(['ok'=>true,'data'=>['master'=>['id'=>$masterId,'name'=>(string)($master['name']??'Мастер')],'published'=>$published,'candidates'=>$candidates,'counts'=>['published'=>count($published),'ready'=>$ready,'awaitingConsent'=>$waiting]]]);
}

function kareta_work_post_like(PDO $pdo,array $body): void {
    $user=kareta_require_any_role(['client','master','sto','seller','admin','owner']);
    $postId=trim((string)($body['postId']??''));
    if($postId==='')kareta_json(['ok'=>false,'error'=>'post_id_required'],400);
    kareta_work_post_row($pdo,$postId,true);
    $uid=(int)($user['id']??0);
    $q=$pdo->prepare("SELECT id FROM work_post_likes WHERE post_id=? AND user_id=? LIMIT 1");$q->execute([$postId,$uid]);$existing=$q->fetchColumn();
    if($existing){
      $pdo->prepare("DELETE FROM work_post_likes WHERE id=?")->execute([$existing]);
      $pdo->prepare("UPDATE work_posts SET likes_count=GREATEST(likes_count-1,0) WHERE id=?")->execute([$postId]);
      $liked=false;
    }else{
      $id='wpl_'.$postId.'_'.$uid;$pdo->prepare("INSERT IGNORE INTO work_post_likes(id,post_id,user_id) VALUES(?,?,?)")->execute([$id,$postId,$uid]);
      $pdo->prepare("UPDATE work_posts SET likes_count=likes_count+1 WHERE id=?")->execute([$postId]);
      $liked=true;
    }
    $c=$pdo->prepare("SELECT likes_count FROM work_posts WHERE id=?");$c->execute([$postId]);
    kareta_json(['ok'=>true,'data'=>['liked'=>$liked,'likesCount'=>(int)$c->fetchColumn()]]);
}

function kareta_work_post_save(PDO $pdo,array $body): void {
    $user=kareta_require_any_role(['client','master','sto','seller','admin','owner']);
    $postId=trim((string)($body['postId']??''));
    if($postId==='')kareta_json(['ok'=>false,'error'=>'post_id_required'],400);
    kareta_work_post_row($pdo,$postId,true);
    $uid=(int)($user['id']??0);$value=array_key_exists('value',$body)?!empty($body['value']):null;
    $q=$pdo->prepare("SELECT id FROM work_post_saved WHERE post_id=? AND user_id=? LIMIT 1");$q->execute([$postId,$uid]);$existing=$q->fetchColumn();
    $saved=$value===null?!$existing:$value;
    if($saved){$id='wps_'.$postId.'_'.$uid;$pdo->prepare("INSERT IGNORE INTO work_post_saved(id,post_id,user_id) VALUES(?,?,?)")->execute([$id,$postId,$uid]);}
    else{$pdo->prepare("DELETE FROM work_post_saved WHERE post_id=? AND user_id=?")->execute([$postId,$uid]);}
    kareta_json(['ok'=>true,'data'=>['postId'=>$postId,'saved'=>$saved]]);
}

function kareta_work_post_social_state(?PDO $pdo,array $input): void {
    if(!$pdo)_no_db();
    $user=kareta_require_any_role(['client','master','sto','seller','admin','owner']);
    kareta_work_posts_ensure($pdo);$uid=(int)($user['id']??0);
    $likes=$pdo->prepare("SELECT l.post_id,w.likes_count FROM work_post_likes l JOIN work_posts w ON w.id=l.post_id WHERE l.user_id=? AND w.status='published' AND w.visibility='public'");$likes->execute([$uid]);
    $saved=$pdo->prepare("SELECT s.post_id FROM work_post_saved s JOIN work_posts w ON w.id=s.post_id WHERE s.user_id=? AND w.status='published' AND w.visibility='public' ORDER BY s.created_at DESC");$saved->execute([$uid]);
    $posts=[];foreach($likes->fetchAll(PDO::FETCH_ASSOC)?:[] as $r){$posts['work:'.(string)$r['post_id']]=['liked'=>true,'likes'=>(int)$r['likes_count']];}
    $savedIds=[];foreach($saved->fetchAll(PDO::FETCH_ASSOC)?:[] as $r){$id='work:'.(string)$r['post_id'];$savedIds[]=$id;$posts[$id]=array_merge($posts[$id]??[],['saved'=>true]);}
    kareta_json(['ok'=>true,'data'=>['posts'=>$posts,'saved'=>$savedIds,'serverTime'=>gmdate('c')]]);
}

function kareta_work_post_comments_list(?PDO $pdo, array $input): void {
    if (!$pdo) _no_db();
    kareta_work_posts_ensure($pdo);
    $postId = trim((string)($input['postId'] ?? $input['id'] ?? ''));
    if ($postId === '') kareta_json(['ok'=>false,'error'=>'post_id_required'],422);
    $actor=null;try{$actor=kareta_resolve_api_actor($pdo);}catch(Throwable $_){}
    $uid=(int)($actor['id']??0);$accountId=(int)($actor['accountId']??0);
    $post=kareta_work_post_row($pdo,$postId,true);
    $postMaster=trim((string)($post['master_id']??$post['masterId']??''));$postSto=trim((string)($post['sto_id']??$post['stoId']??''));
    $st = $pdo->prepare("SELECT id,post_id,parent_id,user_id,account_id,person_id,author_name,author_role,author_master_id,author_sto_id,body,created_at FROM work_post_comments WHERE post_id=? AND active=1 ORDER BY created_at ASC LIMIT 300");
    $st->execute([$postId]);
    $items=array_map(static function(array $r) use($uid,$accountId,$postMaster,$postSto): array {
        $ownerId=(int)($r['user_id']??0);$ownerAccount=(int)($r['account_id']??0);$masterId=trim((string)($r['author_master_id']??''));$stoId=trim((string)($r['author_sto_id']??''));
        return ['id'=>(string)$r['id'],'postId'=>(string)$r['post_id'],'parentId'=>(string)($r['parent_id']??''),'userId'=>$ownerId?:null,'accountId'=>$ownerAccount?:null,'authorName'=>(string)$r['author_name'],'authorRole'=>(string)$r['author_role'],'authorMasterId'=>$masterId,'authorStoId'=>$stoId,'isWorkAuthorReply'=>($postMaster!==''&&$masterId===$postMaster)||($postSto!==''&&$stoId===$postSto),'body'=>(string)$r['body'],'createdAt'=>(string)$r['created_at'],'canDelete'=>(($accountId>0&&$ownerAccount===$accountId)||($uid>0&&$ownerId===$uid))];
    },$st->fetchAll(PDO::FETCH_ASSOC)?:[]);
    kareta_json(['ok'=>true,'data'=>['items'=>$items,'count'=>count($items)]]);
}

function kareta_work_post_comment_add(?PDO $pdo, array $body): void {
    if (!$pdo) _no_db();
    $actor=kareta_require_api_session($pdo,['client','master','sto','seller','admin','owner']);
    kareta_work_posts_ensure($pdo);
    $postId=trim((string)($body['postId']??$body['id']??''));$text=kareta_clean_text((string)($body['body']??$body['text']??''),1200);$parentId=trim((string)($body['parentId']??''));
    if($postId===''||$text==='')kareta_json(['ok'=>false,'error'=>'post_and_body_required'],422);
    $post=kareta_work_post_row($pdo,$postId,true);if(!$post)kareta_json(['ok'=>false,'error'=>'post_not_found'],404);
    if($parentId!==''){$parent=$pdo->prepare("SELECT id,parent_id FROM work_post_comments WHERE id=? AND post_id=? AND active=1 LIMIT 1");$parent->execute([$parentId,$postId]);$pr=$parent->fetch(PDO::FETCH_ASSOC)?:[];if(!$pr)kareta_json(['ok'=>false,'error'=>'parent_comment_not_found','message'=>'Комментарий для ответа не найден'],404);if(trim((string)($pr['parent_id']??''))!=='')$parentId=(string)$pr['parent_id'];}
    $userId=(int)($actor['id']??0)?:null;$accountId=(int)($actor['accountId']??0)?:null;$personId=(int)($actor['personId']??0)?:null;$role=(string)($actor['role']??'client');$name=kareta_clean_text((string)($actor['name']??''),160);
    if($name===''){$roleNames=['master'=>'Мастер','sto'=>'СТО','seller'=>'Продавец','admin'=>'Администратор','owner'=>'Владелец'];$name=$roleNames[$role]??'Клиент';}
    $authorMaster='';$authorSto='';
    if($role==='master'&&function_exists('kareta_master_workplace_profile')){try{$m=kareta_master_workplace_profile($pdo);$authorMaster=trim((string)($m['id']??''));}catch(Throwable $_){}}
    elseif($role==='sto'){try{$authorSto=kareta_sto_id_by_phone($pdo,(string)($actor['phone']??''));}catch(Throwable $_){}}
    $id='wpc_'.substr(hash('sha256',$postId.'|'.($accountId??$userId??0).'|'.microtime(true).'|'.$text),0,24);
    $pdo->prepare("INSERT INTO work_post_comments(id,post_id,parent_id,user_id,account_id,person_id,author_name,author_role,author_master_id,author_sto_id,body,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)")->execute([$id,$postId,$parentId,$userId,$accountId,$personId,$name,$role,$authorMaster?:null,$authorSto?:null,$text]);
    $isAuthor=(trim((string)($post['master_id']??''))!==''&&$authorMaster===trim((string)($post['master_id']??'')))||(trim((string)($post['sto_id']??''))!==''&&$authorSto===trim((string)($post['sto_id']??'')));
    kareta_json(['ok'=>true,'comment'=>['id'=>$id,'postId'=>$postId,'parentId'=>$parentId,'userId'=>$userId,'accountId'=>$accountId,'authorName'=>$name,'authorRole'=>$role,'authorMasterId'=>$authorMaster,'authorStoId'=>$authorSto,'isWorkAuthorReply'=>$isAuthor,'body'=>$text,'createdAt'=>date('Y-m-d H:i:s'),'canDelete'=>true]]);
}

function kareta_work_post_comment_delete(?PDO $pdo, array $body): void {
    if (!$pdo) _no_db();
    $actor=kareta_require_api_session($pdo,['client','master','sto','seller','admin','owner']);kareta_work_posts_ensure($pdo);
    $id=trim((string)($body['commentId']??$body['id']??''));if($id==='')kareta_json(['ok'=>false,'error'=>'comment_id_required'],422);
    $q=$pdo->prepare("SELECT user_id,account_id FROM work_post_comments WHERE id=? AND active=1 LIMIT 1");$q->execute([$id]);$row=$q->fetch(PDO::FETCH_ASSOC)?:[];if(!$row)kareta_json(['ok'=>false,'error'=>'comment_not_found'],404);
    $uid=(int)($actor['id']??0);$accountId=(int)($actor['accountId']??0);$role=(string)($actor['role']??'client');$isOwner=($accountId>0&&(int)($row['account_id']??0)===$accountId)||($uid>0&&(int)($row['user_id']??0)===$uid);
    if(!$isOwner&&!in_array($role,['admin','owner'],true))kareta_json(['ok'=>false,'error'=>'forbidden','message'=>'Можно удалить только свой комментарий'],403);
    $pdo->prepare("UPDATE work_post_comments SET active=0 WHERE id=? OR parent_id=?")->execute([$id,$id]);
    kareta_json(['ok'=>true,'data'=>['deleted'=>true,'commentId'=>$id]]);
}
