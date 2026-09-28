<?php
declare(strict_types=1);

function kareta_client_exchange_owner(PDO $pdo): array {
    $actor=kareta_session_user()??[];$uid=(int)($actor['id']??0);$phone=_actor_phone();
    if($uid<=0&&$phone==='') kareta_json(['ok'=>false,'error'=>'auth_required'],401);
    return ['userId'=>$uid,'phone'=>$phone];
}
function kareta_client_exchange_owner_where(array $owner,string $alias='o'): array {
    $w=[];$p=[];
    if($owner['userId']>0){$w[]="$alias.client_user_id=?";$p[]=$owner['userId'];}
    if($owner['phone']!==''){$w[]="$alias.client_phone=?";$p[]=$owner['phone'];}
    return ['sql'=>'('.implode(' OR ',$w).')','params'=>$p];
}
function kareta_client_exchange_scale_dashboard(PDO $pdo,array $body): void {
    $owner=kareta_client_exchange_owner($pdo);$ow=kareta_client_exchange_owner_where($owner);
    $limit=max(5,min(50,(int)($body['limit']??20)));$page=max(1,(int)($body['page']??1));$offset=($page-1)*$limit;
    $status=preg_replace('/[^a-z_]/','',(string)($body['status']??'all'));
    $where=[$ow['sql']];$params=$ow['params'];
    if($status==='open')$where[]="o.status IN ('new','waiting_responses')";
    elseif($status==='active')$where[]="o.status IN ('process','accepted','assigned','in_progress')";
    elseif($status==='completed')$where[]="o.status IN ('completed','done','delivered','closed')";
    $whereSql=implode(' AND ',$where);
    $stCount=$pdo->prepare("SELECT COUNT(*) FROM orders o WHERE $whereSql");$stCount->execute($params);$total=(int)$stCount->fetchColumn();
    $sql="SELECT o.id,o.num,o.status,o.service_names,o.client_car,o.created_at,o.exchange_status,o.exchange_round,o.exchange_published_at,o.exchange_deadline_at,o.exchange_max_responses,o.exchange_budget_from,o.exchange_budget_to,o.master_id,o.master_name,
      COUNT(CASE WHEN r.active=1 AND r.response_status NOT IN ('declined','cancelled','withdrawn') THEN 1 END) responses_count,
      MIN(CASE WHEN r.active=1 AND r.response_status IN ('pending','viewed','accepted') THEN NULLIF(r.price_from,0) END) min_offer,
      MAX(CASE WHEN r.active=1 AND r.response_status IN ('pending','viewed','accepted') THEN GREATEST(r.price_from,r.price_to) END) max_offer,
      MAX(CASE WHEN r.response_status='accepted' THEN r.id ELSE NULL END) accepted_response_id
      FROM orders o LEFT JOIN master_exchange_responses r ON r.request_id=o.id
      WHERE $whereSql GROUP BY o.id ORDER BY o.created_at DESC LIMIT $limit OFFSET $offset";
    $st=$pdo->prepare($sql);$st->execute($params);$orders=$st->fetchAll()?:[];
    $ids=array_values(array_filter(array_map(fn($r)=>(string)$r['id'],$orders)));$responses=[];
    if($ids){$ph=implode(',',array_fill(0,count($ids),'?'));$rows=kareta_try_query_all($pdo,"SELECT r.id,r.request_id,r.master_id,r.master_user_id,r.price_from,r.price_to,r.start_time,r.duration_text,r.warranty_text,r.comment,r.response_status,r.updated_at,COALESCE(NULLIF(m.name,''),NULLIF(u.name,''),'Мастер') master_name,COALESCE(m.rating,0) rating,COALESCE(m.reviews_count,0) reviews_count,COALESCE(NULLIF(m.spec,''),NULLIF(u.spec,''),'') master_spec,COALESCE(NULLIF(sp.name,''),'') sto_name FROM master_exchange_responses r LEFT JOIN masters m ON m.id=r.master_id LEFT JOIN users u ON u.id=r.master_user_id LEFT JOIN sto_profiles sp ON sp.id=m.sto_id WHERE r.active=1 AND r.request_id IN ($ph) AND r.response_status NOT IN ('cancelled','withdrawn') ORDER BY r.request_id, FIELD(r.response_status,'accepted','pending','viewed','declined'), r.price_from ASC, m.rating DESC, r.updated_at DESC",$ids,[],'CLIENT_EXCHANGE_SCALE_RESPONSES');
      foreach($rows as $r){$responses[(string)$r['request_id']][]=['id'=>(string)$r['id'],'masterId'=>(string)$r['master_id'],'masterName'=>(string)$r['master_name'],'masterSpec'=>(string)$r['master_spec'],'stoName'=>(string)$r['sto_name'],'rating'=>(float)$r['rating'],'reviewsCount'=>(int)$r['reviews_count'],'priceFrom'=>(int)$r['price_from'],'priceTo'=>(int)$r['price_to'],'startTime'=>(string)$r['start_time'],'duration'=>(string)$r['duration_text'],'warranty'=>(string)$r['warranty_text'],'comment'=>(string)$r['comment'],'status'=>(string)$r['response_status'],'updatedAt'=>(string)$r['updated_at']];}
    }
    $statsSql="SELECT COUNT(*) total, SUM(status IN ('new','waiting_responses')) open_count, SUM(status IN ('process','accepted','assigned','in_progress')) active_count, SUM(status IN ('completed','done','delivered','closed')) completed_count FROM orders o WHERE {$ow['sql']}";$ss=$pdo->prepare($statsSql);$ss->execute($ow['params']);$stats=$ss->fetch()?:[];
    $out=[];foreach($orders as $o){$id=(string)$o['id'];$out[]=['id'=>$id,'number'=>(int)($o['num']??0),'status'=>(string)$o['status'],'serviceNames'=>(string)$o['service_names'],'car'=>(string)$o['client_car'],'createdAt'=>(string)$o['created_at'],'exchangeStatus'=>(string)($o['exchange_status']??'open'),'exchangeRound'=>(int)($o['exchange_round']??1),'publishedAt'=>(string)($o['exchange_published_at']??''),'deadlineAt'=>(string)($o['exchange_deadline_at']??''),'maxResponses'=>(int)($o['exchange_max_responses']??20),'budgetFrom'=>(float)($o['exchange_budget_from']??0),'budgetTo'=>(float)($o['exchange_budget_to']??0),'responsesCount'=>(int)$o['responses_count'],'minOffer'=>(float)($o['min_offer']??0),'maxOffer'=>(float)($o['max_offer']??0),'masterId'=>(string)($o['master_id']??''),'masterName'=>(string)($o['master_name']??''),'responses'=>array_slice($responses[$id]??[],0,12)];}
    kareta_json(['ok'=>true,'orders'=>$out,'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total,'pages'=>(int)ceil($total/$limit)],'stats'=>['total'=>(int)($stats['total']??0),'open'=>(int)($stats['open_count']??0),'active'=>(int)($stats['active_count']??0),'completed'=>(int)($stats['completed_count']??0)]]);
}
function kareta_client_exchange_scale_republish(PDO $pdo,array $body): void {
    $id=trim((string)($body['orderId']??''));if($id==='')kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    $days=max(1,min(14,(int)($body['days']??3)));$max=max(3,min(50,(int)($body['maxResponses']??20)));
    $pdo->beginTransaction();try{$order=client_exchange_resolve_owned_order($pdo,$id);if(!in_array((string)$order['status'],['new','waiting_responses'],true)){throw new RuntimeException('order_not_open');}
      $pdo->prepare("UPDATE orders SET status='waiting_responses',exchange_status='open',exchange_round=COALESCE(exchange_round,0)+1,exchange_published_at=NOW(),exchange_deadline_at=DATE_ADD(NOW(),INTERVAL ? DAY),exchange_max_responses=? WHERE id=?")->execute([$days,$max,$id]);
      $pdo->prepare("UPDATE master_exchange_responses SET active=0,response_status=CASE WHEN response_status='accepted' THEN response_status ELSE 'withdrawn' END WHERE request_id=? AND response_status<>'accepted'")->execute([$id]);
      $pdo->commit();try{kareta_write_event($pdo,$id,'exchange_republished',['days'=>$days,'maxResponses'=>$max]);}catch(Throwable $_){}
      kareta_json(['ok'=>true,'orderId'=>$id,'round'=>(int)($order['exchange_round']??1)+1]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();kareta_json(['ok'=>false,'error'=>$e->getMessage()==='order_not_open'?'order_not_open':'exchange_republish_failed'],409);}
}
