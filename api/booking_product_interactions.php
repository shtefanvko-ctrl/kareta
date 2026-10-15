<?php
declare(strict_types=1);

function kareta_booking_intervals_overlap(int $start,int $end,int $otherStart,int $otherEnd): bool{
 return $start<$otherEnd && $end>$otherStart;
}
function kareta_booking_candidate_slots(DateTimeImmutable $date,DateTimeImmutable $now,array $busy,int $minutes): array{
 $slots=[];$duration=max(30,$minutes);
 for($h=9;$h<=17;$h++)foreach([0,30] as $m){
   $candidate=$date->setTime($h,$m);if($candidate<=$now)continue;
   $start=$candidate->getTimestamp();$end=$start+$duration*60;
   foreach($busy as $period)if(kareta_booking_intervals_overlap($start,$end,(int)$period[0],(int)$period[1]))continue 2;
   $slots[]=['value'=>$candidate->format('H:i'),'label'=>$candidate->format('H:i')];
 }
 return $slots;
}
function kareta_booking_slots(?PDO $pdo,array $in):void{
 if(!$pdo)kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
 $tz=new DateTimeZone('Asia/Almaty');
 $now=new DateTimeImmutable('now',$tz);
 $date=trim((string)($in['date']??''));
 if($date==='')$date=$now->format('Y-m-d');
 if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date))kareta_json(['ok'=>false,'error'=>'invalid_date'],422);
 $dateObject=DateTimeImmutable::createFromFormat('!Y-m-d',$date,$tz);
 if(!$dateObject||$dateObject->format('Y-m-d')!==$date)kareta_json(['ok'=>false,'error'=>'invalid_date'],422);
 $requestedMaster=trim((string)($in['masterId']??''));
 $masterId=$requestedMaster;
 $masters=[];
 try{$q=$pdo->query("SELECT id,name,city,active FROM masters WHERE active=1 ORDER BY name LIMIT 50");$masters=$q->fetchAll(PDO::FETCH_ASSOC)?:[];}catch(Throwable $e){kareta_json(['ok'=>false,'error'=>'booking_slots_unavailable'],503);}
 if($masterId==='')kareta_json(['ok'=>false,'error'=>'master_required'],422);
 if($requestedMaster!==''&&!array_filter($masters,static fn($row)=>(string)($row['id']??'')===$masterId)){
    $st=$pdo->prepare("SELECT id FROM masters WHERE BINARY id=BINARY ? AND active=1 LIMIT 1");
    $st->execute([$masterId]);
    if(!$st->fetchColumn())kareta_json(['ok'=>false,'error'=>'master_not_found','message'=>'Мастер недоступен'],404);
 }
 if(str_starts_with($masterId,'demo-master-'))kareta_json(['ok'=>false,'error'=>'demo_master_unbookable','message'=>'Демонстрационный мастер недоступен для записи'],422);
 $serviceId=trim((string)($in['serviceId']??''));
 $duration=120;
 if($serviceId==='')kareta_json(['ok'=>false,'error'=>'service_required'],422);
 if($masterId!==''){
    $st=$pdo->prepare("SELECT duration_min FROM service_offers WHERE owner_type='master' AND BINARY owner_entity_id=BINARY ? AND BINARY service_id=BINARY ? AND active=1 AND booking_enabled=1 AND availability_status<>'paused' AND moderation_status='approved' LIMIT 1");
    $st->execute([$masterId,$serviceId]);$offer=$st->fetch(PDO::FETCH_ASSOC);
    if(!$offer)kareta_json(['ok'=>false,'error'=>'service_offer_unavailable','message'=>'Услуга мастера недоступна'],422);
    $duration=max(30,(int)($offer['duration_min']?:120));
 }
 $busy=[];
 if($masterId!==''){
    try{$st=$pdo->prepare("SELECT time,COALESCE(estimated_duration_min,120) AS duration FROM orders WHERE master_id=? AND date=? AND status NOT IN ('cancelled','deleted') AND time<>''");
    $st->execute([$masterId,$date]);
    foreach($st->fetchAll(PDO::FETCH_ASSOC) as $row){
      $start=(new DateTimeImmutable($date.' '.(string)$row['time'],$tz))->getTimestamp();
      if($start)$busy[]=[$start,$start+max(30,(int)$row['duration'])*60];
    }
    }catch(Throwable $e){kareta_json(['ok'=>false,'error'=>'booking_slots_unavailable'],503);}
 }
 $slots=kareta_booking_candidate_slots($dateObject,$now,$busy,$duration);
 kareta_json(['ok'=>true,'data'=>['date'=>$date,'masterId'=>$masterId,'masters'=>$masters,'slots'=>$slots]]);
}
function kareta_product_review_submit(?PDO $pdo,array $b):void{if(!$pdo)_no_db();$u=function_exists('kareta_resolve_api_actor')?kareta_resolve_api_actor($pdo):(kareta_session_user()?:[]);$pid=trim((string)($b['productId']??''));$rating=max(1,min(5,(int)($b['rating']??5)));$text=kareta_clean_text($b['text']??'',2000);if($pid===''||$text==='')kareta_json(['ok'=>false,'error'=>'product_and_text_required'],422);$id='pr_'.substr(sha1($pid.'|'.($u['id']??0)),0,24);$st=$pdo->prepare("INSERT INTO product_reviews(id,product_id,user_id,author_name,rating,body,status,created_at,updated_at) VALUES(?,?,?,?,? ,?,'published',NOW(),NOW()) ON DUPLICATE KEY UPDATE rating=VALUES(rating),body=VALUES(body),author_name=VALUES(author_name),updated_at=NOW()");$st->execute([$id,$pid,(int)($u['id']??0)?:null,kareta_clean_text($u['name']??'Клиент',160),$rating,$text]);kareta_json(['ok'=>true,'id'=>$id]);}
function kareta_product_question_submit(?PDO $pdo,array $b):void{if(!$pdo)_no_db();$u=function_exists('kareta_resolve_api_actor')?kareta_resolve_api_actor($pdo):(kareta_session_user()?:[]);$pid=trim((string)($b['productId']??''));$text=kareta_clean_text($b['text']??'',2000);if($pid===''||$text==='')kareta_json(['ok'=>false,'error'=>'product_and_text_required'],422);$id='pq_'.substr(sha1($pid.'|'.($u['id']??0).'|'.microtime(true)),0,24);$st=$pdo->prepare("INSERT INTO product_questions(id,product_id,user_id,author_name,body,status,created_at) VALUES(?,?,?,?,?,'published',NOW())");$st->execute([$id,$pid,(int)($u['id']??0)?:null,kareta_clean_text($u['name']??'Пользователь',160),$text]);kareta_json(['ok'=>true,'id'=>$id]);}
