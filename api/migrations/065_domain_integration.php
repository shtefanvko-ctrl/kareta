<?php
return [
 'version'=>65,
 'note'=>'Domain integration for vehicles, work requests, work orders, relations and deterministic timeline',
 'run'=>static function(PDO $pdo):void {
  $hasColumn=static function(PDO $pdo,string $table,string $column):bool{$s=$pdo->prepare("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1");$s->execute([$table,$column]);return(bool)$s->fetchColumn();};
  if(!$hasColumn($pdo,'domain_events','event_key')){
   $pdo->exec("ALTER TABLE domain_events ADD COLUMN event_key VARCHAR(191) NULL AFTER id");
   $pdo->exec("ALTER TABLE domain_events ADD UNIQUE KEY uq_domain_event_key(event_key)");
  }
  $domainTitle=static function(string $value,int $limit=255):string {
   $value=trim(preg_replace('/\s+/u',' ',$value) ?? $value);
   if(function_exists('mb_substr')) return mb_substr($value,0,$limit,'UTF-8');
   return substr($value,0,$limit);
  };
  $entity=$pdo->prepare("INSERT INTO domain_entities(entity_type,entity_key,owner_user_id,organization_id,status,schema_version,title,payload_json) VALUES(?,?,?,?,?,2,?,?) ON DUPLICATE KEY UPDATE owner_user_id=VALUES(owner_user_id),organization_id=VALUES(organization_id),status=VALUES(status),schema_version=2,title=VALUES(title),payload_json=VALUES(payload_json)");
  $relation=$pdo->prepare("INSERT INTO domain_relations(source_type,source_key,relation_type,target_type,target_key,status,schema_version,payload_json) VALUES(?,?,?,?,?,'active',2,?) ON DUPLICATE KEY UPDATE status='active',schema_version=2,payload_json=VALUES(payload_json)");
  $event=$pdo->prepare("INSERT INTO domain_events(event_key,event_type,aggregate_type,aggregate_key,actor_user_id,organization_id,schema_version,payload_json,occurred_at) VALUES(?,?,?,?,?,?,2,?,?) ON DUPLICATE KEY UPDATE event_type=VALUES(event_type),actor_user_id=VALUES(actor_user_id),organization_id=VALUES(organization_id),schema_version=2,payload_json=VALUES(payload_json),occurred_at=VALUES(occurred_at)");

  if(function_exists('kareta_table_exists') && kareta_table_exists($pdo,'client_vehicles')){
   $rows=$pdo->query("SELECT * FROM client_vehicles")->fetchAll(PDO::FETCH_ASSOC)?:[];
   foreach($rows as $v){
    $id=(string)$v['id'];$owner=(int)($v['user_id']??0)?:null;$active=(int)($v['active']??1)===1?'active':'archived';
    $title=trim((string)($v['title']??''));if($title==='')$title=trim(((string)($v['brand']??'')).' '.((string)($v['model']??'')));if($title==='')$title='Автомобиль '.$id;$title=$domainTitle($title,255);
    $payload=['source'=>'client_vehicles','brand'=>$v['brand']??'','model'=>$v['model']??'','year'=>$v['year_label']??'','plate'=>$v['plate']??'','vin'=>$v['vin']??'','color'=>$v['color']??'','mileageKm'=>(int)($v['mileage_km']??0),'clientId'=>$v['client_id']??''];
    $entity->execute(['vehicle',$id,$owner,null,$active,$title,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
    if($owner){$relation->execute(['person',(string)$owner,'owns','vehicle',$id,json_encode(['source'=>'client_vehicles'],JSON_UNESCAPED_UNICODE)]);}
   }
  }

  if(function_exists('kareta_table_exists') && kareta_table_exists($pdo,'orders')){
   $rows=$pdo->query("SELECT * FROM orders")->fetchAll(PDO::FETCH_ASSOC)?:[];
   foreach($rows as $o){
    $id=(string)$o['id'];$owner=(int)($o['client_user_id']??0)?:null;$master=(int)($o['master_user_id']??0)?:null;$status=(string)($o['status']??'new');$org=(string)($o['sto_id']??'')?:null;
    $title=trim((string)($o['service_names']??''));if($title==='')$title=trim((string)($o['notes']??''));if($title==='')$title='Заявка '.$id;$title=$domainTitle($title,240);
    $common=['source'=>'orders','legacyId'=>$id,'priority'=>$o['priority']??'normal','category'=>$o['category']??'service','vehicleId'=>$o['client_vehicle_id']??'','vehicleTitle'=>$o['vehicle_title']??($o['client_car']??''),'masterUserId'=>$master,'masterId'=>$o['master_id']??'','stoId'=>$o['sto_id']??'','price'=>(int)($o['price']??0),'date'=>$o['date']??'','time'=>$o['time']??''];
    $entity->execute(['work_request',$id,$owner,$org,$status,$domainTitle('Заявка: '.$title,255),json_encode($common+['domainRole'=>'request'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
    $entity->execute(['work_order',$id,$owner,$org,$status,$domainTitle('Заказ-наряд: '.$title,255),json_encode($common+['domainRole'=>'work_order','stages'=>json_decode((string)($o['stages']??'[]'),true)?:[]],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
    $relation->execute(['work_request',$id,'produces','work_order',$id,json_encode(['source'=>'orders'],JSON_UNESCAPED_UNICODE)]);
    if($owner){$relation->execute(['person',(string)$owner,'created','work_request',$id,json_encode(['source'=>'orders'],JSON_UNESCAPED_UNICODE)]);$relation->execute(['person',(string)$owner,'owns','work_order',$id,json_encode(['source'=>'orders'],JSON_UNESCAPED_UNICODE)]);}
    $vehicle=(string)($o['client_vehicle_id']??'');if($vehicle!==''){$relation->execute(['work_request',$id,'for_vehicle','vehicle',$vehicle,json_encode(['source'=>'orders'],JSON_UNESCAPED_UNICODE)]);$relation->execute(['work_order',$id,'for_vehicle','vehicle',$vehicle,json_encode(['source'=>'orders'],JSON_UNESCAPED_UNICODE)]);}
    if($master){$relation->execute(['person',(string)$master,'assigned_to','work_order',$id,json_encode(['source'=>'orders','masterId'=>$o['master_id']??''],JSON_UNESCAPED_UNICODE)]);}
    if($org){$relation->execute(['organization',$org,'handles','work_order',$id,json_encode(['source'=>'orders'],JSON_UNESCAPED_UNICODE)]);}
    $created=(string)($o['created_at']??date('Y-m-d H:i:s'));
    $event->execute(['orders:'.$id.':created','work_request.created','work_request',$id,$owner,$org,json_encode(['source'=>'orders','status'=>$status],JSON_UNESCAPED_UNICODE),$created]);
    $event->execute(['orders:'.$id.':status:'.$status,'work_order.status.'.$status,'work_order',$id,$master?:$owner,$org,json_encode(['source'=>'orders','status'=>$status],JSON_UNESCAPED_UNICODE),$created]);
    if(!empty($o['completed_at']))$event->execute(['orders:'.$id.':completed','work_order.completed','work_order',$id,$master?:$owner,$org,json_encode(['source'=>'orders'],JSON_UNESCAPED_UNICODE),(string)$o['completed_at']]);
   }
  }
 }
];
