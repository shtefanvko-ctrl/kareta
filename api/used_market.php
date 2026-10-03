<?php
declare(strict_types=1);

function kareta_used_market_viewer(PDO $pdo, bool $required=false): array {
    try {
        $actor = kareta_resolve_api_actor($pdo);
        if ((int)($actor['id']??0)>0 || trim((string)($actor['phone']??''))!=='') return $actor;
    } catch (Throwable $_) {}
    $legacy=kareta_session_user() ?: [];
    if (!empty($legacy['id'])) return $legacy;
    if ($required) kareta_json(['ok'=>false,'error'=>'auth_required'],401);
    return [];
}
function kareta_used_market_actor(PDO $pdo): array {
    kareta_require_api_capability($pdo,'parts.browse',['client','master','sto','seller','admin','owner']);
    $actor=kareta_used_market_viewer($pdo,true);
    if (empty($actor['id'])) kareta_json(['ok'=>false,'error'=>'auth_required'],401);
    return $actor;
}
function kareta_used_market_ensure(PDO $pdo): void {
    static $done=false; if($done)return; $done=true;
    $pdo->exec("CREATE TABLE IF NOT EXISTS used_market_listings (
      id VARCHAR(64) PRIMARY KEY,
      seller_user_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(180) NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT 'other',
      listing_type VARCHAR(24) NOT NULL DEFAULT 'used',
      price DECIMAL(14,2) NOT NULL DEFAULT 0,
      price_negotiable TINYINT(1) NOT NULL DEFAULT 0,
      city VARCHAR(120) NOT NULL DEFAULT '',
      condition_code VARCHAR(32) NOT NULL DEFAULT 'good',
      brand VARCHAR(120) NOT NULL DEFAULT '',
      oem_number VARCHAR(120) NOT NULL DEFAULT '',
      vehicle VARCHAR(180) NOT NULL DEFAULT '',
      source_vehicle_id VARCHAR(64) NOT NULL DEFAULT '',
      donor_vehicle_json MEDIUMTEXT NULL,
      description TEXT NOT NULL,
      defects_text TEXT NOT NULL,
      exchange_note VARCHAR(500) NOT NULL DEFAULT '',
      delivery_modes_json VARCHAR(255) NOT NULL DEFAULT '[]',
      delivery_note VARCHAR(500) NOT NULL DEFAULT '',
      images_json MEDIUMTEXT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'active',
      draft_step TINYINT UNSIGNED NOT NULL DEFAULT 1,
      published_at DATETIME NULL,
      views INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_used_market_status_created(status,created_at),
      KEY idx_used_market_seller(seller_user_id,status),
      KEY idx_used_market_category_city(category,city),
      KEY idx_used_market_type(listing_type,status,created_at),
      KEY idx_used_market_owner_status(seller_user_id,status,updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS used_market_favorites (
      user_id BIGINT UNSIGNED NOT NULL,
      listing_id VARCHAR(64) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id,listing_id),
      KEY idx_used_market_fav_listing(listing_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    if(function_exists('kareta_ensure_column')){
        kareta_ensure_column($pdo,'used_market_listings','listing_type',"ALTER TABLE used_market_listings ADD COLUMN listing_type VARCHAR(24) NOT NULL DEFAULT 'used' AFTER category");
        kareta_ensure_column($pdo,'used_market_listings','source_vehicle_id',"ALTER TABLE used_market_listings ADD COLUMN source_vehicle_id VARCHAR(64) NOT NULL DEFAULT '' AFTER vehicle");
        kareta_ensure_column($pdo,'used_market_listings','price_negotiable',"ALTER TABLE used_market_listings ADD COLUMN price_negotiable TINYINT(1) NOT NULL DEFAULT 0 AFTER price");
        kareta_ensure_column($pdo,'used_market_listings','donor_vehicle_json',"ALTER TABLE used_market_listings ADD COLUMN donor_vehicle_json MEDIUMTEXT NULL AFTER source_vehicle_id");
        kareta_ensure_column($pdo,'used_market_listings','defects_text',"ALTER TABLE used_market_listings ADD COLUMN defects_text TEXT NOT NULL AFTER description");
        kareta_ensure_column($pdo,'used_market_listings','exchange_note',"ALTER TABLE used_market_listings ADD COLUMN exchange_note VARCHAR(500) NOT NULL DEFAULT '' AFTER defects_text");
        kareta_ensure_column($pdo,'used_market_listings','delivery_modes_json',"ALTER TABLE used_market_listings ADD COLUMN delivery_modes_json VARCHAR(255) NOT NULL DEFAULT '[]' AFTER exchange_note");
        kareta_ensure_column($pdo,'used_market_listings','delivery_note',"ALTER TABLE used_market_listings ADD COLUMN delivery_note VARCHAR(500) NOT NULL DEFAULT '' AFTER delivery_modes_json");
        kareta_ensure_column($pdo,'used_market_listings','draft_step',"ALTER TABLE used_market_listings ADD COLUMN draft_step TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER status");
        kareta_ensure_column($pdo,'used_market_listings','published_at',"ALTER TABLE used_market_listings ADD COLUMN published_at DATETIME NULL AFTER draft_step");
    }
}
function kareta_used_market_images($raw): array {
    $rows=is_array($raw)?$raw:(preg_split('~[\r\n]+~',(string)$raw) ?: []);
    $out=[];$total=0;
    foreach($rows as $v){
        $v=trim((string)$v); if($v==='')continue;
        if(preg_match('~^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$~i',$v,$m)){
            $bytes=base64_decode($m[2],true); if($bytes===false||strlen($bytes)>900000)continue;
            $total+=strlen($bytes); if($total>5600000)break; $out[]=$v;
        } elseif(preg_match('~^(https://[^\s]+|/[A-Za-z0-9_./?=&%:-]+)$~i',$v)) $out[]=$v;
        if(count($out)>=8)break;
    }
    return $out;
}
function kareta_used_market_type(string $value): string {
    $value=strtolower(trim($value));
    return in_array($value,['new','used','restored','exchange'],true)?$value:'used';
}
function kareta_used_market_delivery($raw): array {
    if(is_string($raw)){$decoded=json_decode($raw,true);$raw=is_array($decoded)?$decoded:preg_split('~[,\s]+~',$raw);}
    if(!is_array($raw))$raw=[];$allowed=['pickup','courier','transport','seller_delivery'];$out=[];
    foreach($raw as $v){$v=trim((string)$v);if(in_array($v,$allowed,true)&&!in_array($v,$out,true))$out[]=$v;}
    return $out;
}
function kareta_used_market_donor($raw): array {
    if(is_string($raw)){$decoded=json_decode($raw,true);$raw=is_array($decoded)?$decoded:[];} if(!is_array($raw))$raw=[];
    return [
      'brand'=>mb_substr(trim((string)($raw['brand']??'')),0,80,'UTF-8'),
      'model'=>mb_substr(trim((string)($raw['model']??'')),0,100,'UTF-8'),
      'year'=>mb_substr(trim((string)($raw['year']??'')),0,16,'UTF-8'),
      'engine'=>mb_substr(trim((string)($raw['engine']??'')),0,80,'UTF-8'),
      'mileage'=>max(0,(int)($raw['mileage']??0)),
      'note'=>mb_substr(trim((string)($raw['note']??'')),0,300,'UTF-8'),
      'unknown'=>(bool)($raw['unknown']??false),
    ];
}
function kareta_used_market_row(array $r, int $viewerId=0): array {
    $images=json_decode((string)($r['images_json']??'[]'),true); if(!is_array($images))$images=[];
    $delivery=json_decode((string)($r['delivery_modes_json']??'[]'),true);if(!is_array($delivery))$delivery=[];
    $donor=json_decode((string)($r['donor_vehicle_json']??'[]'),true);if(!is_array($donor))$donor=[];
    return [
      'id'=>(string)$r['id'],'sellerUserId'=>(int)$r['seller_user_id'],'sellerName'=>(string)($r['seller_name']??'Пользователь'),
      'title'=>(string)$r['title'],'category'=>(string)$r['category'],'listingType'=>kareta_used_market_type((string)($r['listing_type']??'used')),
      'price'=>(float)$r['price'],'priceNegotiable'=>(bool)($r['price_negotiable']??false),'city'=>(string)$r['city'],'condition'=>(string)$r['condition_code'],'brand'=>(string)$r['brand'],
      'oem'=>(string)$r['oem_number'],'vehicle'=>(string)$r['vehicle'],'sourceVehicleId'=>(string)($r['source_vehicle_id']??''),'donorVehicle'=>$donor,
      'description'=>(string)$r['description'],'defects'=>(string)($r['defects_text']??''),'exchangeNote'=>(string)($r['exchange_note']??''),
      'deliveryModes'=>$delivery,'deliveryNote'=>(string)($r['delivery_note']??''),'images'=>$images,'image'=>(string)($images[0]??''),'status'=>(string)$r['status'],
      'draftStep'=>max(1,min(8,(int)($r['draft_step']??1))),'publishedAt'=>(string)($r['published_at']??''),
      'views'=>(int)$r['views'],'favorite'=>(bool)($r['is_favorite']??false),'isMine'=>$viewerId>0 && (int)$r['seller_user_id']===$viewerId,
      'createdAt'=>(string)$r['created_at'],'updatedAt'=>(string)$r['updated_at']
    ];
}
function kareta_used_market_list(PDO $pdo,array $q): void {
    kareta_used_market_ensure($pdo); $u=kareta_used_market_viewer($pdo,false); $uid=(int)($u['id']??0);
    $mine=(string)($q['mine']??'')==='1'; $favorites=(string)($q['favorites']??'')==='1';
    $where=["l.status='active'"]; $params=[];
    if($mine){ if(!$uid)kareta_json(['ok'=>false,'error'=>'auth_required'],401); $where=["l.seller_user_id=?","l.status<>'deleted'"]; $params[]=$uid; }
    if($favorites){ if(!$uid)kareta_json(['ok'=>false,'error'=>'auth_required'],401); $where[]='f.user_id IS NOT NULL'; }
    foreach(['category','city','condition'] as $key){$v=trim((string)($q[$key]??''));if($v!==''){$col=$key==='condition'?'condition_code':$key;$where[]="l.$col=?";$params[]=$v;}}
    $listingType=trim((string)($q['listingType']??$q['type']??'')); if($listingType!==''){ $where[]='l.listing_type=?'; $params[]=kareta_used_market_type($listingType); }
    $search=trim((string)($q['search']??'')); if($search!==''){ $where[]='(l.title LIKE ? OR l.description LIKE ? OR l.defects_text LIKE ? OR l.brand LIKE ? OR l.oem_number LIKE ? OR l.vehicle LIKE ? OR l.exchange_note LIKE ?)';$like='%'.$search.'%';array_push($params,$like,$like,$like,$like,$like,$like,$like); }
    $sort=(string)($q['sort']??'newest'); $order=$sort==='price_asc'?'l.price ASC':($sort==='price_desc'?'l.price DESC':($sort==='popular'?'l.views DESC, l.created_at DESC':($mine?'l.updated_at DESC':'l.created_at DESC')));
    $sql="SELECT l.*,COALESCE(u.name,u.phone,'Пользователь') seller_name,".($uid?"EXISTS(SELECT 1 FROM used_market_favorites fx WHERE fx.user_id={$uid} AND fx.listing_id=l.id)":"0")." is_favorite FROM used_market_listings l LEFT JOIN users u ON u.id=l.seller_user_id LEFT JOIN used_market_favorites f ON f.listing_id=l.id AND f.user_id=".($uid?:0)." WHERE ".implode(' AND ',$where)." ORDER BY $order LIMIT 200";
    $st=$pdo->prepare($sql);$st->execute($params);$rows=array_map(fn($r)=>kareta_used_market_row($r,$uid),$st->fetchAll()?:[]);
    kareta_json(['ok'=>true,'items'=>$rows,'total'=>count($rows)]);
}
function kareta_used_market_detail(PDO $pdo,array $q): void {
    kareta_used_market_ensure($pdo); $viewer=kareta_used_market_viewer($pdo,false); $uid=(int)($viewer['id']??0);
    $id=trim((string)($q['id']??'')); if($id==='')kareta_json(['ok'=>false,'error'=>'listing_id_required'],422);
    $sql="SELECT l.*,COALESCE(u.name,u.phone,'Пользователь') seller_name,".($uid?"EXISTS(SELECT 1 FROM used_market_favorites fx WHERE fx.user_id={$uid} AND fx.listing_id=l.id)":"0")." is_favorite FROM used_market_listings l LEFT JOIN users u ON u.id=l.seller_user_id WHERE l.id=? AND ".($uid?"(l.status='active' OR l.seller_user_id={$uid})":"l.status='active'")." LIMIT 1";
    $st=$pdo->prepare($sql);$st->execute([$id]);$raw=$st->fetch(PDO::FETCH_ASSOC);if(!$raw)kareta_json(['ok'=>false,'error'=>'listing_not_found'],404);
    $item=kareta_used_market_row($raw,$uid);$donor=is_array($item['donorVehicle']??null)?$item['donorVehicle']:[];
    $sourceId=trim((string)($raw['source_vehicle_id']??''));
    if($sourceId!==''&&kareta_table_exists($pdo,'client_vehicles')){
      try{$v=$pdo->prepare("SELECT id,title,brand,model,year_label,color,mileage_km FROM client_vehicles WHERE id=? LIMIT 1");$v->execute([$sourceId]);$row=$v->fetch(PDO::FETCH_ASSOC);if($row)$donor=['id'=>(string)$row['id'],'title'=>(string)($row['title']??''),'brand'=>(string)($row['brand']??''),'model'=>(string)($row['model']??''),'year'=>(string)($row['year_label']??''),'color'=>(string)($row['color']??''),'mileage'=>(int)($row['mileage_km']??0)];}catch(Throwable $_){}
    }
    $sellerStats=['activeListings'=>0,'soldListings'=>0];
    try{$q2=$pdo->prepare("SELECT SUM(status='active') active_count,SUM(status='sold') sold_count FROM used_market_listings WHERE seller_user_id=?");$q2->execute([(int)$raw['seller_user_id']]);$sr=$q2->fetch(PDO::FETCH_ASSOC)?:[];$sellerStats=['activeListings'=>(int)($sr['active_count']??0),'soldListings'=>(int)($sr['sold_count']??0)];}catch(Throwable $_){}
    $installations=[];
    try{
      if(kareta_table_exists($pdo,'work_order_part_reservations')&&kareta_table_exists($pdo,'work_posts')){
        $iq=$pdo->prepare("SELECT wp.id work_post_id,wp.vehicle_label,wp.service_label,wp.published_at,wp.master_name,wp.sto_name,pr.qty_issued,pr.qty_returned FROM work_order_part_reservations pr JOIN work_posts wp ON wp.order_id=pr.order_id AND wp.status='published' AND wp.visibility='public' AND wp.client_consent=1 WHERE pr.part_key IN (?,?) AND (COALESCE(pr.qty_issued,0)>COALESCE(pr.qty_returned,0) OR pr.status='issued') ORDER BY wp.published_at DESC LIMIT 20");
        $iq->execute([$id,'used_market:'.$id]);$installations=$iq->fetchAll(PDO::FETCH_ASSOC)?:[];
      }
    }catch(Throwable $_){$installations=[];}
    $item['donorVehicle']=$donor;$item['sellerStats']=$sellerStats;$item['realInstallations']=$installations;$item['reviews']=[];$item['reviewPolicy']='verified_transaction_required';
    kareta_json(['ok'=>true,'data'=>$item]);
}
function kareta_used_market_publication_error(array $x): ?array {
    $title=trim((string)($x['title']??''));$price=(float)($x['price']??0);
    if($title==='')return ['error'=>'title_required','message'=>'Укажите название детали'];
    if(mb_strlen($title)>180)return ['error'=>'title_too_long'];
    if(!is_finite($price)||$price<0)return ['error'=>'invalid_price'];
    if(trim((string)($x['description']??''))==='')return ['error'=>'description_required','message'=>'Добавьте описание детали'];
    if(trim((string)($x['city']??''))==='')return ['error'=>'city_required','message'=>'Укажите город'];
    if(!kareta_used_market_images($x['images']??[]))return ['error'=>'photo_required','message'=>'Добавьте хотя бы одну фотографию'];
    if(!kareta_used_market_delivery($x['deliveryModes']??[]))return ['error'=>'delivery_required','message'=>'Выберите хотя бы один способ получения'];
    $type=kareta_used_market_type((string)($x['listingType']??'used'));
    if(empty($x['priceNegotiable'])&&$type!=='exchange'&&$price<=0)return ['error'=>'price_required','message'=>'Укажите цену или выберите «по договорённости»'];
    if($type==='exchange'&&trim((string)($x['exchangeNote']??''))==='')return ['error'=>'exchange_note_required','message'=>'Укажите условия обмена'];
    if(in_array((string)($x['condition']??''),['fair','repair'],true)&&trim((string)($x['defects']??''))==='')return ['error'=>'defects_required','message'=>'Опишите известные дефекты'];
    return null;
}
function kareta_used_market_save(PDO $pdo,array $body): void {
    kareta_used_market_ensure($pdo);$u=kareta_used_market_actor($pdo);$uid=(int)$u['id'];$phone=trim((string)($u['phone']??''));$x=is_array($body['listing']??null)?$body['listing']:$body;
    $id=trim((string)($x['id']??''));$title=trim((string)($x['title']??''));$price=(float)($x['price']??0);$priceNegotiable=(bool)($x['priceNegotiable']??$x['price_negotiable']??false);$desc=trim((string)($x['description']??''));$listingType=kareta_used_market_type((string)($x['listingType']??$x['listing_type']??'used'));
    $publish=(string)($x['publicationAction']??$x['status']??'active')!=='draft';$draftStep=max(1,min(8,(int)($x['draftStep']??$x['draft_step']??1)));
    if(mb_strlen($title)>180)kareta_json(['ok'=>false,'error'=>'title_too_long'],422); if(!is_finite($price)||$price<0)kareta_json(['ok'=>false,'error'=>'invalid_price'],422);
    $exchangeNote=trim((string)($x['exchangeNote']??$x['exchange_note']??''));$defects=mb_substr(trim((string)($x['defects']??$x['defects_text']??'')),0,2000,'UTF-8');
    $condition=trim((string)($x['condition']??'good')); if(!in_array($condition,['new','excellent','good','fair','repair','restored'],true))$condition='good';
    if($listingType==='new')$condition='new'; if($listingType==='restored')$condition='restored';
    $images=kareta_used_market_images($x['images']??$x['image']??[]);$imagesJson=json_encode($images,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    $delivery=kareta_used_market_delivery($x['deliveryModes']??$x['delivery_modes']??[]);$deliveryJson=json_encode($delivery,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);$deliveryNote=mb_substr(trim((string)($x['deliveryNote']??$x['delivery_note']??'')),0,500,'UTF-8');
    $donor=kareta_used_market_donor($x['donorVehicle']??$x['donor_vehicle']??[]);$sourceId=trim((string)($x['sourceVehicleId']??$x['source_vehicle_id']??''));
    if($sourceId!==''&&kareta_table_exists($pdo,'client_vehicles')){
        $q=$pdo->prepare("SELECT id,brand,model,year_label,mileage_km,note FROM client_vehicles WHERE id=? AND active=1 AND (user_id=? OR user_phone=?) LIMIT 1");$q->execute([$sourceId,$uid,$phone]);$vr=$q->fetch(PDO::FETCH_ASSOC);
        if(!$vr)kareta_json(['ok'=>false,'error'=>'invalid_source_vehicle','message'=>'Автомобиль-донор не принадлежит текущему аккаунту'],422);
        $donor=['brand'=>(string)($vr['brand']??''),'model'=>(string)($vr['model']??''),'year'=>(string)($vr['year_label']??''),'engine'=>(string)($donor['engine']??''),'mileage'=>(int)($vr['mileage_km']??0),'note'=>(string)($donor['note']??''),'unknown'=>false];
    }
    $donorJson=json_encode($donor,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    if($publish){
        $error=kareta_used_market_publication_error(['title'=>$title,'description'=>$desc,'city'=>$x['city']??'','images'=>$images,'deliveryModes'=>$delivery,'price'=>$price,'priceNegotiable'=>$priceNegotiable,'listingType'=>$listingType,'exchangeNote'=>$exchangeNote,'condition'=>$condition,'defects'=>$defects]);
        if($error!==null)kareta_json(['ok'=>false]+$error,422);
    }
    if($id==='')$id='used_'.substr(hash('sha256',$uid.'|'.microtime(true).'|'.random_int(1,PHP_INT_MAX)),0,22);
    $exists=$pdo->prepare('SELECT seller_user_id FROM used_market_listings WHERE id=?');$exists->execute([$id]);$owner=$exists->fetchColumn(); if($owner!==false && (int)$owner!==$uid)kareta_json(['ok'=>false,'error'=>'forbidden'],403);
    $status=$publish?'active':'draft';$publishedAt=$publish?date('Y-m-d H:i:s'):null;
    $sql="INSERT INTO used_market_listings(id,seller_user_id,title,category,listing_type,price,price_negotiable,city,condition_code,brand,oem_number,vehicle,source_vehicle_id,donor_vehicle_json,description,defects_text,exchange_note,delivery_modes_json,delivery_note,images_json,status,draft_step,published_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),category=VALUES(category),listing_type=VALUES(listing_type),price=VALUES(price),price_negotiable=VALUES(price_negotiable),city=VALUES(city),condition_code=VALUES(condition_code),brand=VALUES(brand),oem_number=VALUES(oem_number),vehicle=VALUES(vehicle),source_vehicle_id=VALUES(source_vehicle_id),donor_vehicle_json=VALUES(donor_vehicle_json),description=VALUES(description),defects_text=VALUES(defects_text),exchange_note=VALUES(exchange_note),delivery_modes_json=VALUES(delivery_modes_json),delivery_note=VALUES(delivery_note),images_json=VALUES(images_json),status=VALUES(status),draft_step=VALUES(draft_step),published_at=IF(VALUES(status)='active',COALESCE(published_at,VALUES(published_at)),published_at),updated_at=NOW()";
    $pdo->prepare($sql)->execute([$id,$uid,$title,trim((string)($x['category']??'other'))?:'other',$listingType,$price,$priceNegotiable?1:0,trim((string)($x['city']??'')),$condition,trim((string)($x['brand']??'')),trim((string)($x['oem']??'')),trim((string)($x['vehicle']??'')),$sourceId,$donorJson,$desc,$defects,$exchangeNote,$deliveryJson,$deliveryNote,$imagesJson,$status,$publish?8:$draftStep,$publishedAt]);
    kareta_log_audit($pdo,'usedMarket.save',['id'=>$id,'sellerUserId'=>$uid,'listingType'=>$listingType,'status'=>$status,'draftStep'=>$draftStep]);kareta_json(['ok'=>true,'id'=>$id,'status'=>$status,'draftStep'=>$publish?8:$draftStep]);
}
function kareta_used_market_delete(PDO $pdo,array $body): void { kareta_used_market_ensure($pdo);$u=kareta_used_market_actor($pdo);$id=trim((string)($body['id']??''));$st=$pdo->prepare("UPDATE used_market_listings SET status='deleted',updated_at=NOW() WHERE id=? AND seller_user_id=?");$st->execute([$id,(int)$u['id']]);if(!$st->rowCount())kareta_json(['ok'=>false,'error'=>'not_found'],404);kareta_json(['ok'=>true]); }
function kareta_used_market_favorite(PDO $pdo,array $body): void { kareta_used_market_ensure($pdo);$u=kareta_used_market_actor($pdo);$id=trim((string)($body['id']??''));$active=(bool)($body['active']??true);if($active)$pdo->prepare('INSERT IGNORE INTO used_market_favorites(user_id,listing_id) VALUES(?,?)')->execute([(int)$u['id'],$id]);else $pdo->prepare('DELETE FROM used_market_favorites WHERE user_id=? AND listing_id=?')->execute([(int)$u['id'],$id]);kareta_json(['ok'=>true,'active'=>$active]); }
function kareta_used_market_view(PDO $pdo,array $body): void { kareta_used_market_ensure($pdo);$id=trim((string)($body['id']??''));$pdo->prepare("UPDATE used_market_listings SET views=views+1 WHERE id=? AND status='active'")->execute([$id]);kareta_json(['ok'=>true]); }
function kareta_used_market_status(PDO $pdo,array $body): void {
    kareta_used_market_ensure($pdo); $u=kareta_used_market_actor($pdo); $id=trim((string)($body['id']??'')); $status=trim((string)($body['status']??''));
    if(!in_array($status,['active','draft','sold','archived'],true)) kareta_json(['ok'=>false,'error'=>'invalid_status'],422);
    $pdo->beginTransaction();
    try {
        $st=$pdo->prepare("SELECT * FROM used_market_listings WHERE id=? AND seller_user_id=? AND status<>'deleted' FOR UPDATE");$st->execute([$id,(int)$u['id']]);$row=$st->fetch(PDO::FETCH_ASSOC);
        if(!$row){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'not_found'],404);}
        if($status==='active'){
            $error=kareta_used_market_publication_error(kareta_used_market_row($row,(int)$u['id']));
            if($error!==null){$pdo->rollBack();kareta_json(['ok'=>false]+$error,422);}
        }
        if((string)$row['status']!==$status){
            $st=$pdo->prepare("UPDATE used_market_listings SET status=?,published_at=IF(?='active',COALESCE(published_at,NOW()),published_at),updated_at=NOW() WHERE id=? AND seller_user_id=?");$st->execute([$status,$status,$id,(int)$u['id']]);
        }
        $pdo->commit();
    } catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
    kareta_json(['ok'=>true,'status'=>$status]);
}
