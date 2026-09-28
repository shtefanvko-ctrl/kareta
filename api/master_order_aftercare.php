<?php
declare(strict_types=1);

function kareta_master_aftercare_ensure(PDO $pdo): void {
    $tables = ['work_order_warranty_claims','work_order_warranty_claim_events','work_order_cost_entries','work_order_financial_results','master_finance_settings'];
    $ready = true;
    foreach ($tables as $table) {
        if (!kareta_table_exists($pdo, $table)) { $ready = false; break; }
    }
    if ($ready) return;
    $migration = require __DIR__ . '/migrations/105_master_aftercare_finance_inventory.php';
    if (is_array($migration) && is_callable($migration['run'] ?? null)) ($migration['run'])($pdo);
}

function kareta_master_aftercare_actor(PDO $pdo): array {
    $actor = function_exists('kareta_master_order_lifecycle_actor') ? kareta_master_order_lifecycle_actor($pdo) : [];
    $auth = function_exists('kareta_auth_resolve') ? kareta_auth_resolve($pdo, false) : [];
    $context = is_array($auth['context'] ?? null) ? $auth['context'] : [];
    $actor['organizationKey'] = trim((string)($context['organizationKey'] ?? $context['organization_id'] ?? ''));
    $actor['organizationId'] = trim((string)($context['organizationId'] ?? $context['organizationKey'] ?? ''));
    return $actor;
}

function kareta_master_aftercare_json($value): array {
    if (is_array($value)) return $value;
    $decoded = json_decode((string)$value, true);
    return is_array($decoded) ? $decoded : [];
}

function kareta_master_aftercare_claim_event(PDO $pdo, array $claim, string $eventType, array $meta=[]): void {
    $actor = kareta_master_aftercare_actor($pdo);
    $st = $pdo->prepare("INSERT INTO work_order_warranty_claim_events(claim_id,order_id,event_type,actor_user_id,actor_role,meta_json) VALUES(?,?,?,?,?,?)");
    $st->execute([(string)$claim['id'],(string)$claim['order_id'],$eventType,(int)($actor['userId']??0)?:null,(string)($actor['role']??''),json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
}

function kareta_master_aftercare_claim(PDO $pdo, string $claimId, bool $professionalWrite=false): array {
    kareta_master_aftercare_ensure($pdo);
    $q = $pdo->prepare("SELECT * FROM work_order_warranty_claims WHERE id=? LIMIT 1");
    $q->execute([$claimId]);
    $claim = $q->fetch(PDO::FETCH_ASSOC);
    if (!$claim) kareta_json(['ok'=>false,'error'=>'warranty_claim_not_found','message'=>'Гарантийное обращение не найдено'],404);
    kareta_master_order_lifecycle_order($pdo,(string)$claim['order_id'],$professionalWrite);
    return $claim;
}

function kareta_master_aftercare_finance_settings(PDO $pdo, array $actor): array {
    $masterId = trim((string)($actor['masterId'] ?? ''));
    if ($masterId === '') return ['masterId'=>'','laborCostPerHour'=>0.0,'overheadPercent'=>0.0,'warrantyReservePercent'=>0.0];
    $q=$pdo->prepare("SELECT master_id AS masterId,labor_cost_per_hour AS laborCostPerHour,overhead_percent AS overheadPercent,warranty_reserve_percent AS warrantyReservePercent FROM master_finance_settings WHERE master_id=? LIMIT 1");
    $q->execute([$masterId]);
    return $q->fetch(PDO::FETCH_ASSOC) ?: ['masterId'=>$masterId,'laborCostPerHour'=>0.0,'overheadPercent'=>0.0,'warrantyReservePercent'=>0.0];
}

function kareta_master_aftercare_inventory_options(PDO $pdo, array $actor, int $limit=120): array {
    if (!kareta_table_exists($pdo,'market_stock') || !kareta_table_exists($pdo,'market_products') || !kareta_table_exists($pdo,'market_warehouses')) return [];
    $uid=(int)($actor['userId']??0);$contextId=(int)($actor['contextId']??0);$org=trim((string)($actor['organizationKey']??''));
    if ($uid<=0 && $contextId<=0 && $org==='') return [];
    $where=[];$args=[];
    if($uid>0){$where[]='(p.owner_user_id=? OR w.owner_user_id=?)';$args[]=$uid;$args[]=$uid;}
    if($contextId>0){$where[]='(p.owner_context_id=? OR w.owner_context_id=?)';$args[]=$contextId;$args[]=$contextId;}
    if($org!==''){$where[]='(p.organization_id=? OR w.organization_id=?)';$args[]=$org;$args[]=$org;}
    $sql="SELECT w.id AS warehouseId,w.title AS warehouseTitle,p.id AS productId,p.title AS productTitle,p.sku,p.oem_number AS oem,p.price,p.cost_price AS costPrice,s.quantity,s.reserved,GREATEST(s.quantity-s.reserved,0) AS available FROM market_stock s JOIN market_warehouses w ON w.id=s.warehouse_id JOIN market_products p ON p.id=s.product_id WHERE w.status='active' AND p.status='active' AND (".implode(' OR ',$where).") ORDER BY p.title,w.title LIMIT ".max(1,min(300,$limit));
    $q=$pdo->prepare($sql);$q->execute($args);return $q->fetchAll(PDO::FETCH_ASSOC)?:[];
}

function kareta_master_aftercare_stock_row(PDO $pdo, array $actor, int $warehouseId, int $productId, bool $forUpdate=false): ?array {
    $suffix=$forUpdate?' FOR UPDATE':'';
    $q=$pdo->prepare("SELECT s.*,w.title AS warehouse_title,w.owner_user_id AS warehouse_owner_user_id,w.organization_id AS warehouse_organization_id,w.owner_context_id AS warehouse_context_id,p.title AS product_title,p.sku,p.oem_number,p.price,p.cost_price,p.owner_user_id AS product_owner_user_id,p.organization_id AS product_organization_id,p.owner_context_id AS product_context_id FROM market_stock s JOIN market_warehouses w ON w.id=s.warehouse_id JOIN market_products p ON p.id=s.product_id WHERE s.warehouse_id=? AND s.product_id=? LIMIT 1{$suffix}");
    $q->execute([$warehouseId,$productId]);$row=$q->fetch(PDO::FETCH_ASSOC);if(!$row)return null;
    $uid=(int)($actor['userId']??0);$cid=(int)($actor['contextId']??0);$org=trim((string)($actor['organizationKey']??''));
    $allowed=($uid>0&&($uid===(int)$row['warehouse_owner_user_id']||$uid===(int)$row['product_owner_user_id']))||($cid>0&&($cid===(int)$row['warehouse_context_id']||$cid===(int)$row['product_context_id']))||($org!==''&&($org===(string)$row['warehouse_organization_id']||$org===(string)$row['product_organization_id']));
    return $allowed?$row:null;
}

function kareta_master_aftercare_movement(PDO $pdo, array $actor, int $warehouseId, int $productId, string $type, float $quantity, string $referenceType, string $referenceKey): string {
    $key='mov_'.substr(hash('sha256',$type.'|'.$referenceType.'|'.$referenceKey.'|'.microtime(true).'|'.random_int(1,PHP_INT_MAX)),0,48);
    $st=$pdo->prepare("INSERT INTO market_stock_movements(movement_key,warehouse_id,product_id,actor_user_id,movement_type,quantity,reference_type,reference_key) VALUES(?,?,?,?,?,?,?,?)");
    $st->execute([$key,$warehouseId,$productId,max(1,(int)($actor['userId']??0)),$type,$quantity,$referenceType,$referenceKey]);
    return $key;
}

function kareta_master_aftercare_cost_upsert(PDO $pdo,array $order,array $actor,string $type,string $sourceType,string $sourceKey,string $title,float $quantity,float $unitCost,string $note='',string $claimId=''): void {
    $quantity=max(0,$quantity);$unitCost=max(0,$unitCost);$total=round($quantity*$unitCost,2);
    $id='wocost_'.substr(hash('sha256',(string)$order['id'].'|'.$sourceType.'|'.$sourceKey.'|'.$type),0,44);
    $st=$pdo->prepare("INSERT INTO work_order_cost_entries(id,order_id,claim_id,master_id,sto_id,cost_type,source_type,source_key,title,quantity,unit_cost,total_cost,note,actor_user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE claim_id=VALUES(claim_id),title=VALUES(title),quantity=VALUES(quantity),unit_cost=VALUES(unit_cost),total_cost=VALUES(total_cost),note=VALUES(note),actor_user_id=VALUES(actor_user_id),updated_at=NOW()");
    $st->execute([$id,(string)$order['id'],$claimId,(string)($order['master_id']??$actor['masterId']??''),(string)($order['sto_id']??''),$type,$sourceType,$sourceKey,mb_substr($title,0,255),$quantity,$unitCost,$total,mb_substr($note,0,500),(int)($actor['userId']??0)?:null]);
}

function kareta_master_aftercare_sync_automatic_costs(PDO $pdo,array $order,array $actor): void {
    $settings=kareta_master_aftercare_finance_settings($pdo,$actor);
    $hourly=max(0,(float)($settings['laborCostPerHour']??0));
    $duration=0;
    if(kareta_table_exists($pdo,'work_order_timers')){$q=$pdo->prepare("SELECT COALESCE(SUM(duration_sec),0) FROM work_order_timers WHERE order_id=? AND status='stopped'");$q->execute([(string)$order['id']]);$duration=(int)$q->fetchColumn();}
    if($hourly>0&&$duration>0)kareta_master_aftercare_cost_upsert($pdo,$order,$actor,'labor','timer','labor_rollup','Фактическое время Мастера',$duration/3600,$hourly,'Рассчитано по завершённым таймерам');
    else $pdo->prepare("DELETE FROM work_order_cost_entries WHERE order_id=? AND source_type='timer' AND source_key='labor_rollup' AND cost_type='labor'")->execute([(string)$order['id']]);

    if(kareta_table_exists($pdo,'work_order_part_reservations')){
        $q=$pdo->prepare("SELECT id,claim_id,part_name,qty_issued,qty_returned,cost_unit_price FROM work_order_part_reservations WHERE order_id=? AND qty_issued>0");$q->execute([(string)$order['id']]);
        $seen=[];
        foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $row){$net=max(0,(float)$row['qty_issued']-(float)$row['qty_returned']);$seen[]=(string)$row['id'];if($net>0)kareta_master_aftercare_cost_upsert($pdo,$order,$actor,trim((string)$row['claim_id'])!==''?'warranty':'part','inventory',(string)$row['id'],(string)$row['part_name'],$net,(float)$row['cost_unit_price'],'Себестоимость фактически выданной детали',(string)$row['claim_id']);else $pdo->prepare("DELETE FROM work_order_cost_entries WHERE order_id=? AND source_type='inventory' AND source_key=?")->execute([(string)$order['id'],(string)$row['id']]);}
        if($seen){$marks=implode(',',array_fill(0,count($seen),'?'));$pdo->prepare("DELETE FROM work_order_cost_entries WHERE order_id=? AND source_type='inventory' AND source_key NOT IN ({$marks})")->execute(array_merge([(string)$order['id']],$seen));}
    }
}

function kareta_master_aftercare_recalculate(PDO $pdo,string $orderId,?array $order=null,?array $actorOverride=null): array {
    kareta_master_aftercare_ensure($pdo);$order=$order?:kareta_master_order_lifecycle_order($pdo,$orderId,false);$actor=$actorOverride?:kareta_master_aftercare_actor($pdo);kareta_master_aftercare_sync_automatic_costs($pdo,$order,$actor);
    $base=(float)($order['final_price']??0);if($base<=0)$base=(float)($order['price']??0);
    $laborRevenue=max(0,(float)($order['labor_price']??0));$partsRevenue=max(0,(float)($order['parts_price']??0));$revenue=max($base,$laborRevenue+$partsRevenue);$otherRevenue=max(0,$revenue-$laborRevenue-$partsRevenue);
    $q=$pdo->prepare("SELECT cost_type,COALESCE(SUM(total_cost),0) total FROM work_order_cost_entries WHERE order_id=? GROUP BY cost_type");$q->execute([$orderId]);$sums=[];foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $row)$sums[(string)$row['cost_type']]=(float)$row['total'];
    $settings=kareta_master_aftercare_finance_settings($pdo,$actor);$overhead=round($revenue*max(0,(float)($settings['overheadPercent']??0))/100,2);
    $labor=(float)($sums['labor']??0);$parts=(float)($sums['part']??0);$consumables=(float)($sums['consumable']??0);$outsourced=(float)($sums['outsourced']??0);$warranty=(float)($sums['warranty']??0);$adjustment=(float)($sums['adjustment']??0);
    $direct=round($labor+$parts+$consumables+$outsourced+$warranty+$overhead+$adjustment,2);$profit=round($revenue-$direct,2);$margin=$revenue>0?round($profit/$revenue*100,3):0.0;
    $st=$pdo->prepare("INSERT INTO work_order_financial_results(order_id,master_id,sto_id,revenue_total,labor_revenue,parts_revenue,other_revenue,direct_cost_total,labor_cost,parts_cost,consumables_cost,outsourced_cost,overhead_cost,warranty_cost,gross_profit,margin_percent,calculated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE master_id=VALUES(master_id),sto_id=VALUES(sto_id),revenue_total=VALUES(revenue_total),labor_revenue=VALUES(labor_revenue),parts_revenue=VALUES(parts_revenue),other_revenue=VALUES(other_revenue),direct_cost_total=VALUES(direct_cost_total),labor_cost=VALUES(labor_cost),parts_cost=VALUES(parts_cost),consumables_cost=VALUES(consumables_cost),outsourced_cost=VALUES(outsourced_cost),overhead_cost=VALUES(overhead_cost),warranty_cost=VALUES(warranty_cost),gross_profit=VALUES(gross_profit),margin_percent=VALUES(margin_percent),calculated_at=NOW(),updated_at=NOW()");
    $st->execute([$orderId,(string)($order['master_id']??$actor['masterId']??''),(string)($order['sto_id']??''),$revenue,$laborRevenue,$partsRevenue,$otherRevenue,$direct,$labor,$parts,$consumables,$outsourced,$overhead,$warranty,$profit,$margin]);
    return ['orderId'=>$orderId,'revenueTotal'=>$revenue,'laborRevenue'=>$laborRevenue,'partsRevenue'=>$partsRevenue,'otherRevenue'=>$otherRevenue,'directCostTotal'=>$direct,'laborCost'=>$labor,'partsCost'=>$parts,'consumablesCost'=>$consumables,'outsourcedCost'=>$outsourced,'overheadCost'=>$overhead,'warrantyCost'=>$warranty,'grossProfit'=>$profit,'marginPercent'=>$margin,'warrantyReserveAmount'=>round($revenue*max(0,(float)($settings['warrantyReservePercent']??0))/100,2),'calculatedAt'=>date('Y-m-d H:i:s')];
}

function kareta_master_aftercare_snapshot(PDO $pdo,string $orderId,array $order): array {
    kareta_master_aftercare_ensure($pdo);$actor=kareta_master_aftercare_actor($pdo);
    $q=$pdo->prepare("SELECT id,order_id AS orderId,warranty_id AS warrantyId,claim_no AS claimNo,issue_text AS issueText,symptoms,requested_resolution AS requestedResolution,status,decision,covered,rejection_reason AS rejectionReason,inspection_notes AS inspectionNotes,root_cause AS rootCause,repair_notes AS repairNotes,quality_result AS qualityResult,quality_notes AS qualityNotes,opened_at AS openedAt,accepted_at AS acceptedAt,repair_started_at AS repairStartedAt,repair_completed_at AS repairCompletedAt,closed_at AS closedAt,updated_at AS updatedAt FROM work_order_warranty_claims WHERE order_id=? ORDER BY claim_no DESC");$q->execute([$orderId]);$claims=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
    $events=[];if($claims){$ids=array_column($claims,'id');$marks=implode(',',array_fill(0,count($ids),'?'));$q=$pdo->prepare("SELECT id,claim_id AS claimId,event_type AS eventType,actor_role AS actorRole,meta_json AS meta,created_at AS createdAt FROM work_order_warranty_claim_events WHERE claim_id IN ({$marks}) ORDER BY created_at DESC,id DESC LIMIT 100");$q->execute($ids);$events=$q->fetchAll(PDO::FETCH_ASSOC)?:[];foreach($events as &$event)$event['meta']=kareta_master_aftercare_json($event['meta']??'');unset($event);}
    $professional=in_array((string)($actor['role']??''),['master','sto','admin','owner'],true);
    $costs=[];$finance=null;$settings=null;$inventory=[];
    if($professional){
        $q=$pdo->prepare("SELECT id,claim_id AS claimId,cost_type AS costType,source_type AS sourceType,source_key AS sourceKey,title,quantity,unit_cost AS unitCost,total_cost AS totalCost,note,created_at AS createdAt,updated_at AS updatedAt FROM work_order_cost_entries WHERE order_id=? ORDER BY created_at DESC,id DESC");$q->execute([$orderId]);$costs=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
        $finance=kareta_master_aftercare_recalculate($pdo,$orderId,$order);$settings=kareta_master_aftercare_finance_settings($pdo,$actor);$inventory=kareta_master_aftercare_inventory_options($pdo,$actor);
    }
    return ['claims'=>$claims,'claimEvents'=>$events,'activeClaim'=>$claims?($claims[0]??null):null,'financeSettings'=>$settings,'costEntries'=>$costs,'financialResult'=>$finance,'inventoryOptions'=>$inventory];
}

function kareta_master_aftercare_inventory_reserve(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);$orderId=trim((string)($body['orderId']??''));$order=kareta_master_order_lifecycle_order($pdo,$orderId,true);kareta_master_aftercare_ensure($pdo);kareta_master_order_lifecycle_require_stage($pdo,$orderId,['work_order','parts_reservation','in_progress','quality_control','payment','delivery','warranty','completed']);
    $warehouseId=(int)($body['warehouseId']??0);$productId=(int)($body['productId']??0);$qty=max(.001,(float)($body['quantity']??$body['qtyRequested']??1));$claimId=trim((string)($body['claimId']??''));if($warehouseId<=0||$productId<=0)kareta_json(['ok'=>false,'error'=>'inventory_product_required','message'=>'Выберите складскую позицию'],422);
    $pdo->beginTransaction();try{$stock=kareta_master_aftercare_stock_row($pdo,$actor,$warehouseId,$productId,true);if(!$stock){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'inventory_forbidden','message'=>'Складская позиция недоступна текущему контексту'],403);} $available=max(0,(float)$stock['quantity']-(float)$stock['reserved']);if($available+0.0001<$qty){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'inventory_insufficient','message'=>'Недостаточный свободный остаток','available'=>$available],409);} $partKey='stock_'.$warehouseId.'_'.$productId.($claimId!==''?'_'.$claimId:'');$id='wpr_'.$orderId.'_'.substr(hash('sha256',$partKey),0,32);$oldQ=$pdo->prepare("SELECT * FROM work_order_part_reservations WHERE order_id=? AND part_key=? LIMIT 1 FOR UPDATE");$oldQ->execute([$orderId,$partKey]);$old=$oldQ->fetch(PDO::FETCH_ASSOC);$oldReserved=$old&&in_array((string)$old['stock_status'],['reserved','partial'],true)?(float)$old['qty_reserved']:0;$delta=$qty-$oldReserved;if($delta>0&&$available+0.0001<$delta){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'inventory_insufficient','message'=>'Недостаточный свободный остаток','available'=>$available],409);} $pdo->prepare("UPDATE market_stock SET reserved=GREATEST(0,reserved+?) WHERE warehouse_id=? AND product_id=?")->execute([$delta,$warehouseId,$productId]);$movement=kareta_master_aftercare_movement($pdo,$actor,$warehouseId,$productId,$delta>=0?'reserve':'release',abs($delta),'work_order_reservation',$id);$sale=max(0,(float)($body['unitPrice']??$stock['price']??0));$cost=max(0,(float)($body['costUnitPrice']??$stock['cost_price']??0));$status=$qty>0?'reserved':'requested';$st=$pdo->prepare("INSERT INTO work_order_part_reservations(id,order_id,claim_id,part_key,part_name,sku,oem,supplier_label,warehouse_id,product_id,qty_requested,qty_reserved,qty_issued,qty_returned,unit_price,cost_unit_price,status,stock_status,movement_key,note,reserved_by_user_id,reserved_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,'reserved',?,?,?,NOW()) ON DUPLICATE KEY UPDATE claim_id=VALUES(claim_id),part_name=VALUES(part_name),sku=VALUES(sku),oem=VALUES(oem),supplier_label=VALUES(supplier_label),warehouse_id=VALUES(warehouse_id),product_id=VALUES(product_id),qty_requested=VALUES(qty_requested),qty_reserved=VALUES(qty_reserved),unit_price=VALUES(unit_price),cost_unit_price=VALUES(cost_unit_price),status=VALUES(status),stock_status='reserved',movement_key=VALUES(movement_key),note=VALUES(note),reserved_by_user_id=VALUES(reserved_by_user_id),reserved_at=NOW(),updated_at=NOW()");$st->execute([$id,$orderId,$claimId,$partKey,(string)$stock['product_title'],(string)$stock['sku'],(string)$stock['oem_number'],(string)$stock['warehouse_title'],$warehouseId,$productId,$qty,$qty,$sale,$cost,$status,$movement,mb_substr(trim((string)($body['note']??'')),0,500),(int)($actor['userId']??0)?:null]);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    kareta_write_event($pdo,$orderId,'inventory_reserved',['warehouseId'=>$warehouseId,'productId'=>$productId,'quantity'=>$qty,'claimId'=>$claimId]);kareta_json(['ok'=>true,'data'=>kareta_master_order_lifecycle_snapshot($pdo,$orderId,$order)]);
}

function kareta_master_aftercare_issue_reserved_inventory(PDO $pdo,string $orderId,array $order,array $actor,string $claimId=''): void {
    if(!kareta_table_exists($pdo,'market_stock'))return;
    $sql="SELECT * FROM work_order_part_reservations WHERE order_id=? AND warehouse_id IS NOT NULL AND product_id IS NOT NULL AND stock_status='reserved'";$params=[$orderId];if($claimId!==''){$sql.=" AND claim_id=?";$params[]=$claimId;}$sql.=" FOR UPDATE";$q=$pdo->prepare($sql);$q->execute($params);
    foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $row){$issue=max(0,(float)$row['qty_reserved']-(float)$row['qty_issued']);if($issue<=0)continue;$stock=kareta_master_aftercare_stock_row($pdo,$actor,(int)$row['warehouse_id'],(int)$row['product_id'],true);if(!$stock)throw new RuntimeException('inventory_scope_lost');if((float)$stock['quantity']+0.0001<$issue|| (float)$stock['reserved']+0.0001<$issue)throw new RuntimeException('inventory_issue_insufficient');$pdo->prepare("UPDATE market_stock SET quantity=GREATEST(0,quantity-?),reserved=GREATEST(0,reserved-?) WHERE warehouse_id=? AND product_id=?")->execute([$issue,$issue,(int)$row['warehouse_id'],(int)$row['product_id']]);$movement=kareta_master_aftercare_movement($pdo,$actor,(int)$row['warehouse_id'],(int)$row['product_id'],'issue',$issue,'work_order',(string)$row['id']);$pdo->prepare("UPDATE work_order_part_reservations SET qty_issued=qty_issued+?,status='issued',stock_status='issued',movement_key=?,updated_at=NOW() WHERE id=?")->execute([$issue,$movement,(string)$row['id']]);}
    $sql="UPDATE work_order_part_reservations SET status='issued' WHERE order_id=? AND status='reserved' AND (warehouse_id IS NULL OR product_id IS NULL)";$params=[$orderId];if($claimId!==''){$sql.=" AND claim_id=?";$params[]=$claimId;}$pdo->prepare($sql)->execute($params);
}

function kareta_master_aftercare_inventory_return(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);$orderId=trim((string)($body['orderId']??''));$order=kareta_master_order_lifecycle_order($pdo,$orderId,true);kareta_master_aftercare_ensure($pdo);$reservationId=trim((string)($body['reservationId']??''));$qty=max(.001,(float)($body['quantity']??1));
    $pdo->beginTransaction();try{$q=$pdo->prepare("SELECT * FROM work_order_part_reservations WHERE id=? AND order_id=? LIMIT 1 FOR UPDATE");$q->execute([$reservationId,$orderId]);$row=$q->fetch(PDO::FETCH_ASSOC);if(!$row||!(int)$row['warehouse_id']||!(int)$row['product_id']){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'inventory_reservation_not_found'],404);} $returnable=max(0,(float)$row['qty_issued']-(float)$row['qty_returned']);if($qty>$returnable+0.0001){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'inventory_return_exceeds_issued','returnable'=>$returnable],422);} $stock=kareta_master_aftercare_stock_row($pdo,$actor,(int)$row['warehouse_id'],(int)$row['product_id'],true);if(!$stock){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'inventory_forbidden'],403);} $pdo->prepare("UPDATE market_stock SET quantity=quantity+? WHERE warehouse_id=? AND product_id=?")->execute([$qty,(int)$row['warehouse_id'],(int)$row['product_id']]);$movement=kareta_master_aftercare_movement($pdo,$actor,(int)$row['warehouse_id'],(int)$row['product_id'],'return',$qty,'work_order',(string)$row['id']);$newReturned=(float)$row['qty_returned']+$qty;$status=$newReturned+0.0001>=(float)$row['qty_issued']?'returned':'issued';$pdo->prepare("UPDATE work_order_part_reservations SET qty_returned=?,status=?,stock_status=?,movement_key=?,updated_at=NOW() WHERE id=?")->execute([$newReturned,$status,$status,$movement,$reservationId]);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    kareta_master_aftercare_recalculate($pdo,$orderId,$order);kareta_write_event($pdo,$orderId,'inventory_returned',['reservationId'=>$reservationId,'quantity'=>$qty]);kareta_json(['ok'=>true,'data'=>kareta_master_order_lifecycle_snapshot($pdo,$orderId,$order)]);
}

function kareta_master_aftercare_settings_save(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['master','admin','owner']);kareta_master_aftercare_ensure($pdo);$masterId=trim((string)($actor['masterId']??''));if($masterId==='')kareta_json(['ok'=>false,'error'=>'master_context_required'],409);
    $hourly=max(0,min(1000000,(float)($body['laborCostPerHour']??0)));$overhead=max(0,min(100,(float)($body['overheadPercent']??0)));$reserve=max(0,min(100,(float)($body['warrantyReservePercent']??0)));
    $pdo->prepare("INSERT INTO master_finance_settings(master_id,owner_user_id,labor_cost_per_hour,overhead_percent,warranty_reserve_percent) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE owner_user_id=VALUES(owner_user_id),labor_cost_per_hour=VALUES(labor_cost_per_hour),overhead_percent=VALUES(overhead_percent),warranty_reserve_percent=VALUES(warranty_reserve_percent),updated_at=NOW()")->execute([$masterId,(int)($actor['userId']??0)?:null,$hourly,$overhead,$reserve]);
    kareta_json(['ok'=>true,'settings'=>kareta_master_aftercare_finance_settings($pdo,$actor)]);
}

function kareta_master_aftercare_cost_save(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);$orderId=trim((string)($body['orderId']??''));$order=kareta_master_order_lifecycle_order($pdo,$orderId,true);kareta_master_aftercare_ensure($pdo);$type=trim((string)($body['costType']??'consumable'));if(!in_array($type,['labor','part','consumable','outsourced','overhead','warranty','adjustment'],true))kareta_json(['ok'=>false,'error'=>'cost_type_invalid'],422);$title=mb_substr(trim((string)($body['title']??'')),0,255);if($title==='')kareta_json(['ok'=>false,'error'=>'cost_title_required'],422);$qty=max(.001,(float)($body['quantity']??1));$unit=max(0,(float)($body['unitCost']??0));$source='manual_'.bin2hex(random_bytes(8));$claimId=trim((string)($body['claimId']??''));kareta_master_aftercare_cost_upsert($pdo,$order,$actor,$type,'manual',$source,$title,$qty,$unit,(string)($body['note']??''),$claimId);$finance=kareta_master_aftercare_recalculate($pdo,$orderId,$order);kareta_write_event($pdo,$orderId,'cost_entry_added',['costType'=>$type,'total'=>$qty*$unit,'claimId'=>$claimId]);kareta_json(['ok'=>true,'financialResult'=>$finance]);
}

function kareta_master_aftercare_cost_delete(PDO $pdo,array $body): void {
    kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);$orderId=trim((string)($body['orderId']??''));$order=kareta_master_order_lifecycle_order($pdo,$orderId,true);kareta_master_aftercare_ensure($pdo);$id=trim((string)($body['costEntryId']??''));$pdo->prepare("DELETE FROM work_order_cost_entries WHERE id=? AND order_id=? AND source_type='manual'")->execute([$id,$orderId]);$finance=kareta_master_aftercare_recalculate($pdo,$orderId,$order);kareta_json(['ok'=>true,'financialResult'=>$finance]);
}

function kareta_client_warranty_claim_submit(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['client','admin','owner']);$orderId=trim((string)($body['orderId']??''));$order=kareta_master_order_lifecycle_order($pdo,$orderId,false);kareta_master_aftercare_ensure($pdo);$issue=mb_substr(trim((string)($body['issueText']??'')),0,8000);if($issue==='')kareta_json(['ok'=>false,'error'=>'warranty_issue_required','message'=>'Опишите проблему по гарантии'],422);
    $q=$pdo->prepare("SELECT * FROM work_order_warranties WHERE order_id=? AND status='active' LIMIT 1");$q->execute([$orderId]);$w=$q->fetch(PDO::FETCH_ASSOC);if(!$w)kareta_json(['ok'=>false,'error'=>'warranty_not_active','message'=>'Для заказа нет активной гарантии'],409);if(!empty($w['ends_at'])&&strtotime((string)$w['ends_at'])<time())kareta_json(['ok'=>false,'error'=>'warranty_expired','message'=>'Срок гарантии истёк'],409);
    $q=$pdo->prepare("SELECT id FROM work_order_warranty_claims WHERE order_id=? AND status NOT IN ('rejected','completed','closed') LIMIT 1");$q->execute([$orderId]);if($q->fetchColumn())kareta_json(['ok'=>false,'error'=>'active_warranty_claim_exists','message'=>'По заказу уже есть открытое гарантийное обращение'],409);
    $n=$pdo->prepare("SELECT COALESCE(MAX(claim_no),0)+1 FROM work_order_warranty_claims WHERE order_id=?");$n->execute([$orderId]);$no=(int)$n->fetchColumn();$id='wclaim_'.substr(hash('sha256',$orderId.'|'.$no.'|'.microtime(true)),0,44);$resolution=(string)($body['requestedResolution']??'repair');if(!in_array($resolution,['repair','inspection','refund'],true))$resolution='repair';
    $pdo->prepare("INSERT INTO work_order_warranty_claims(id,order_id,warranty_id,claim_no,client_user_id,client_phone,master_id,sto_id,issue_text,symptoms,requested_resolution,status,decision) VALUES(?,?,?,?,?,?,?,?,?,?,?,'submitted','pending')")->execute([$id,$orderId,(string)$w['id'],$no,(int)($actor['userId']??0)?:null,(string)($order['client_phone']??''),(string)($order['master_id']??''),(string)($order['sto_id']??''),$issue,mb_substr(trim((string)($body['symptoms']??'')),0,8000),$resolution]);$claim=kareta_master_aftercare_claim($pdo,$id,false);kareta_master_aftercare_claim_event($pdo,$claim,'claim_submitted',['resolution'=>$resolution]);try{kareta_notification_insert($pdo,['recipientUserId'=>(int)($order['master_user_id']??0)?:null,'recipientPhone'=>'','recipientRole'=>'master','eventType'=>'warranty.claim.submitted','entityType'=>'order','entityId'=>$orderId,'title'=>'Новое гарантийное обращение','body'=>$issue,'actionUrl'=>'#/orders/item/'.rawurlencode($orderId),'meta'=>['claimId'=>$id]]);}catch(Throwable $_){}kareta_write_event($pdo,$orderId,'warranty_claim_submitted',['claimId'=>$id,'claimNo'=>$no]);kareta_json(['ok'=>true,'claimId'=>$id,'data'=>kareta_master_order_lifecycle_snapshot($pdo,$orderId,$order)]);
}

function kareta_master_warranty_claim_decide(PDO $pdo,array $body): void {
    $actor=kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);$claim=kareta_master_aftercare_claim($pdo,trim((string)($body['claimId']??'')),true);$decision=(string)($body['decision']??'');if(!in_array($decision,['accepted','rejected'],true))kareta_json(['ok'=>false,'error'=>'warranty_decision_invalid'],422);if((string)$claim['status']!=='submitted')kareta_json(['ok'=>false,'error'=>'warranty_claim_state_conflict'],409);$reason=mb_substr(trim((string)($body['reason']??'')),0,8000);if($decision==='rejected'&&$reason==='')kareta_json(['ok'=>false,'error'=>'rejection_reason_required'],422);$status=$decision==='accepted'?'accepted':'rejected';$covered=$decision==='accepted'?null:0;$pdo->prepare("UPDATE work_order_warranty_claims SET status=?,decision=?,covered=?,rejection_reason=?,accepted_at=IF(?='accepted',NOW(),NULL),closed_at=IF(?='rejected',NOW(),NULL),updated_at=NOW() WHERE id=?")->execute([$status,$decision,$covered,$reason,$decision,$decision,(string)$claim['id']]);$claim=kareta_master_aftercare_claim($pdo,(string)$claim['id'],true);kareta_master_aftercare_claim_event($pdo,$claim,'claim_'.$decision,['reason'=>$reason]);kareta_write_event($pdo,(string)$claim['order_id'],'warranty_claim_'.$decision,['claimId'=>$claim['id']]);kareta_json(['ok'=>true]);
}

function kareta_master_warranty_claim_inspect(PDO $pdo,array $body): void {
    kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);$claim=kareta_master_aftercare_claim($pdo,trim((string)($body['claimId']??'')),true);if(!in_array((string)$claim['status'],['accepted','inspection'],true))kareta_json(['ok'=>false,'error'=>'warranty_claim_state_conflict'],409);$covered=!empty($body['covered']);$notes=mb_substr(trim((string)($body['inspectionNotes']??'')),0,12000);$root=mb_substr(trim((string)($body['rootCause']??'')),0,8000);$reason=mb_substr(trim((string)($body['rejectionReason']??'')),0,8000);if($notes==='')kareta_json(['ok'=>false,'error'=>'inspection_notes_required'],422);$status=$covered?'inspection':'rejected';if(!$covered&&$reason==='')kareta_json(['ok'=>false,'error'=>'rejection_reason_required'],422);$pdo->prepare("UPDATE work_order_warranty_claims SET status=?,decision=?,covered=?,inspection_notes=?,root_cause=?,rejection_reason=?,closed_at=IF(?='rejected',NOW(),NULL),updated_at=NOW() WHERE id=?")->execute([$status,$covered?'accepted':'rejected',$covered?1:0,$notes,$root,$reason,$status,(string)$claim['id']]);$claim=kareta_master_aftercare_claim($pdo,(string)$claim['id'],true);kareta_master_aftercare_claim_event($pdo,$claim,$covered?'inspection_covered':'inspection_not_covered',['rootCause'=>$root,'reason'=>$reason]);kareta_json(['ok'=>true]);
}

function kareta_master_warranty_claim_start_repair(PDO $pdo,array $body): void {
    kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);$claim=kareta_master_aftercare_claim($pdo,trim((string)($body['claimId']??'')),true);if((string)$claim['status']!=='inspection'||empty($claim['covered'])||trim((string)($claim['inspection_notes']??''))==='')kareta_json(['ok'=>false,'error'=>'warranty_claim_not_approved'],409);$order=kareta_master_order_lifecycle_order($pdo,(string)$claim['order_id'],true);$actor=kareta_master_aftercare_actor($pdo);$pdo->beginTransaction();try{kareta_master_aftercare_issue_reserved_inventory($pdo,(string)$claim['order_id'],$order,$actor,(string)$claim['id']);$pdo->prepare("UPDATE work_order_warranty_claims SET status='repair',repair_started_at=COALESCE(repair_started_at,NOW()),updated_at=NOW() WHERE id=?")->execute([(string)$claim['id']]);$pdo->prepare("UPDATE orders SET status='warranty_return',updated_at=NOW() WHERE id=?")->execute([(string)$claim['order_id']]);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}$claim=kareta_master_aftercare_claim($pdo,(string)$claim['id'],true);kareta_master_aftercare_claim_event($pdo,$claim,'repair_started',[]);kareta_write_event($pdo,(string)$claim['order_id'],'warranty_repair_started',['claimId'=>$claim['id']]);kareta_json(['ok'=>true]);
}

function kareta_master_warranty_claim_complete_repair(PDO $pdo,array $body): void {
    kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);$claim=kareta_master_aftercare_claim($pdo,trim((string)($body['claimId']??'')),true);if((string)$claim['status']!=='repair')kareta_json(['ok'=>false,'error'=>'warranty_claim_state_conflict'],409);$q=$pdo->prepare("SELECT COUNT(*) FROM work_order_timers WHERE order_id=? AND status='running'");$q->execute([(string)$claim['order_id']]);if((int)$q->fetchColumn()>0)kareta_json(['ok'=>false,'error'=>'work_timer_running','message'=>'Остановите рабочий таймер'],422);$notes=mb_substr(trim((string)($body['repairNotes']??'')),0,12000);if($notes==='')kareta_json(['ok'=>false,'error'=>'repair_notes_required'],422);$pdo->prepare("UPDATE work_order_warranty_claims SET status='quality_control',repair_notes=?,repair_completed_at=NOW(),quality_result='pending',updated_at=NOW() WHERE id=?")->execute([$notes,(string)$claim['id']]);$claim=kareta_master_aftercare_claim($pdo,(string)$claim['id'],true);kareta_master_aftercare_claim_event($pdo,$claim,'repair_completed',['notes'=>$notes]);kareta_json(['ok'=>true]);
}

function kareta_master_warranty_claim_quality(PDO $pdo,array $body): void {
    kareta_master_order_lifecycle_require_role($pdo,['master','sto','admin','owner']);$claim=kareta_master_aftercare_claim($pdo,trim((string)($body['claimId']??'')),true);if((string)$claim['status']!=='quality_control')kareta_json(['ok'=>false,'error'=>'warranty_claim_state_conflict'],409);$result=(string)($body['result']??'');if(!in_array($result,['pass','fail'],true))kareta_json(['ok'=>false,'error'=>'quality_result_required'],422);$notes=mb_substr(trim((string)($body['notes']??'')),0,8000);if($notes==='')kareta_json(['ok'=>false,'error'=>'quality_notes_required'],422);$status=$result==='pass'?'ready':'repair';$pdo->prepare("UPDATE work_order_warranty_claims SET status=?,quality_result=?,quality_notes=?,repair_started_at=IF(?='fail',NOW(),repair_started_at),updated_at=NOW() WHERE id=?")->execute([$status,$result,$notes,$result,(string)$claim['id']]);$claim=kareta_master_aftercare_claim($pdo,(string)$claim['id'],true);kareta_master_aftercare_claim_event($pdo,$claim,'quality_'.$result,['notes'=>$notes]);kareta_json(['ok'=>true]);
}

function kareta_client_warranty_claim_confirm(PDO $pdo,array $body): void {
    kareta_master_order_lifecycle_require_role($pdo,['client','admin','owner']);$claim=kareta_master_aftercare_claim($pdo,trim((string)($body['claimId']??'')),false);if((string)$claim['status']!=='ready')kareta_json(['ok'=>false,'error'=>'warranty_claim_not_ready'],409);$pdo->beginTransaction();try{$pdo->prepare("UPDATE work_order_warranty_claims SET status='completed',closed_at=NOW(),updated_at=NOW() WHERE id=?")->execute([(string)$claim['id']]);$pdo->prepare("UPDATE orders SET status='done',updated_at=NOW() WHERE id=?")->execute([(string)$claim['order_id']]);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}$claim=kareta_master_aftercare_claim($pdo,(string)$claim['id'],false);kareta_master_aftercare_claim_event($pdo,$claim,'vehicle_return_confirmed',[]);kareta_write_event($pdo,(string)$claim['order_id'],'warranty_return_completed',['claimId'=>$claim['id']]);kareta_master_aftercare_recalculate($pdo,(string)$claim['order_id']);kareta_json(['ok'=>true]);
}
