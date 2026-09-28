<?php
declare(strict_types=1);
function kareta_vehicle_actor(): array { return kareta_session_user() ?: []; }
function kareta_vehicle_require(PDO $pdo,string $id,bool $write=false): array {
 $st=$pdo->prepare("SELECT * FROM client_vehicles WHERE id=? AND active=1 LIMIT 1");$st->execute([$id]);$v=$st->fetch(PDO::FETCH_ASSOC);if(!$v)kareta_json(['ok'=>false,'error'=>'vehicle_not_found'],404);
 $u=kareta_vehicle_actor();$role=(string)($u['role']??'');$uid=(int)($u['id']??0);$phone=(string)($u['phone']??'');
 $allowed=in_array($role,['admin','owner'],true)||(int)($v['user_id']??0)===$uid||($phone!==''&&(string)($v['user_phone']??'')===$phone);
 if(!$allowed && in_array($role,['master','sto'],true)){
  $q=$pdo->prepare("SELECT COUNT(*) FROM orders WHERE client_vehicle_id=? AND (master_user_id=? OR master_id IN (SELECT id FROM masters WHERE user_id=?))");$q->execute([$id,$uid,$uid]);$allowed=(int)$q->fetchColumn()>0;
 }
 if(!$allowed)kareta_json(['ok'=>false,'error'=>'vehicle_forbidden'],403);
 if($write && !in_array($role,['client','master','sto','admin','owner'],true))kareta_json(['ok'=>false,'error'=>'vehicle_write_forbidden'],403);
 return $v;
}
function kareta_vehicle_json($value): array { if(is_array($value))return $value; $d=json_decode((string)$value,true);return is_array($d)?$d:[]; }
function kareta_vehicle_child_record_scope(PDO $pdo,string $table,string $id,string $vehicleId): void {
 if($id===''||!in_array($table,['vehicle_recommendations','vehicle_issues'],true))return;
 $st=$pdo->prepare("SELECT vehicle_id FROM `{$table}` WHERE id=? LIMIT 1");$st->execute([$id]);$stored=$st->fetchColumn();
 if($stored!==false&&!hash_equals($vehicleId,(string)$stored))kareta_json(['ok'=>false,'error'=>'record_forbidden'],403);
}
function kareta_vehicle_detail(PDO $pdo,array $q): void {
 $id=trim((string)($q['id']??''));$v=kareta_vehicle_require($pdo,$id,false);
 foreach(['vehicle_history_events','vehicle_documents','vehicle_issues','vehicle_recommendations'] as $t){ if(!kareta_table_exists($pdo,$t))kareta_json(['ok'=>false,'error'=>'vehicle_schema_pending','table'=>$t],503); }
 $st=$pdo->prepare("SELECT * FROM vehicle_history_events WHERE vehicle_id=? ORDER BY event_at DESC,id DESC LIMIT 200");$st->execute([$id]);$history=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
 $st=$pdo->prepare("SELECT * FROM vehicle_documents WHERE vehicle_id=? ORDER BY expires_at IS NULL,expires_at,title");$st->execute([$id]);$docs=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
 $st=$pdo->prepare("SELECT * FROM vehicle_issues WHERE vehicle_id=? ORDER BY status='open' DESC,detected_at DESC");$st->execute([$id]);$issues=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
 $st=$pdo->prepare("SELECT * FROM vehicle_recommendations WHERE vehicle_id=? ORDER BY status='active' DESC,priority='high' DESC,due_date IS NULL,due_date");$st->execute([$id]);$recs=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
 $st=$pdo->prepare("SELECT wm.id,wm.order_id,wm.stage_key,wm.media_type,wm.file_url,wm.caption,wm.created_at FROM work_order_media wm JOIN orders o ON o.id=wm.order_id WHERE o.client_vehicle_id=? ORDER BY wm.created_at DESC LIMIT 100");$st->execute([$id]);$media=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
 $st=$pdo->prepare("SELECT id,num,status,service_names,price,master_name,created_at,completed_at FROM orders WHERE client_vehicle_id=? ORDER BY created_at DESC LIMIT 100");$st->execute([$id]);$orders=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
 $maintenance=[];$expenses=[];$warranties=[];$installedParts=[];
 if(kareta_table_exists($pdo,'vehicle_maintenance_items')){ $st=$pdo->prepare("SELECT * FROM vehicle_maintenance_items WHERE vehicle_id=? AND status<>'deleted' ORDER BY next_due_at IS NULL,next_due_at,next_due_mileage_km IS NULL,next_due_mileage_km");$st->execute([$id]);$maintenance=$st->fetchAll(PDO::FETCH_ASSOC)?:[]; }
 if(kareta_table_exists($pdo,'vehicle_expenses')){ $st=$pdo->prepare("SELECT * FROM vehicle_expenses WHERE vehicle_id=? ORDER BY expense_date DESC,created_at DESC LIMIT 300");$st->execute([$id]);$expenses=$st->fetchAll(PDO::FETCH_ASSOC)?:[]; }
 if(kareta_table_exists($pdo,'vehicle_warranties')){ $st=$pdo->prepare("SELECT * FROM vehicle_warranties WHERE vehicle_id=? AND status<>'deleted' ORDER BY warranty_until IS NULL,warranty_until");$st->execute([$id]);$warranties=$st->fetchAll(PDO::FETCH_ASSOC)?:[]; }
 if(kareta_table_exists($pdo,'work_order_part_reservations')){
  try{
   $hasIssued=kareta_column_exists($pdo,'work_order_part_reservations','qty_issued');
   $hasReturned=kareta_column_exists($pdo,'work_order_part_reservations','qty_returned');
   $hasStockStatus=kareta_column_exists($pdo,'work_order_part_reservations','stock_status');
   $issuedExpr=$hasIssued?'pr.qty_issued':'0 AS qty_issued';$returnedExpr=$hasReturned?'pr.qty_returned':'0 AS qty_returned';$stockExpr=$hasStockStatus?'pr.stock_status':"'' AS stock_status";
   $installedWhere=$hasIssued?"(pr.status='issued' OR COALESCE(pr.qty_issued,0)>".($hasReturned?'COALESCE(pr.qty_returned,0)':'0').")":"pr.status='issued'";
   $sql="SELECT pr.id,pr.order_id,pr.part_key,pr.part_name,pr.sku,pr.oem,pr.supplier_label,pr.qty_requested,pr.qty_reserved,{$issuedExpr},{$returnedExpr},pr.unit_price,pr.status,{$stockExpr},pr.updated_at,o.completed_at,o.created_at FROM work_order_part_reservations pr INNER JOIN orders o ON BINARY o.id=BINARY pr.order_id WHERE BINARY o.client_vehicle_id=BINARY ? AND {$installedWhere} ORDER BY COALESCE(o.completed_at,pr.updated_at,o.created_at) DESC,pr.updated_at DESC LIMIT 200";
   $st=$pdo->prepare($sql);$st->execute([$id]);$installedParts=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
  }catch(Throwable $e){$installedParts=[];if(function_exists('kareta_log_error'))kareta_log_error('VEHICLE_PARTS_READ_FAIL',$e->getMessage());}
 }
 $orderSpent=array_sum(array_map(static fn($r)=>(float)($r['price']??0),$orders));
 $extraSpent=array_sum(array_map(static fn($r)=>(float)($r['amount']??0),$expenses));
 $completed=count(array_filter($orders,static fn($r)=>in_array((string)($r['status']??''),['completed','done','closed','issued'],true)));
 $metrics=['orders'=>count($orders),'completedOrders'=>$completed,'spent'=>$orderSpent+$extraSpent,'orderSpent'=>$orderSpent,'extraSpent'=>$extraSpent,'openIssues'=>count(array_filter($issues,static fn($r)=>(string)$r['status']==='open')),'activeRecommendations'=>count(array_filter($recs,static fn($r)=>(string)$r['status']==='active')),'maintenance'=>count($maintenance),'documents'=>count($docs),'media'=>count($media)];
 kareta_json(['ok'=>true,'data'=>['vehicle'=>$v,'history'=>$history,'documents'=>$docs,'issues'=>$issues,'recommendations'=>$recs,'media'=>$media,'orders'=>$orders,'maintenance'=>$maintenance,'expenses'=>$expenses,'warranties'=>$warranties,'installedParts'=>$installedParts,'metrics'=>$metrics]]);
}
function kareta_vehicle_recommendation_save(PDO $pdo,array $b): void {
 $vehicleId=trim((string)($b['vehicleId']??''));kareta_vehicle_require($pdo,$vehicleId,true);$title=trim((string)($b['title']??''));if($title==='')kareta_json(['ok'=>false,'error'=>'title_required'],422);
 $id=trim((string)($b['id']??''))?:'vr_'.bin2hex(random_bytes(8));kareta_vehicle_child_record_scope($pdo,'vehicle_recommendations',$id,$vehicleId);$pdo->prepare("INSERT INTO vehicle_recommendations(id,vehicle_id,source_order_id,title,description,due_date,due_mileage_km,priority,status) VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),description=VALUES(description),due_date=VALUES(due_date),due_mileage_km=VALUES(due_mileage_km),priority=VALUES(priority),status=VALUES(status)")->execute([$id,$vehicleId,trim((string)($b['sourceOrderId']??'')),$title,trim((string)($b['description']??'')),($b['dueDate']??null)?:null,(int)($b['dueMileageKm']??0)?:null,in_array(($b['priority']??''),['low','normal','high'],true)?$b['priority']:'normal',in_array(($b['status']??''),['active','done','dismissed'],true)?$b['status']:'active']);kareta_json(['ok'=>true,'id'=>$id]);
}
function kareta_vehicle_issue_save(PDO $pdo,array $b): void {
 $vehicleId=trim((string)($b['vehicleId']??''));kareta_vehicle_require($pdo,$vehicleId,true);$title=trim((string)($b['title']??''));if($title==='')kareta_json(['ok'=>false,'error'=>'title_required'],422);$id=trim((string)($b['id']??''))?:'vi_'.bin2hex(random_bytes(8));kareta_vehicle_child_record_scope($pdo,'vehicle_issues',$id,$vehicleId);
 $pdo->prepare("INSERT INTO vehicle_issues(id,vehicle_id,order_id,code_value,title,description,status,severity,detected_at,resolved_at,resolution) VALUES(?,?,?,?,?,?,?,?,NOW(),?,?) ON DUPLICATE KEY UPDATE code_value=VALUES(code_value),title=VALUES(title),description=VALUES(description),status=VALUES(status),severity=VALUES(severity),resolved_at=VALUES(resolved_at),resolution=VALUES(resolution)")->execute([$id,$vehicleId,trim((string)($b['orderId']??'')),trim((string)($b['code']??'')),$title,trim((string)($b['description']??'')),in_array(($b['status']??''),['open','monitoring','resolved'],true)?$b['status']:'open',in_array(($b['severity']??''),['low','medium','high','critical'],true)?$b['severity']:'medium',(($b['status']??'')==='resolved'?date('Y-m-d H:i:s'):null),trim((string)($b['resolution']??''))]);kareta_json(['ok'=>true,'id'=>$id]);
}

function kareta_vehicle_mileage_save(PDO $pdo,array $b): void {
 $vehicleId=trim((string)($b['vehicleId']??''));
 $vehicle=kareta_vehicle_require($pdo,$vehicleId,true);
 $raw=$b['mileageKm']??$b['mileage_km']??null;
 if($raw===null||$raw==='')kareta_json(['ok'=>false,'error'=>'mileage_required','message'=>'Укажите пробег'],422);
 $mileage=(int)$raw;if($mileage<0)kareta_json(['ok'=>false,'error'=>'mileage_invalid','message'=>'Пробег указан неверно'],422);
 $current=max(0,(int)($vehicle['mileage_km']??0));
 if($mileage<$current)kareta_json(['ok'=>false,'error'=>'mileage_cannot_decrease','message'=>'Новый пробег не может быть меньше сохранённого','currentMileageKm'=>$current],422);
 if($mileage===$current)kareta_json(['ok'=>true,'vehicleId'=>$vehicleId,'mileageKm'=>$mileage,'unchanged'=>true]);
 $pdo->beginTransaction();
 try{
  $pdo->prepare("UPDATE client_vehicles SET mileage_km=? WHERE id=?")->execute([$mileage,$vehicleId]);
  if(kareta_table_exists($pdo,'vehicle_history_events')){
   $eventId='vhe_mileage_'.substr(hash('sha256',$vehicleId.'|'.$mileage.'|'.microtime(true)),0,40);
   $pdo->prepare("INSERT INTO vehicle_history_events(id,vehicle_id,order_id,event_type,title,summary,mileage_km,amount,performed_by,event_at,visibility) VALUES(?,?,'','mileage','Обновлён пробег',?,?,0,'',NOW(),'owner')")->execute([$eventId,$vehicleId,'Зафиксирован пробег '.number_format($mileage,0,'.',' ').' км',$mileage]);
  }
  $pdo->commit();
 }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
 kareta_json(['ok'=>true,'vehicleId'=>$vehicleId,'mileageKm'=>$mileage]);
}
