<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/request_logger.php';
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/context_access.php';
require_once __DIR__ . '/identity/domain_ownership_service.php';
require_once __DIR__ . '/identity/crm_profile_service.php';
require_once __DIR__ . '/identity/authorization_pipeline.php';

$pdo = kareta_pdo();
$user = kareta_current_user();
if (!$user) kareta_json(['ok'=>false,'error'=>'unauthorized'],401);
if (!$pdo instanceof PDO) kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = trim((string)($_GET['action'] ?? 'snapshot'));
$uid = (int)($user['id'] ?? 0);
$decode = static function($value): array {
    if (is_array($value)) return $value;
    $decoded = json_decode((string)$value, true);
    return is_array($decoded) ? $decoded : [];
};
$cleanToken = static fn($value, int $max=128): string => substr(preg_replace('/[^a-zA-Z0-9_.:-]/', '', trim((string)$value)) ?? '', 0, $max);
$context = kareta_context_selected($pdo, $user);
$identityDecision = null;
try { $identityDecision = kareta_authorize($pdo,'domain.read',[],$user); } catch (Throwable $_identityError) {}
if ($identityDecision) $context = $identityDecision->context;
$organizationKey = trim((string)($context['organizationKey'] ?? $context['organization_key'] ?? ''));
if ($organizationKey !== '') $context['organizationId'] = $organizationKey;
$ownership = new KaretaDomainOwnershipService($pdo);
$ownershipAccountId = $identityDecision ? $identityDecision->accountId : 0;
$ownershipContext = $identityDecision ? $identityDecision->context : $context;

$requireSameOrigin = static function(): void {
    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
    $referer = (string)($_SERVER['HTTP_REFERER'] ?? '');
    foreach ([$origin,$referer] as $source) {
        if ($source === '') continue;
        $sourceHost = strtolower((string)(parse_url($source, PHP_URL_HOST) ?? ''));
        if ($sourceHost !== '' && $host !== '' && $sourceHost !== preg_replace('/:\d+$/','',$host)) {
            kareta_json(['ok'=>false,'error'=>'cross_origin_request_denied'],403);
        }
        return;
    }
};
$eventRecipients = static function(PDO $pdo, int $actorId, string $aggregateType, string $aggregateKey, ?string $organizationId): array {
    $ids = [$actorId => true];
    $st=$pdo->prepare("SELECT owner_user_id,organization_id,owner_context_id FROM domain_entities WHERE entity_type=? AND entity_key=? LIMIT 1");
    $st->execute([$aggregateType,$aggregateKey]);$entity=$st->fetch(PDO::FETCH_ASSOC)?:[];
    $owner=(int)($entity['owner_user_id']??0);if($owner>0)$ids[$owner]=true;
    $org=(string)($entity['organization_id']??$organizationId??'');
    if($org!==''){
        $st=$pdo->prepare("SELECT user_id FROM organization_members WHERE organization_id=? AND status='active'");
        $st->execute([$org]);foreach($st->fetchAll(PDO::FETCH_COLUMN)?:[] as $id){$id=(int)$id;if($id>0)$ids[$id]=true;}
    }
    $st=$pdo->prepare("SELECT source_type,source_key,target_type,target_key FROM domain_relations WHERE ((source_type=? AND source_key=?) OR (target_type=? AND target_key=?)) AND status='active'");
    $st->execute([$aggregateType,$aggregateKey,$aggregateType,$aggregateKey]);
    foreach($st->fetchAll(PDO::FETCH_ASSOC)?:[] as $rel){
        foreach([['source_type','source_key'],['target_type','target_key']] as $pair){
            if(($rel[$pair[0]]??'')==='person' && preg_match('/^user:(\d+)$/',(string)($rel[$pair[1]]??''),$m))$ids[(int)$m[1]]=true;
        }
    }
    return array_values(array_map('intval',array_keys($ids)));
};
$deliverEvent = static function(PDO $pdo, int $eventId, string $eventType, string $aggregateType, string $aggregateKey, int $actorId, ?string $organizationId, array $payload) use ($eventRecipients): void {
    $recipients=$eventRecipients($pdo,$actorId,$aggregateType,$aggregateKey,$organizationId);
    $title=trim((string)($payload['title']??str_replace(['.','_'],' ',$eventType)));if($title==='')$title='Новое событие';
    $body=trim((string)($payload['message']??$payload['body']??''));
    $actionUrl='#/core?entity='.rawurlencode($aggregateType.':'.$aggregateKey);
    $entityContext=$pdo->prepare("SELECT owner_context_id FROM domain_entities WHERE entity_type=? AND entity_key=? LIMIT 1");$entityContext->execute([$aggregateType,$aggregateKey]);$recipientContextId=(int)($entityContext->fetchColumn()?:0)?:null;
    $r=$pdo->prepare("INSERT IGNORE INTO domain_event_recipients(event_id,user_id,context_id,delivery_status,delivered_at) VALUES(?,?,?,'delivered',NOW())");
    $n=$pdo->prepare("INSERT INTO notification_center(notification_key,user_id,context_id,event_id,notification_type,title,body,action_url,entity_type,entity_key,status,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,'unread',?) ON DUPLICATE KEY UPDATE context_id=VALUES(context_id),title=VALUES(title),body=VALUES(body),action_url=VALUES(action_url),payload_json=VALUES(payload_json)");
    foreach($recipients as $recipient){
        $r->execute([$eventId,$recipient,$recipientContextId]);
        $key='event:'.$eventId.':user:'.$recipient;
        $n->execute([$key,$recipient,$recipientContextId,$eventId,$eventType,$title,$body,$actionUrl,$aggregateType,$aggregateKey,json_encode(['schemaVersion'=>1,'actorUserId'=>$actorId],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
    }
};
if ($method === 'GET' && $action === 'snapshot') {
    kareta_require_capability($pdo,$user,'domain.read');
    $orgId = (string)($context['organizationId'] ?? '');
    $entityScope=$ownership->scopeSql($ownershipAccountId,$ownershipContext,'d','read');
    $scopeSql = $orgId !== '' ? '(owner_user_id=? OR organization_id=?)' : 'owner_user_id=?';
    $scopeArgs = $orgId !== '' ? [$uid,$orgId] : [$uid];
    $counts=[];
    foreach (['domain_entities','calendar_events'] as $table) {
        $stmt=$pdo->prepare("SELECT COUNT(*) FROM `$table` WHERE $scopeSql"); $stmt->execute($scopeArgs); $counts[$table]=(int)$stmt->fetchColumn();
    }
    $stmt=$pdo->prepare("SELECT COUNT(*) FROM domain_events e WHERE e.actor_user_id=? OR EXISTS (SELECT 1 FROM domain_entities d WHERE d.entity_type=e.aggregate_type AND d.entity_key=e.aggregate_key AND (d.owner_user_id=?".($orgId!==''?' OR d.organization_id=?':'')."))");
    $args=[$uid,$uid]; if($orgId!=='')$args[]=$orgId; $stmt->execute($args); $counts['domain_events']=(int)$stmt->fetchColumn();
    $stmt=$pdo->prepare("SELECT COUNT(*) FROM payment_records WHERE payer_user_id=? OR payee_user_id=?".($orgId!==''?' OR organization_id=?':'')); $args=[$uid,$uid];if($orgId!=='')$args[]=$orgId;$stmt->execute($args);$counts['payment_records']=(int)$stmt->fetchColumn();
    $stmt=$pdo->prepare("SELECT COUNT(*) FROM notification_center WHERE user_id=?");$stmt->execute([$uid]);$counts['notification_center']=(int)$stmt->fetchColumn();

    $eventSql="SELECT e.id,e.event_type AS eventType,e.aggregate_type AS aggregateType,e.aggregate_key AS aggregateKey,e.payload_json AS payload,e.occurred_at AS occurredAt FROM domain_events e WHERE e.actor_user_id=? OR EXISTS (SELECT 1 FROM domain_entities d WHERE d.entity_type=e.aggregate_type AND d.entity_key=e.aggregate_key AND (d.owner_user_id=?".($orgId!==''?' OR d.organization_id=?':'').")) ORDER BY e.id DESC LIMIT 20";
    $stmt=$pdo->prepare($eventSql);$args=[$uid,$uid];if($orgId!=='')$args[]=$orgId;$stmt->execute($args);$events=$stmt->fetchAll(PDO::FETCH_ASSOC)?:[];foreach($events as &$row)$row['payload']=$decode($row['payload']);unset($row);
    $stmt=$pdo->prepare("SELECT id,title,starts_at AS startsAt,ends_at AS endsAt,status,entity_type AS entityType,entity_key AS entityKey FROM calendar_events WHERE $scopeSql AND ends_at>=NOW() ORDER BY starts_at LIMIT 20");$stmt->execute($scopeArgs);$calendar=$stmt->fetchAll(PDO::FETCH_ASSOC)?:[];
    $paymentSql="SELECT payment_key AS paymentKey,amount,currency,status,method,entity_type AS entityType,entity_key AS entityKey,created_at AS createdAt FROM payment_records WHERE payer_user_id=? OR payee_user_id=?".($orgId!==''?' OR organization_id=?':'')." ORDER BY id DESC LIMIT 20";$stmt=$pdo->prepare($paymentSql);$args=[$uid,$uid];if($orgId!=='')$args[]=$orgId;$stmt->execute($args);$payments=$stmt->fetchAll(PDO::FETCH_ASSOC)?:[];
    $stmt=$pdo->prepare("SELECT id,notification_type AS type,title,body,status,entity_type AS entityType,entity_key AS entityKey,created_at AS createdAt FROM notification_center WHERE user_id=? ORDER BY id DESC LIMIT 30");$stmt->execute([$uid]);$notifications=$stmt->fetchAll(PDO::FETCH_ASSOC)?:[];
    $stmt=$pdo->prepare("SELECT entity_type AS type,entity_key AS `key`,status,title,visibility,owner_context_id AS ownerContextId,payload_json AS payload,updated_at AS updatedAt FROM domain_entities d WHERE {$entityScope['sql']} ORDER BY updated_at DESC,id DESC LIMIT 40");$stmt->execute($entityScope['args']);$entities=$stmt->fetchAll(PDO::FETCH_ASSOC)?:[];foreach($entities as &$row)$row['payload']=$decode($row['payload']);unset($row);
    kareta_json(['ok'=>true,'context'=>$context,'counts'=>$counts,'entities'=>$entities,'events'=>$events,'calendar'=>$calendar,'payments'=>$payments,'notifications'=>$notifications]);
}


if ($method === 'GET' && $action === 'entity.get') {
    $type=$cleanToken($_GET['type']??'',64);$key=$cleanToken($_GET['key']??'',128);
    if($type===''||$key==='')kareta_json(['ok'=>false,'error'=>'invalid_entity_ref'],422);
    kareta_require_resource_capability($pdo,$user,'domain.read',['type'=>'domain_entity','key'=>$type.':'.$key,'permission'=>'read']);
    $stmt=$pdo->prepare("SELECT entity_type AS type,entity_key AS `key`,owner_user_id AS ownerUserId,organization_id AS organizationId,owner_context_id AS ownerContextId,visibility,permissions_json AS permissions,status,schema_version AS schemaVersion,title,payload_json AS payload,created_at AS createdAt,updated_at AS updatedAt FROM domain_entities WHERE entity_type=? AND entity_key=? LIMIT 1");
    $stmt->execute([$type,$key]);$entity=$stmt->fetch(PDO::FETCH_ASSOC);if(!$entity)kareta_json(['ok'=>false,'error'=>'entity_not_found'],404);$entity['payload']=$decode($entity['payload']);
    $stmt=$pdo->prepare("SELECT source_type AS sourceType,source_key AS sourceKey,relation_type AS relationType,target_type AS targetType,target_key AS targetKey,status,payload_json AS payload,created_at AS createdAt FROM domain_relations WHERE (source_type=? AND source_key=?) OR (target_type=? AND target_key=?) ORDER BY id DESC LIMIT 100");
    $stmt->execute([$type,$key,$type,$key]);$relations=$stmt->fetchAll(PDO::FETCH_ASSOC)?:[];foreach($relations as &$row)$row['payload']=$decode($row['payload']);unset($row);
    $stmt=$pdo->prepare("SELECT id,event_key AS eventKey,event_type AS eventType,aggregate_type AS aggregateType,aggregate_key AS aggregateKey,actor_user_id AS actorUserId,organization_id AS organizationId,payload_json AS payload,occurred_at AS occurredAt FROM domain_events WHERE aggregate_type=? AND aggregate_key=? ORDER BY occurred_at DESC,id DESC LIMIT 100");
    $stmt->execute([$type,$key]);$timeline=$stmt->fetchAll(PDO::FETCH_ASSOC)?:[];foreach($timeline as &$row)$row['payload']=$decode($row['payload']);unset($row);
    kareta_json(['ok'=>true,'entity'=>$entity,'relations'=>$relations,'timeline'=>$timeline]);
}

if ($method === 'GET' && $action === 'entities.list') {
    kareta_require_capability($pdo,$user,'domain.read');
    $type=$cleanToken($_GET['type']??'',64);$limit=max(1,min(100,(int)($_GET['limit']??50)));
    $entityScope=$ownership->scopeSql($ownershipAccountId,$ownershipContext,'d','read');$args=$entityScope['args'];
    $sql="SELECT entity_type AS type,entity_key AS `key`,status,schema_version AS schemaVersion,title,visibility,owner_context_id AS ownerContextId,payload_json AS payload,updated_at AS updatedAt FROM domain_entities d WHERE {$entityScope['sql']}";
    if($type!==''){$sql.=' AND d.entity_type=?';$args[]=$type;}$sql.=' ORDER BY d.updated_at DESC,d.id DESC LIMIT '.$limit;
    $stmt=$pdo->prepare($sql);$stmt->execute($args);$items=$stmt->fetchAll(PDO::FETCH_ASSOC)?:[];foreach($items as &$row)$row['payload']=$decode($row['payload']);unset($row);
    kareta_json(['ok'=>true,'items'=>$items]);
}

if ($method === 'GET' && $action === 'notifications.list') {
    kareta_require_capability($pdo,$user,'notifications.read');
    $limit=max(1,min(100,(int)($_GET['limit']??50)));
    $stmt=$pdo->prepare("SELECT id,notification_type AS eventType,title,body,action_url AS actionUrl,entity_type AS entityType,entity_key AS entityKey,status,(status='read') AS isRead,created_at AS createdAt,read_at AS readAt FROM notification_center WHERE user_id=? ORDER BY id DESC LIMIT ".$limit);
    $stmt->execute([$uid]);$items=$stmt->fetchAll(PDO::FETCH_ASSOC)?:[];
    kareta_json(['ok'=>true,'notifications'=>$items]);
}





if ($method === 'GET' && $action === 'crm.view') {
    kareta_require_capability($pdo,$user,'domain.read');
    $orgId=(string)($context['organizationId']??'');
    $crmProfiles=new KaretaCrmProfileService($pdo);
    $customerWhere='1=0';$customerArgs=[];
    if($orgId!==''){
        $customerWhere="cp.person_id IN (SELECT DISTINCT l.person_id FROM identity_crm_person_links l JOIN orders o ON o.client_user_id=l.legacy_user_id WHERE o.master_user_id IN (SELECT om.user_id FROM organization_members om WHERE om.organization_id=? AND om.status='active') OR o.assigned_admin_user_id IN (SELECT om2.user_id FROM organization_members om2 WHERE om2.organization_id=? AND om2.status='active'))";$customerArgs=[$orgId,$orgId];
    } else {$customerWhere='cp.account_id=?';$customerArgs=[$ownershipAccountId];}
    $st=$pdo->prepare("SELECT cp.customer_key AS customerKey,cp.user_id AS userId,cp.account_id AS accountId,cp.person_id AS personId,cp.display_name AS displayName,cp.phone,cp.segment,cp.orders_count AS ordersCount,cp.completed_count AS completedCount,cp.total_spent AS totalSpent,DATE_FORMAT(cp.last_visit_at,'%Y-%m-%d') AS lastVisitAt,(SELECT cv.title FROM client_vehicles cv JOIN identity_crm_person_links vl ON vl.legacy_user_id=cv.user_id WHERE vl.person_id=cp.person_id AND cv.active=1 ORDER BY cv.is_default DESC,cv.updated_at DESC LIMIT 1) AS vehicleTitle FROM crm_customer_profiles cp WHERE $customerWhere ORDER BY cp.last_visit_at DESC,cp.updated_at DESC LIMIT 300");$st->execute($customerArgs);$customers=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
    $orderSt=$pdo->prepare("SELECT o.id,COALESCE(NULLIF(o.service_names,''),NULLIF(o.notes,''),CONCAT('Заказ ',o.id)) AS title,o.status,o.price,DATE_FORMAT(o.created_at,'%Y-%m-%d') AS createdAt FROM orders o JOIN identity_crm_person_links l ON l.legacy_user_id=o.client_user_id WHERE l.person_id=? ORDER BY o.created_at DESC LIMIT 8");
    $noteSt=$pdo->prepare("SELECT body,DATE_FORMAT(created_at,'%Y-%m-%d %H:%i') AS createdAt FROM crm_notes WHERE customer_key=?".($orgId!==''?' AND organization_id=?':'')." ORDER BY id DESC LIMIT 10");
    foreach($customers as &$c){$c['profiles']=$crmProfiles->profiles((int)$c['personId']);$c['segmentLabel']=['vip'=>'VIP','returning'=>'Постоянный','lead'=>'Лид','new'=>'Новый'][$c['segment']]??$c['segment'];$orderSt->execute([(int)$c['personId']]);$c['recentOrders']=$orderSt->fetchAll(PDO::FETCH_ASSOC)?:[];$na=[$c['customerKey']];if($orgId!=='')$na[]=$orgId;$noteSt->execute($na);$c['notes']=$noteSt->fetchAll(PDO::FETCH_ASSOC)?:[];}unset($c);
    $summary=['customers'=>count($customers),'returning'=>0,'completedOrders'=>0,'revenue'=>0.0,'averageTicket'=>0.0,'upcomingBookings'=>0];foreach($customers as $c){if(in_array($c['segment'],['vip','returning'],true))$summary['returning']++;$summary['completedOrders']+=(int)$c['completedCount'];$summary['revenue']+=(float)$c['totalSpent'];}$summary['averageTicket']=$summary['completedOrders']>0?round($summary['revenue']/$summary['completedOrders'],2):0;
    if($orgId!==''){$st=$pdo->prepare("SELECT COUNT(*) FROM service_bookings b JOIN calendar_events c ON c.id=b.calendar_event_id WHERE b.organization_id=? AND b.status='confirmed' AND c.starts_at>=NOW()");$st->execute([$orgId]);$summary['upcomingBookings']=(int)$st->fetchColumn();}
    $monthly=[];for($i=5;$i>=0;$i--){$start=(new DateTimeImmutable('first day of this month'))->modify("-$i months");$end=$start->modify('+1 month');$revenue=0.0;if($orgId!==''){$st=$pdo->prepare("SELECT COALESCE(SUM(paid_amount),0) FROM finance_invoices WHERE organization_id=? AND created_at>=? AND created_at<?");$st->execute([$orgId,$start->format('Y-m-d'),$end->format('Y-m-d')]);$revenue=(float)$st->fetchColumn();}$monthly[]=['month'=>$start->format('m.Y'),'revenue'=>$revenue];}$max=max(array_column($monthly,'revenue')?:[1]);foreach($monthly as &$m)$m['percent']=$max>0?round($m['revenue']/$max*100):0;unset($m);
    $masters=[];if($orgId!==''){$st=$pdo->prepare("SELECT p.id AS personId,COALESCE(NULLIF(p.fullname,''),NULLIF(u.name,''),m.name,CONCAT('Мастер ',p.id)) AS name,COUNT(o.id) AS completed,COALESCE(SUM(o.price),0) AS revenue FROM organization_members om JOIN users u ON u.id=om.user_id JOIN accounts a ON a.phone=u.phone JOIN persons p ON p.account_id=a.id JOIN person_profiles pp ON pp.person_id=p.id AND pp.profile_type='master' AND pp.status='active' LEFT JOIN masters m ON m.user_id=u.id LEFT JOIN orders o ON o.master_user_id=u.id AND o.status IN ('done','completed','closed') WHERE om.organization_id=? AND om.status='active' GROUP BY p.id,p.fullname,u.name,m.name ORDER BY revenue DESC LIMIT 20");$st->execute([$orgId]);$masters=$st->fetchAll(PDO::FETCH_ASSOC)?:[];}
    kareta_json(['ok'=>true,'summary'=>$summary,'customers'=>$customers,'monthly'=>$monthly,'masters'=>$masters]);
}

if ($method === 'GET' && $action === 'market.view') {
    kareta_require_capability($pdo,$user,'parts.browse');
    $orgId=(string)($context['organizationId']??'');
    $st=$pdo->query("SELECT p.product_key AS productKey,p.sku,p.title,p.brand,p.oem_number AS oemNumber,p.price,p.currency,p.status,COALESCE(SUM(s.quantity-s.reserved),0) AS available FROM market_products p LEFT JOIN market_stock s ON s.product_id=p.id WHERE p.status='active' GROUP BY p.id ORDER BY p.id DESC LIMIT 100");$products=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
    $st=$pdo->prepare("SELECT c.cart_key AS cartKey,ci.id AS itemId,p.product_key AS productKey,p.title,ci.quantity,ci.unit_price AS unitPrice,(ci.quantity*ci.unit_price) AS lineTotal FROM market_carts c JOIN market_cart_items ci ON ci.cart_id=c.id JOIN market_products p ON p.id=ci.product_id WHERE c.user_id=? AND c.status='active' ORDER BY ci.id");$st->execute([$uid]);$cart=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
    $st=$pdo->prepare("SELECT order_key AS orderKey,status,total_amount AS totalAmount,currency,delivery_method AS deliveryMethod,invoice_key AS invoiceKey,created_at AS createdAt FROM market_orders WHERE buyer_user_id=?".($orgId!==''?' OR organization_id=?':'')." ORDER BY id DESC LIMIT 50");$args=[$uid];if($orgId!=='')$args[]=$orgId;$st->execute($args);$orders=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
    $warehouses=[];$movements=[];if(($context['type']??'')==='organization'&&$orgId!==''){$st=$pdo->prepare("SELECT warehouse_key AS warehouseKey,title,address,status FROM market_warehouses WHERE organization_id=? ORDER BY id");$st->execute([$orgId]);$warehouses=$st->fetchAll(PDO::FETCH_ASSOC)?:[];$st=$pdo->prepare("SELECT m.movement_type AS movementType,m.quantity,m.reference_type AS referenceType,m.reference_key AS referenceKey,m.created_at AS createdAt,p.title,w.title AS warehouseTitle FROM market_stock_movements m JOIN market_products p ON p.id=m.product_id JOIN market_warehouses w ON w.id=m.warehouse_id WHERE w.organization_id=? ORDER BY m.id DESC LIMIT 100");$st->execute([$orgId]);$movements=$st->fetchAll(PDO::FETCH_ASSOC)?:[];}
    kareta_json(['ok'=>true,'products'=>$products,'cart'=>$cart,'orders'=>$orders,'warehouses'=>$warehouses,'movements'=>$movements]);
}

if ($method === 'GET' && $action === 'finance.view') {
    kareta_require_capability($pdo,$user,($context['type']??'personal')==='organization'?'finance.manageOrganization':'finance.manageOwn');
    $orgId=(string)($context['organizationId']??'');
    $scope=$orgId!==''?'(owner_user_id=? OR organization_id=?)':'owner_user_id=?';$args=$orgId!==''?[$uid,$orgId]:[$uid];
    $st=$pdo->prepare("SELECT estimate_key AS estimateKey,title,status,currency,subtotal,discount_total AS discountTotal,tax_total AS taxTotal,grand_total AS grandTotal,version_no AS versionNo,entity_type AS entityType,entity_key AS entityKey,created_at AS createdAt FROM finance_estimates WHERE $scope ORDER BY id DESC LIMIT 50");$st->execute($args);$estimates=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
    $st=$pdo->prepare("SELECT invoice_key AS invoiceKey,title,status,currency,total_amount AS totalAmount,paid_amount AS paidAmount,due_at AS dueAt,entity_type AS entityType,entity_key AS entityKey,created_at AS createdAt FROM finance_invoices WHERE $scope ORDER BY id DESC LIMIT 50");$st->execute($args);$invoices=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
    $txScope=$orgId!==''?'(t.payer_user_id=? OR t.organization_id=?)':'t.payer_user_id=?';$txArgs=$orgId!==''?[$uid,$orgId]:[$uid];
    $st=$pdo->prepare("SELECT t.transaction_key AS transactionKey,i.invoice_key AS invoiceKey,t.amount,t.currency,t.method,t.status,t.created_at AS createdAt FROM finance_transactions t JOIN finance_invoices i ON i.id=t.invoice_id WHERE $txScope ORDER BY t.id DESC LIMIT 50");$st->execute($txArgs);$transactions=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
    $st=$pdo->prepare("SELECT account_code AS accountCode,entry_type AS entryType,amount,currency,reference_type AS referenceType,reference_key AS referenceKey,description,created_at AS createdAt FROM finance_ledger WHERE ".($orgId!==''?'(owner_user_id=? OR organization_id=?)':'owner_user_id=?')." ORDER BY id DESC LIMIT 100");$st->execute($args);$ledger=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
    $summary=['invoiced'=>0.0,'paid'=>0.0,'outstanding'=>0.0];foreach($invoices as $invoice){$summary['invoiced']+=(float)$invoice['totalAmount'];$summary['paid']+=(float)$invoice['paidAmount'];}$summary['outstanding']=max(0,$summary['invoiced']-$summary['paid']);
    kareta_json(['ok'=>true,'summary'=>$summary,'estimates'=>$estimates,'invoices'=>$invoices,'transactions'=>$transactions,'ledger'=>$ledger]);
}

if ($method === 'GET' && $action === 'calendar.view') {
    kareta_require_capability($pdo,$user,'domain.read');
    $fromRaw=trim((string)($_GET['from']??date('Y-m-d')));$toRaw=trim((string)($_GET['to']??''));
    try{$from=new DateTimeImmutable($fromRaw.' 00:00:00');$to=$toRaw!==''?new DateTimeImmutable($toRaw.' 23:59:59'):$from->modify('+30 days');}catch(Throwable $e){kareta_json(['ok'=>false,'error'=>'invalid_calendar_range'],422);}
    $orgId=(string)($context['organizationId']??'');$scope=$orgId!==''?'(c.owner_user_id=? OR c.organization_id=?)':'c.owner_user_id=?';$args=$orgId!==''?[$uid,$orgId]:[$uid];
    $sql="SELECT c.id,c.title,c.starts_at AS startsAt,c.ends_at AS endsAt,c.status,c.entity_type AS entityType,c.entity_key AS entityKey,b.booking_key AS bookingKey,b.master_user_id AS masterUserId,b.resource_key AS resourceKey FROM calendar_events c LEFT JOIN service_bookings b ON b.calendar_event_id=c.id WHERE $scope AND c.starts_at<=? AND c.ends_at>=? ORDER BY c.starts_at LIMIT 200";
    $args[]=$to->format('Y-m-d H:i:s');$args[]=$from->format('Y-m-d H:i:s');$st=$pdo->prepare($sql);$st->execute($args);kareta_json(['ok'=>true,'events'=>$st->fetchAll(PDO::FETCH_ASSOC)?:[],'from'=>$from->format('Y-m-d'),'to'=>$to->format('Y-m-d')]);
}

if ($method === 'GET' && $action === 'booking.availability') {
    kareta_require_capability($pdo,$user,'domain.read');
    $date=trim((string)($_GET['date']??date('Y-m-d')));$duration=max(30,min(240,(int)($_GET['duration']??60)));$duration=(int)(ceil($duration/30)*30);
    try{$day=new DateTimeImmutable($date.' 09:00:00');}catch(Throwable $e){kareta_json(['ok'=>false,'error'=>'invalid_booking_date'],422);}
    $endDay=$day->setTime(18,0);$orgId=(string)($context['organizationId']??'');$masterId=max(0,(int)($_GET['masterUserId']??0));$resourceKey=$cleanToken($_GET['resourceKey']??'',128);
    $where=["c.status NOT IN ('cancelled','completed')","c.starts_at<?","c.ends_at>?"];$args=[$endDay->format('Y-m-d H:i:s'),$day->format('Y-m-d H:i:s')];
    if($masterId>0){$where[]='b.master_user_id=?';$args[]=$masterId;}elseif($resourceKey!==''){$where[]='b.resource_key=?';$args[]=$resourceKey;}elseif($orgId!==''){$where[]='c.organization_id=?';$args[]=$orgId;}else{$where[]='c.owner_user_id=?';$args[]=$uid;}
    $st=$pdo->prepare("SELECT c.starts_at,c.ends_at FROM calendar_events c LEFT JOIN service_bookings b ON b.calendar_event_id=c.id WHERE ".implode(' AND ',$where));$st->execute($args);$busy=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
    $slots=[];for($cursor=$day;$cursor->modify('+'.$duration.' minutes')<=$endDay;$cursor=$cursor->modify('+30 minutes')){$slotEnd=$cursor->modify('+'.$duration.' minutes');$blocked=false;foreach($busy as $row){$bs=new DateTimeImmutable((string)$row['starts_at']);$be=new DateTimeImmutable((string)$row['ends_at']);if($cursor<$be&&$slotEnd>$bs){$blocked=true;break;}}if(!$blocked)$slots[]=['startsAt'=>$cursor->format('Y-m-d H:i:s'),'endsAt'=>$slotEnd->format('Y-m-d H:i:s'),'label'=>$cursor->format('H:i')];}
    kareta_json(['ok'=>true,'date'=>$date,'duration'=>$duration,'slots'=>$slots]);
}

if ($method === 'POST') {
    $requireSameOrigin();
    $body=json_decode((string)file_get_contents('php://input'),true); if(!is_array($body))$body=[];
    kareta_idempotency_begin($pdo,'domain.'.$action,$body);





    if ($action === 'crm.note.create') {
        kareta_require_capability($pdo,$user,'domain.read');$customerKey=$cleanToken($body['customerKey']??'',80);$text=trim((string)($body['body']??''));if($customerKey===''||$text===''||mb_strlen($text)>4000)kareta_json(['ok'=>false,'error'=>'invalid_crm_note'],422);$orgId=(string)($context['organizationId']??'');if($orgId==='')kareta_json(['ok'=>false,'error'=>'organization_context_required'],403);$st=$pdo->prepare("SELECT 1 FROM crm_customer_profiles cp WHERE cp.customer_key=? AND cp.user_id IN (SELECT DISTINCT o.client_user_id FROM orders o WHERE o.master_user_id IN (SELECT om.user_id FROM organization_members om WHERE om.organization_id=? AND om.status='active') OR o.assigned_admin_user_id IN (SELECT om2.user_id FROM organization_members om2 WHERE om2.organization_id=? AND om2.status='active')) LIMIT 1");$st->execute([$customerKey,$orgId,$orgId]);if(!$st->fetchColumn())kareta_json(['ok'=>false,'error'=>'crm_customer_access_denied'],403);$key='crmnote_'.bin2hex(random_bytes(10));$st=$pdo->prepare("INSERT INTO crm_notes(note_key,customer_key,author_user_id,organization_id,body) VALUES(?,?,?,?,?,?)");$st->execute([$key,$customerKey,$uid,$orgId,$text]);kareta_json(['ok'=>true,'noteKey'=>$key],201);
    }

    if ($action === 'market.product.create') {
        kareta_require_capability($pdo,$user,'market.manage');$orgId=(string)($context['organizationId']??'');$contextId=(int)($context['id']??0);if(($context['type']??'')!=='organization'||$orgId===''||$contextId<1)kareta_json(['ok'=>false,'error'=>'organization_context_required'],403);$title=mb_substr(trim((string)($body['title']??'')),0,255);$sku=$cleanToken($body['sku']??'',96);$priceRaw=trim((string)($body['price']??''));if($title===''||$sku===''||!preg_match('/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/',$priceRaw))kareta_json(['ok'=>false,'error'=>'invalid_product'],422);$key='prd_'.bin2hex(random_bytes(10));$st=$pdo->prepare("INSERT INTO market_products(product_key,owner_user_id,organization_id,owner_context_id,sku,title,brand,oem_number,price,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?)");$st->execute([$key,$uid,$orgId,$contextId,$sku,$title,mb_substr(trim((string)($body['brand']??'')),0,128)?:null,mb_substr(trim((string)($body['oemNumber']??'')),0,128)?:null,number_format((float)$priceRaw,2,'.',''),json_encode(['compatibility'=>$body['compatibility']??[],'schemaVersion'=>1],JSON_UNESCAPED_UNICODE)]);kareta_json(['ok'=>true,'productKey'=>$key],201);
    }
    if ($action === 'market.warehouse.create') {
        kareta_require_capability($pdo,$user,'warehouse.manage');$orgId=(string)($context['organizationId']??'');$contextId=(int)($context['id']??0);if(($context['type']??'')!=='organization'||$orgId===''||$contextId<1)kareta_json(['ok'=>false,'error'=>'organization_context_required'],403);$title=mb_substr(trim((string)($body['title']??'')),0,255);if($title==='')kareta_json(['ok'=>false,'error'=>'invalid_warehouse'],422);$key='wh_'.bin2hex(random_bytes(10));$pdo->prepare("INSERT INTO market_warehouses(warehouse_key,owner_user_id,organization_id,owner_context_id,title,address) VALUES(?,?,?,?,?,?)")->execute([$key,$uid,$orgId,$contextId,$title,mb_substr(trim((string)($body['address']??'')),0,255)?:null]);kareta_json(['ok'=>true,'warehouseKey'=>$key],201);
    }
    if ($action === 'market.stock.adjust') {
        kareta_require_capability($pdo,$user,'warehouse.manage');if(($context['type']??'')!=='organization'||empty($context['organizationId']))kareta_json(['ok'=>false,'error'=>'organization_context_required'],403);$warehouseKey=$cleanToken($body['warehouseKey']??'',64);$productKey=$cleanToken($body['productKey']??'',64);$qtyRaw=trim((string)($body['quantity']??''));if($warehouseKey===''||$productKey===''||!preg_match('/^-?(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/',$qtyRaw)||(float)$qtyRaw==0)kareta_json(['ok'=>false,'error'=>'invalid_stock_adjustment'],422);$orgId=(string)($context['organizationId']??'');$st=$pdo->prepare("SELECT w.id warehouse_id,p.id product_id FROM market_warehouses w JOIN market_products p ON p.product_key=? WHERE w.warehouse_key=? AND (w.owner_user_id=?".($orgId!==''?' OR w.organization_id=?':'').") LIMIT 1");$args=[$productKey,$warehouseKey,$uid];if($orgId!=='')$args[]=$orgId;$st->execute($args);$row=$st->fetch(PDO::FETCH_ASSOC);if(!$row)kareta_json(['ok'=>false,'error'=>'stock_scope_not_found'],404);$qty=(float)$qtyRaw;$pdo->beginTransaction();try{$pdo->prepare("INSERT INTO market_stock(warehouse_id,product_id,quantity,reserved) VALUES(?,?,?,0) ON DUPLICATE KEY UPDATE quantity=quantity+VALUES(quantity)")->execute([(int)$row['warehouse_id'],(int)$row['product_id'],number_format($qty,3,'.','')]);$pdo->prepare("INSERT INTO market_stock_movements(movement_key,warehouse_id,product_id,actor_user_id,movement_type,quantity,reference_type,reference_key) VALUES(?,?,?,?,?,?,?,?)")->execute(['mov_'.bin2hex(random_bytes(10)),(int)$row['warehouse_id'],(int)$row['product_id'],$uid,$qty>0?'receipt':'adjustment',number_format(abs($qty),3,'.',''),'manual',null]);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}kareta_json(['ok'=>true]);
    }
    if ($action === 'market.cart.add') {
        kareta_require_capability($pdo,$user,'parts.browse');$productKey=$cleanToken($body['productKey']??'',64);$qtyRaw=trim((string)($body['quantity']??'1'));if($productKey===''||!preg_match('/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/',$qtyRaw)||(float)$qtyRaw<=0)kareta_json(['ok'=>false,'error'=>'invalid_cart_item'],422);$st=$pdo->prepare("SELECT id,price FROM market_products WHERE product_key=? AND status='active' LIMIT 1");$st->execute([$productKey]);$product=$st->fetch(PDO::FETCH_ASSOC);if(!$product)kareta_json(['ok'=>false,'error'=>'product_not_found'],404);$st=$pdo->prepare("SELECT id,cart_key FROM market_carts WHERE user_id=? AND status='active' LIMIT 1");$st->execute([$uid]);$cart=$st->fetch(PDO::FETCH_ASSOC);if(!$cart){$key='cart_'.bin2hex(random_bytes(10));$pdo->prepare("INSERT INTO market_carts(cart_key,user_id) VALUES(?,?)")->execute([$key,$uid]);$cart=['id'=>$pdo->lastInsertId(),'cart_key'=>$key];}$pdo->prepare("INSERT INTO market_cart_items(cart_id,product_id,quantity,unit_price) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE quantity=quantity+VALUES(quantity),unit_price=VALUES(unit_price)")->execute([(int)$cart['id'],(int)$product['id'],number_format((float)$qtyRaw,3,'.',''),$product['price']]);kareta_json(['ok'=>true,'cartKey'=>$cart['cart_key']]);
    }
    if ($action === 'market.cart.remove') {
        kareta_require_capability($pdo,$user,'parts.browse');$itemId=(int)($body['itemId']??0);$st=$pdo->prepare("DELETE ci FROM market_cart_items ci JOIN market_carts c ON c.id=ci.cart_id WHERE ci.id=? AND c.user_id=? AND c.status='active'");$st->execute([$itemId,$uid]);kareta_json(['ok'=>true,'removed'=>$st->rowCount()]);
    }
    if ($action === 'market.checkout') {
        kareta_require_capability($pdo,$user,'parts.browse');$delivery=$cleanToken($body['deliveryMethod']??'pickup',32);if(!in_array($delivery,['pickup','courier','carrier'],true))kareta_json(['ok'=>false,'error'=>'invalid_delivery_method'],422);$st=$pdo->prepare("SELECT c.id cart_id,ci.product_id,ci.quantity,ci.unit_price,p.owner_user_id,p.organization_id,p.owner_context_id FROM market_carts c JOIN market_cart_items ci ON ci.cart_id=c.id JOIN market_products p ON p.id=ci.product_id WHERE c.user_id=? AND c.status='active' ORDER BY ci.id");$st->execute([$uid]);$items=$st->fetchAll(PDO::FETCH_ASSOC)?:[];if(!$items)kareta_json(['ok'=>false,'error'=>'cart_empty'],422);$sellerOrganizations=array_values(array_unique(array_filter(array_map(static fn($i)=>(string)($i['organization_id']??''),$items))));if(count($sellerOrganizations)!==1)kareta_json(['ok'=>false,'error'=>'mixed_organization_cart','message'=>'Оформляйте товары каждого магазина отдельным заказом'],409);$pdo->beginTransaction();try{$total=0.0;$alloc=[];foreach($items as $item){$q=(float)$item['quantity'];$ss=$pdo->prepare("SELECT s.id,s.warehouse_id,(s.quantity-s.reserved) available FROM market_stock s JOIN market_warehouses w ON w.id=s.warehouse_id WHERE s.product_id=? AND (s.quantity-s.reserved)>=? ORDER BY available DESC LIMIT 1 FOR UPDATE");$ss->execute([(int)$item['product_id'],number_format($q,3,'.','')]);$stock=$ss->fetch(PDO::FETCH_ASSOC);if(!$stock)throw new RuntimeException('insufficient_stock');$alloc[]=[(int)$stock['id'],(int)$stock['warehouse_id'],$item];$total+=round($q*(float)$item['unit_price'],2);} $orderKey='mord_'.bin2hex(random_bytes(10));$invoiceKey='inv_'.bin2hex(random_bytes(10));$seller=$items[0];$pdo->prepare("INSERT INTO finance_invoices(invoice_key,owner_user_id,organization_id,payer_user_id,entity_type,entity_key,title,status,currency,total_amount,payload_json) VALUES(?,?,?,?,?,?,?,'draft','KZT',?,?)")->execute([$invoiceKey,(int)$seller['owner_user_id'],$seller['organization_id']?:null,$uid,'market_order',$orderKey,'Заказ Marketplace '.$orderKey,number_format($total,2,'.',''),json_encode(['schemaVersion'=>1])]);$pdo->prepare("INSERT INTO market_orders(order_key,buyer_user_id,seller_user_id,organization_id,seller_context_id,invoice_key,status,total_amount,delivery_method,payload_json) VALUES(?,?,?,?,?,?,'reserved',?,?,?)")->execute([$orderKey,$uid,(int)$seller['owner_user_id'],$seller['organization_id']?:null,(int)($seller['owner_context_id']??0)?:null,$invoiceKey,number_format($total,2,'.',''),$delivery,json_encode(['schemaVersion'=>1],JSON_UNESCAPED_UNICODE)]);$orderId=(int)$pdo->lastInsertId();$oi=$pdo->prepare("INSERT INTO market_order_items(order_id,product_id,warehouse_id,quantity,unit_price,line_total) VALUES(?,?,?,?,?,?)");foreach($alloc as [$stockId,$warehouseId,$item]){$q=(float)$item['quantity'];$pdo->prepare("UPDATE market_stock SET reserved=reserved+? WHERE id=?")->execute([number_format($q,3,'.',''),$stockId]);$oi->execute([$orderId,(int)$item['product_id'],$warehouseId,number_format($q,3,'.',''),$item['unit_price'],number_format($q*(float)$item['unit_price'],2,'.','')]);$pdo->prepare("INSERT INTO market_stock_movements(movement_key,warehouse_id,product_id,actor_user_id,movement_type,quantity,reference_type,reference_key) VALUES(?,?,?,?,?,?,?,?)")->execute(['mov_'.bin2hex(random_bytes(10)),$warehouseId,(int)$item['product_id'],$uid,'reserve',number_format($q,3,'.',''),'market_order',$orderKey]);}$pdo->prepare("UPDATE market_carts SET status='checked_out' WHERE id=?")->execute([(int)$items[0]['cart_id']]);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if($e->getMessage()==='insufficient_stock')kareta_json(['ok'=>false,'error'=>'insufficient_stock'],409);throw $e;}kareta_json(['ok'=>true,'orderKey'=>$orderKey,'invoiceKey'=>$invoiceKey,'totalAmount'=>number_format($total,2,'.','')],201);
    }
    if ($action === 'market.order.fulfill') {
        kareta_require_capability($pdo,$user,'market.manage');if(($context['type']??'')!=='organization'||empty($context['organizationId']))kareta_json(['ok'=>false,'error'=>'organization_context_required'],403);$orderKey=$cleanToken($body['orderKey']??'',64);$orgId=(string)($context['organizationId']??'');$st=$pdo->prepare("SELECT * FROM market_orders WHERE order_key=? AND organization_id=? AND status='reserved' FOR UPDATE");$args=[$orderKey,$orgId];$pdo->beginTransaction();try{$st->execute($args);$order=$st->fetch(PDO::FETCH_ASSOC);if(!$order)kareta_json(['ok'=>false,'error'=>'order_not_found_or_not_reserved'],409);$it=$pdo->prepare("SELECT * FROM market_order_items WHERE order_id=?");$it->execute([(int)$order['id']]);foreach($it->fetchAll(PDO::FETCH_ASSOC)?:[] as $item){$pdo->prepare("UPDATE market_stock SET quantity=quantity-?,reserved=GREATEST(0,reserved-?) WHERE warehouse_id=? AND product_id=?")->execute([$item['quantity'],$item['quantity'],$item['warehouse_id'],$item['product_id']]);$pdo->prepare("INSERT INTO market_stock_movements(movement_key,warehouse_id,product_id,actor_user_id,movement_type,quantity,reference_type,reference_key) VALUES(?,?,?,?,?,?,?,?)")->execute(['mov_'.bin2hex(random_bytes(10)),$item['warehouse_id'],$item['product_id'],$uid,'shipment',$item['quantity'],'market_order',$orderKey]);}$pdo->prepare("UPDATE market_orders SET status='completed' WHERE id=?")->execute([(int)$order['id']]);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}kareta_json(['ok'=>true,'orderKey'=>$orderKey,'status'=>'completed']);
    }
    if ($action === 'estimate.create') {
        kareta_require_capability($pdo,$user,($context['type']??'personal')==='organization'?'finance.manageOrganization':'finance.manageOwn');
        $title=mb_substr(trim((string)($body['title']??'Смета')),0,255);$items=is_array($body['items']??null)?$body['items']:[];if($title===''||count($items)<1||count($items)>100)kareta_json(['ok'=>false,'error'=>'invalid_estimate'],422);
        $entityType=$cleanToken($body['entityType']??'',64);$entityKey=$cleanToken($body['entityKey']??'',128);if(($entityType!==''||$entityKey!=='')&&($entityType===''||$entityKey===''||!$entityAccessible($pdo,$uid,$context,$entityType,$entityKey)))kareta_json(['ok'=>false,'error'=>'estimate_entity_access_denied'],403);
        $normalized=[];$subtotal=0.0;foreach($items as $item){if(!is_array($item))continue;$itemTitle=mb_substr(trim((string)($item['title']??'')),0,255);$quantityRaw=trim((string)($item['quantity']??'1'));$priceRaw=trim((string)($item['unitPrice']??'0'));if($itemTitle===''||!preg_match('/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/',$quantityRaw)||!preg_match('/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/',$priceRaw))kareta_json(['ok'=>false,'error'=>'invalid_estimate_item'],422);$qty=(float)$quantityRaw;$price=(float)$priceRaw;$line=round($qty*$price,2);$subtotal+=$line;$normalized[]=['type'=>$cleanToken($item['type']??'service',24)?:'service','title'=>$itemTitle,'quantity'=>number_format($qty,3,'.',''),'unitPrice'=>number_format($price,2,'.',''),'lineTotal'=>number_format($line,2,'.','')];}
        if(!$normalized)kareta_json(['ok'=>false,'error'=>'invalid_estimate_items'],422);$discountRaw=trim((string)($body['discount']??'0'));if(!preg_match('/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/',$discountRaw))kareta_json(['ok'=>false,'error'=>'invalid_discount'],422);$discount=min($subtotal,(float)$discountRaw);$grand=round($subtotal-$discount,2);$key='est_'.bin2hex(random_bytes(10));$orgId=(string)($context['organizationId']??'');
        $pdo->beginTransaction();try{$st=$pdo->prepare("INSERT INTO finance_estimates(estimate_key,owner_user_id,organization_id,entity_type,entity_key,title,status,currency,subtotal,discount_total,grand_total,payload_json) VALUES(?,?,?,?,?,?,'draft','KZT',?,?,?,?)");$st->execute([$key,$uid,$orgId?:null,$entityType?:null,$entityKey?:null,$title,number_format($subtotal,2,'.',''),number_format($discount,2,'.',''),number_format($grand,2,'.',''),json_encode(['schemaVersion'=>1],JSON_UNESCAPED_UNICODE)]);$estimateId=(int)$pdo->lastInsertId();$itemSt=$pdo->prepare("INSERT INTO finance_estimate_items(estimate_id,item_type,title,quantity,unit_price,line_total,payload_json) VALUES(?,?,?,?,?,?,?)");foreach($normalized as $item)$itemSt->execute([$estimateId,$item['type'],$item['title'],$item['quantity'],$item['unitPrice'],$item['lineTotal'],json_encode(['schemaVersion'=>1])]);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
        kareta_json(['ok'=>true,'estimateKey'=>$key,'grandTotal'=>number_format($grand,2,'.',''),'status'=>'draft'],201);
    }
    if ($action === 'invoice.create') {
        kareta_require_capability($pdo,$user,($context['type']??'personal')==='organization'?'finance.manageOrganization':'finance.manageOwn');$estimateKey=$cleanToken($body['estimateKey']??'',64);if($estimateKey==='')kareta_json(['ok'=>false,'error'=>'invalid_estimate_key'],422);$orgId=(string)($context['organizationId']??'');$sql="SELECT * FROM finance_estimates WHERE estimate_key=? AND ".($orgId!==''?'(owner_user_id=? OR organization_id=?)':'owner_user_id=?')." LIMIT 1";$args=$orgId!==''?[$estimateKey,$uid,$orgId]:[$estimateKey,$uid];$st=$pdo->prepare($sql);$st->execute($args);$estimate=$st->fetch(PDO::FETCH_ASSOC);if(!$estimate)kareta_json(['ok'=>false,'error'=>'estimate_not_found'],404);$key='inv_'.bin2hex(random_bytes(10));$title=mb_substr(trim((string)($body['title']??('Счёт: '.$estimate['title']))),0,255);$dueRaw=trim((string)($body['dueAt']??''));$due=null;if($dueRaw!==''){try{$due=(new DateTimeImmutable($dueRaw))->format('Y-m-d H:i:s');}catch(Throwable $e){kareta_json(['ok'=>false,'error'=>'invalid_due_at'],422);}}$st=$pdo->prepare("INSERT INTO finance_invoices(invoice_key,estimate_id,owner_user_id,organization_id,payer_user_id,entity_type,entity_key,title,status,currency,total_amount,due_at,payload_json) VALUES(?,?,?,?,?,?,?,?, 'draft','KZT',?,?,?)");$st->execute([$key,(int)$estimate['id'],$uid,$estimate['organization_id']?:null,isset($body['payerUserId'])?(int)$body['payerUserId']:null,$estimate['entity_type'],$estimate['entity_key'],$title,$estimate['grand_total'],$due,json_encode(['schemaVersion'=>1],JSON_UNESCAPED_UNICODE)]);kareta_json(['ok'=>true,'invoiceKey'=>$key,'totalAmount'=>$estimate['grand_total'],'status'=>'draft'],201);
    }
    if ($action === 'invoice.send') {
        kareta_require_capability($pdo,$user,($context['type']??'personal')==='organization'?'finance.manageOrganization':'finance.manageOwn');$key=$cleanToken($body['invoiceKey']??'',64);$orgId=(string)($context['organizationId']??'');$sql="UPDATE finance_invoices SET status='sent',sent_at=NOW() WHERE invoice_key=? AND status='draft' AND ".($orgId!==''?'(owner_user_id=? OR organization_id=?)':'owner_user_id=?');$args=$orgId!==''?[$key,$uid,$orgId]:[$key,$uid];$st=$pdo->prepare($sql);$st->execute($args);if($st->rowCount()===0)kareta_json(['ok'=>false,'error'=>'invoice_not_found_or_not_draft'],409);kareta_json(['ok'=>true,'invoiceKey'=>$key,'status'=>'sent']);
    }
    if ($action === 'payment.record') {
        kareta_require_capability($pdo,$user,($context['type']??'personal')==='organization'?'finance.manageOrganization':'finance.manageOwn');$invoiceKey=$cleanToken($body['invoiceKey']??'',64);$amountRaw=trim((string)($body['amount']??''));if($invoiceKey===''||!preg_match('/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/',$amountRaw)||(float)$amountRaw<=0)kareta_json(['ok'=>false,'error'=>'invalid_payment'],422);$method=$cleanToken($body['method']??'manual',32);if(!in_array($method,['manual','cash','card','bank_transfer'],true))kareta_json(['ok'=>false,'error'=>'invalid_payment_method'],422);$orgId=(string)($context['organizationId']??'');$sql="SELECT * FROM finance_invoices WHERE invoice_key=? AND ".($orgId!==''?'(owner_user_id=? OR organization_id=?)':'owner_user_id=?')." FOR UPDATE";$args=$orgId!==''?[$invoiceKey,$uid,$orgId]:[$invoiceKey,$uid];$pdo->beginTransaction();try{$st=$pdo->prepare($sql);$st->execute($args);$invoice=$st->fetch(PDO::FETCH_ASSOC);if(!$invoice)kareta_json(['ok'=>false,'error'=>'invoice_not_found'],404);$remaining=round((float)$invoice['total_amount']-(float)$invoice['paid_amount'],2);$amount=round((float)$amountRaw,2);if($amount>$remaining+0.001)kareta_json(['ok'=>false,'error'=>'payment_exceeds_balance','remaining'=>$remaining],422);$txKey='txn_'.bin2hex(random_bytes(10));$payKey='pay_'.bin2hex(random_bytes(10));$st=$pdo->prepare("INSERT INTO payment_records(payment_key,payer_user_id,payee_user_id,organization_id,entity_type,entity_key,amount,currency,status,method,payload_json) VALUES(?,?,?,?,?,?,?,'KZT','completed',?,?)");$st->execute([$payKey,(int)($invoice['payer_user_id']?:$uid),$uid,$invoice['organization_id'],$invoice['entity_type'],$invoice['entity_key'],number_format($amount,2,'.',''),$method,json_encode(['invoiceKey'=>$invoiceKey,'schemaVersion'=>1],JSON_UNESCAPED_UNICODE)]);$st=$pdo->prepare("INSERT INTO finance_transactions(transaction_key,invoice_id,payment_key,payer_user_id,payee_user_id,organization_id,amount,currency,method,status,payload_json) VALUES(?,?,?,?,?,?,?,'KZT',?,'completed',?)");$st->execute([$txKey,(int)$invoice['id'],$payKey,(int)($invoice['payer_user_id']?:$uid),$uid,$invoice['organization_id'],number_format($amount,2,'.',''),$method,json_encode(['schemaVersion'=>1])]);$newPaid=round((float)$invoice['paid_amount']+$amount,2);$newStatus=$newPaid+0.001>=(float)$invoice['total_amount']?'paid':'partially_paid';$st=$pdo->prepare("UPDATE finance_invoices SET paid_amount=?,status=?,paid_at=IF(?='paid',NOW(),paid_at) WHERE id=?");$st->execute([number_format($newPaid,2,'.',''),$newStatus,$newStatus,(int)$invoice['id']]);$ledger=$pdo->prepare("INSERT INTO finance_ledger(ledger_key,owner_user_id,organization_id,account_code,entry_type,amount,currency,reference_type,reference_key,description) VALUES(?,?,?,?,?,?,'KZT','transaction',?,?)");$ledger->execute(['ledger:'.$txKey.':cash',$uid,$invoice['organization_id'],'cash','debit',number_format($amount,2,'.',''),$txKey,'Оплата счёта '.$invoiceKey]);$ledger->execute(['ledger:'.$txKey.':revenue',$uid,$invoice['organization_id'],'service_revenue','credit',number_format($amount,2,'.',''),$txKey,'Выручка по счёту '.$invoiceKey]);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}kareta_json(['ok'=>true,'transactionKey'=>$txKey,'paymentKey'=>$payKey,'invoiceStatus'=>$newStatus,'paidAmount'=>number_format($newPaid,2,'.','')],201);
    }
    if ($action === 'refund.create') {
        kareta_require_capability($pdo,$user,($context['type']??'personal')==='organization'?'finance.manageOrganization':'finance.manageOwn');$txKey=$cleanToken($body['transactionKey']??'',64);$amountRaw=trim((string)($body['amount']??''));if($txKey===''||!preg_match('/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/',$amountRaw)||(float)$amountRaw<=0)kareta_json(['ok'=>false,'error'=>'invalid_refund'],422);$orgId=(string)($context['organizationId']??'');$sql="SELECT t.*,i.owner_user_id,i.organization_id AS invoice_org,i.paid_amount,i.total_amount,i.id AS invoice_id FROM finance_transactions t JOIN finance_invoices i ON i.id=t.invoice_id WHERE t.transaction_key=? AND ".($orgId!==''?'(i.owner_user_id=? OR i.organization_id=?)':'i.owner_user_id=?')." LIMIT 1";$args=$orgId!==''?[$txKey,$uid,$orgId]:[$txKey,$uid];$pdo->beginTransaction();try{$st=$pdo->prepare($sql);$st->execute($args);$tx=$st->fetch(PDO::FETCH_ASSOC);if(!$tx)kareta_json(['ok'=>false,'error'=>'transaction_not_found'],404);$st=$pdo->prepare("SELECT COALESCE(SUM(amount),0) FROM finance_refunds WHERE transaction_id=? AND status='completed'");$st->execute([(int)$tx['id']]);$already=(float)$st->fetchColumn();$amount=round((float)$amountRaw,2);if($amount>$tx['amount']-$already+0.001)kareta_json(['ok'=>false,'error'=>'refund_exceeds_transaction'],422);$refundKey='ref_'.bin2hex(random_bytes(10));$st=$pdo->prepare("INSERT INTO finance_refunds(refund_key,transaction_id,owner_user_id,amount,reason,status) VALUES(?,?,?,?,?,'completed')");$st->execute([$refundKey,(int)$tx['id'],$uid,number_format($amount,2,'.',''),mb_substr(trim((string)($body['reason']??'')),0,255)]);$newPaid=max(0,round((float)$tx['paid_amount']-$amount,2));$status=$newPaid<=0?'sent':($newPaid+0.001>=(float)$tx['total_amount']?'paid':'partially_paid');$pdo->prepare("UPDATE finance_invoices SET paid_amount=?,status=?,paid_at=IF(?='paid',paid_at,NULL) WHERE id=?")->execute([number_format($newPaid,2,'.',''),$status,$status,(int)$tx['invoice_id']]);$ledger=$pdo->prepare("INSERT INTO finance_ledger(ledger_key,owner_user_id,organization_id,account_code,entry_type,amount,currency,reference_type,reference_key,description) VALUES(?,?,?,?,?,?,'KZT','refund',?,?)");$ledger->execute(['ledger:'.$refundKey.':cash',$uid,$tx['invoice_org'],'cash','credit',number_format($amount,2,'.',''),$refundKey,'Возврат по транзакции '.$txKey]);$ledger->execute(['ledger:'.$refundKey.':revenue',$uid,$tx['invoice_org'],'service_revenue','debit',number_format($amount,2,'.',''),$refundKey,'Корректировка выручки']);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}kareta_json(['ok'=>true,'refundKey'=>$refundKey,'invoiceStatus'=>$status,'paidAmount'=>number_format($newPaid,2,'.','')],201);
    }

    if ($action === 'booking.create') {
        kareta_require_capability($pdo,$user,($context['type']??'personal')==='organization'?'calendar.manageOrganization':'calendar.manageOwn');
        $title=trim((string)($body['title']??'Запись на обслуживание'));$startRaw=trim((string)($body['startsAt']??''));$endRaw=trim((string)($body['endsAt']??''));
        try{$start=new DateTimeImmutable($startRaw);$end=new DateTimeImmutable($endRaw);}catch(Throwable $e){kareta_json(['ok'=>false,'error'=>'invalid_booking_datetime'],422);}if($title===''||mb_strlen($title)>255||$end<=$start)kareta_json(['ok'=>false,'error'=>'invalid_booking'],422);
        $masterId=max(0,(int)($body['masterUserId']??0));$resourceKey=$cleanToken($body['resourceKey']??'',128);$entityType=$cleanToken($body['entityType']??'',64);$entityKey=$cleanToken($body['entityKey']??'',128);
        if(($entityType!==''||$entityKey!=='')&&($entityType===''||$entityKey===''||!$entityAccessible($pdo,$uid,$context,$entityType,$entityKey)))kareta_json(['ok'=>false,'error'=>'booking_entity_access_denied'],403);
        $orgId=(string)($context['organizationId']??'');$where=["c.status NOT IN ('cancelled','completed')","c.starts_at<?","c.ends_at>?"];$args=[$end->format('Y-m-d H:i:s'),$start->format('Y-m-d H:i:s')];
        if($masterId>0){$where[]='b.master_user_id=?';$args[]=$masterId;}elseif($resourceKey!==''){$where[]='b.resource_key=?';$args[]=$resourceKey;}elseif($orgId!==''){$where[]='c.organization_id=?';$args[]=$orgId;}else{$where[]='c.owner_user_id=?';$args[]=$uid;}
        $st=$pdo->prepare("SELECT c.id FROM calendar_events c LEFT JOIN service_bookings b ON b.calendar_event_id=c.id WHERE ".implode(' AND ',$where)." LIMIT 1");$st->execute($args);if($st->fetchColumn())kareta_json(['ok'=>false,'error'=>'booking_conflict'],409);
        $bookingKey='book_'.bin2hex(random_bytes(10));$payload=is_array($body['payload']??null)?$body['payload']:[];$pdo->beginTransaction();try{
            $st=$pdo->prepare("INSERT INTO calendar_events(owner_user_id,organization_id,title,starts_at,ends_at,status,entity_type,entity_key,payload_json) VALUES(?,?,?,?,?,'scheduled',?,?,?)");$st->execute([$uid,$orgId?:null,$title,$start->format('Y-m-d H:i:s'),$end->format('Y-m-d H:i:s'),$entityType?:null,$entityKey?:null,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);$calendarId=(int)$pdo->lastInsertId();
            $st=$pdo->prepare("INSERT INTO service_bookings(booking_key,calendar_event_id,owner_user_id,organization_id,master_user_id,resource_key,entity_type,entity_key,status,notes,payload_json) VALUES(?,?,?,?,?,?,?,?, 'confirmed',?,?)");$st->execute([$bookingKey,$calendarId,$uid,$orgId?:null,$masterId?:null,$resourceKey?:null,$entityType?:null,$entityKey?:null,trim((string)($body['notes']??'')),json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
            if($entityType!==''&&$entityKey!==''){$eventPayload=['title'=>'Запись подтверждена','message'=>$title,'startsAt'=>$start->format(DATE_ATOM),'endsAt'=>$end->format(DATE_ATOM),'bookingKey'=>$bookingKey];$st=$pdo->prepare("INSERT INTO domain_events(event_type,aggregate_type,aggregate_key,actor_user_id,organization_id,payload_json) VALUES('booking.confirmed',?,?,?,?,?)");$st->execute([$entityType,$entityKey,$uid,$orgId?:null,json_encode($eventPayload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);$eventId=(int)$pdo->lastInsertId();$deliverEvent($pdo,$eventId,'booking.confirmed',$entityType,$entityKey,$uid,$orgId?:null,$eventPayload);}
            $pdo->commit();
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
        kareta_json(['ok'=>true,'bookingKey'=>$bookingKey,'calendarEventId'=>$calendarId,'status'=>'confirmed'],201);
    }
    if ($action === 'booking.cancel') {
        kareta_require_capability($pdo,$user,($context['type']??'personal')==='organization'?'calendar.manageOrganization':'calendar.manageOwn');$bookingKey=$cleanToken($body['bookingKey']??'',64);if($bookingKey==='')kareta_json(['ok'=>false,'error'=>'invalid_booking_key'],422);
        $orgId=(string)($context['organizationId']??'');$sql="SELECT b.id,b.calendar_event_id FROM service_bookings b WHERE b.booking_key=? AND ".($orgId!==''?'(b.owner_user_id=? OR b.organization_id=?)':'b.owner_user_id=?')." LIMIT 1";$args=$orgId!==''?[$bookingKey,$uid,$orgId]:[$bookingKey,$uid];$st=$pdo->prepare($sql);$st->execute($args);$row=$st->fetch(PDO::FETCH_ASSOC);if(!$row)kareta_json(['ok'=>false,'error'=>'booking_not_found'],404);
        $pdo->beginTransaction();try{$pdo->prepare("UPDATE service_bookings SET status='cancelled' WHERE id=?")->execute([(int)$row['id']]);$pdo->prepare("UPDATE calendar_events SET status='cancelled' WHERE id=?")->execute([(int)$row['calendar_event_id']]);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}kareta_json(['ok'=>true,'bookingKey'=>$bookingKey,'status'=>'cancelled']);
    }
    if ($action === 'event.create') {
        kareta_require_capability($pdo,$user,'domain.event.create');
        $type=$cleanToken($body['eventType']??'',96);$aggregateType=$cleanToken($body['aggregateType']??'',64);$aggregateKey=$cleanToken($body['aggregateKey']??'',128);
        if($type===''||$aggregateType===''||$aggregateKey===''||!preg_match('/^[a-z][a-z0-9_.-]{2,95}$/',$type))kareta_json(['ok'=>false,'error'=>'invalid_event'],422);
        if(!$entityAccessible($pdo,$uid,$context,$aggregateType,$aggregateKey))kareta_json(['ok'=>false,'error'=>'aggregate_access_denied'],403);
        $payload=$body['payload']??[];if(!is_array($payload))$payload=[];
        $stmt=$pdo->prepare("INSERT INTO domain_events(event_type,aggregate_type,aggregate_key,actor_user_id,organization_id,payload_json) VALUES(?,?,?,?,?,?)");$stmt->execute([$type,$aggregateType,$aggregateKey,$uid,$context['organizationId']??null,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
        $eventId=(int)$pdo->lastInsertId();$deliverEvent($pdo,$eventId,$type,$aggregateType,$aggregateKey,$uid,$context['organizationId']??null,$payload);
        kareta_json(['ok'=>true,'eventId'=>$eventId,'recipientsDelivered'=>true,'entityType'=>'domain_event','entityId'=>(string)$eventId],201);
    }
    if ($action === 'calendar.create') {
        kareta_require_capability($pdo,$user,($context['type']??'personal')==='organization'?'calendar.manageOrganization':'calendar.manageOwn');
        $title=trim((string)($body['title']??''));$startRaw=trim((string)($body['startsAt']??''));$endRaw=trim((string)($body['endsAt']??''));
        try{$start=new DateTimeImmutable($startRaw);$end=new DateTimeImmutable($endRaw);}catch(Throwable $e){kareta_json(['ok'=>false,'error'=>'invalid_calendar_datetime'],422);}
        if($title===''||mb_strlen($title)>255||$end<=$start)kareta_json(['ok'=>false,'error'=>'invalid_calendar_event'],422);
        $entityType=$cleanToken($body['entityType']??'',64);$entityKey=$cleanToken($body['entityKey']??'',128);
        if(($entityType!==''||$entityKey!=='')&&($entityType===''||$entityKey===''||!$entityAccessible($pdo,$uid,$context,$entityType,$entityKey)))kareta_json(['ok'=>false,'error'=>'calendar_entity_access_denied'],403);
        $overlap=$pdo->prepare("SELECT id FROM calendar_events WHERE ".(($context['organizationId']??null)?'organization_id=?':'owner_user_id=?')." AND status NOT IN ('cancelled','completed') AND starts_at<? AND ends_at>? LIMIT 1");$scope=($context['organizationId']??null)?:$uid;$overlap->execute([$scope,$end->format('Y-m-d H:i:s'),$start->format('Y-m-d H:i:s')]);if($overlap->fetchColumn())kareta_json(['ok'=>false,'error'=>'calendar_conflict'],409);
        $stmt=$pdo->prepare("INSERT INTO calendar_events(owner_user_id,organization_id,title,starts_at,ends_at,status,entity_type,entity_key,payload_json) VALUES(?,?,?,?,?,?,?,?,?)");$stmt->execute([$uid,$context['organizationId']??null,$title,$start->format('Y-m-d H:i:s'),$end->format('Y-m-d H:i:s'),'scheduled',$entityType?:null,$entityKey?:null,json_encode(is_array($body['payload']??null)?$body['payload']:[],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
        kareta_json(['ok'=>true,'calendarEventId'=>(int)$pdo->lastInsertId(),'entityType'=>'calendar_event','entityId'=>(string)$pdo->lastInsertId()],201);
    }
    if ($action === 'payment.create') {
        kareta_require_capability($pdo,$user,'payment.intent.create');
        $amountRaw=trim((string)($body['amount']??''));if(!preg_match('/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/',$amountRaw))kareta_json(['ok'=>false,'error'=>'invalid_amount'],422);
        $amount=number_format((float)$amountRaw,2,'.','');if((float)$amount<=0)kareta_json(['ok'=>false,'error'=>'invalid_amount'],422);
        $method=$cleanToken($body['method']??'manual',32);if(!in_array($method,['manual','cash','card','bank_transfer','invoice'],true))kareta_json(['ok'=>false,'error'=>'invalid_payment_method'],422);
        $entityType=$cleanToken($body['entityType']??'',64);$entityKey=$cleanToken($body['entityKey']??'',128);if(($entityType!==''||$entityKey!=='')&&($entityType===''||$entityKey===''||!$entityAccessible($pdo,$uid,$context,$entityType,$entityKey)))kareta_json(['ok'=>false,'error'=>'payment_entity_access_denied'],403);
        $key='pay_'.bin2hex(random_bytes(12));$stmt=$pdo->prepare("INSERT INTO payment_records(payment_key,payer_user_id,organization_id,entity_type,entity_key,amount,currency,status,method,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?)");$stmt->execute([$key,$uid,$context['organizationId']??null,$entityType?:null,$entityKey?:null,$amount,'KZT','pending',$method,json_encode(is_array($body['payload']??null)?$body['payload']:[],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
        kareta_json(['ok'=>true,'paymentKey'=>$key,'status'=>'pending','entityType'=>'payment','entityId'=>$key],201);
    }
    if ($action === 'notification.read') {
        kareta_require_capability($pdo,$user,'notifications.read');
        $id=(int)($body['id']??0);if($id<=0)kareta_json(['ok'=>false,'error'=>'invalid_notification'],422);$stmt=$pdo->prepare("UPDATE notification_center SET status='read',read_at=NOW() WHERE id=? AND user_id=?");$stmt->execute([$id,$uid]);if($stmt->rowCount()===0)kareta_json(['ok'=>false,'error'=>'notification_not_found'],404);kareta_json(['ok'=>true]);
    }
    if ($action === 'notification.readAll') {
        kareta_require_capability($pdo,$user,'notifications.read');
        $stmt=$pdo->prepare("UPDATE notification_center SET status='read',read_at=COALESCE(read_at,NOW()) WHERE user_id=? AND status<>'read'");$stmt->execute([$uid]);kareta_json(['ok'=>true,'updated'=>$stmt->rowCount()]);
    }
}
kareta_json(['ok'=>false,'error'=>'not_found'],404);
