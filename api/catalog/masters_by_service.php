<?php
declare(strict_types=1);
/**
 * Public staging service-to-provider discovery: only active approved provider offers.
 * Read-only. Does not infer qualification from profession, equipment, or platform offers.
 */
require_once dirname(__DIR__).'/bootstrap.php';
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    kareta_json(['ok'=>false,'error'=>'method_not_allowed'],405);
}
$id=trim((string)($_GET['serviceId'] ?? ''));
$type=trim((string)($_GET['type'] ?? 'all'));
$city=trim((string)($_GET['city'] ?? ''));
$search=trim((string)($_GET['search'] ?? ''));
if (!preg_match('/^[a-zA-Z0-9_:-]{1,64}$/D',$id)) kareta_json(['ok'=>false,'error'=>'service_id_invalid'],422);
if (!in_array($type,['all','master','sto'],true) || mb_strlen($city)>120 || mb_strlen($search)>120) {
    kareta_json(['ok'=>false,'error'=>'filter_invalid'],422);
}
$pdo=kareta_pdo();
if (!$pdo instanceof PDO) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
try {
    $exists=$pdo->prepare('SELECT id FROM service_catalog WHERE id=? AND active=1 LIMIT 1');
    $exists->execute([$id]);
    if (!$exists->fetchColumn()) kareta_json(['ok'=>false,'error'=>'service_not_found'],404);
    $payload=[
        'serviceId'=>$id,
        'masters'=>[],
        'stations'=>[],
        'metrics'=>['masters'=>0,'stations'=>0,'offers'=>0],
        'source'=>'verified_provider_offers',
        'availabilityConfirmed'=>false,
    ];
    $conditions="so.service_id=? AND so.active=1 AND so.booking_enabled=1
        AND so.moderation_status='approved' AND so.availability_status='available'";
    if ($type!=='sto') {
        $where=["m.active=1","COALESCE(m.profile_visible,1)=1",
            "EXISTS (SELECT 1 FROM service_offers so WHERE $conditions
                AND so.owner_type='master' AND so.owner_entity_id=m.id)"];
        $params=[$id];
        if ($city!=='') {$where[]="COALESCE(NULLIF(m.city,''),NULLIF(u.city,''),'')=?";$params[]=$city;}
        if ($search!=='') {
            $where[]="(COALESCE(NULLIF(u.name,''),m.name) LIKE ? OR COALESCE(NULLIF(u.spec,''),m.spec) LIKE ?)";
            $like='%'.$search.'%';array_push($params,$like,$like);
        }
        $sql="SELECT m.id,COALESCE(NULLIF(u.name,''),m.name) name,
            COALESCE(NULLIF(u.spec,''),m.spec) spec,
            COALESCE(NULLIF(m.city,''),NULLIF(u.city,''),'') city,
            COALESCE(m.rating,0) rating,COALESCE(m.reviews_count,0) reviewsCount,
            COALESCE(m.availability,'') availability,
            COALESCE(m.work_mode,'shop') workMode,
            'График уточняется при записи' availabilityLabel,
            (SELECT COUNT(*) FROM service_offers sx WHERE sx.service_id=".$pdo->quote($id)."
              AND sx.owner_type='master' AND sx.owner_entity_id=m.id AND sx.active=1
              AND sx.booking_enabled=1 AND sx.moderation_status='approved'
              AND sx.availability_status='available') offerCount,
            (SELECT MIN(NULLIF(sx.price,0)) FROM service_offers sx
              WHERE sx.service_id=".$pdo->quote($id)."
                AND sx.owner_type='master' AND sx.owner_entity_id=m.id
                AND sx.active=1 AND sx.booking_enabled=1 AND sx.moderation_status='approved'
                AND sx.availability_status='available' AND sx.price_type<>'agreement') minPrice
            FROM masters m LEFT JOIN users u ON u.id=m.user_id
            WHERE ".implode(' AND ',$where)." ORDER BY offerCount DESC,rating DESC,name LIMIT 100";
        $stmt=$pdo->prepare($sql);$stmt->execute($params);
        $payload['masters']=$stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
    if ($type!=='master') {
        $where=["s.active=1","TRIM(COALESCE(s.name,''))<>''","TRIM(COALESCE(s.city,''))<>''","TRIM(COALESCE(s.address,''))<>''",
            "EXISTS (SELECT 1 FROM service_offers so WHERE $conditions
                AND so.owner_type='sto' AND so.owner_entity_id=s.id)"];
        $params=[$id];
        if ($city!=='') {$where[]="COALESCE(s.city,'')=?";$params[]=$city;}
        if ($search!=='') {$where[]="(s.name LIKE ? OR COALESCE(s.primary_specialization,'') LIKE ?)";$like='%'.$search.'%';array_push($params,$like,$like);}
        $sql="SELECT s.id,s.name,COALESCE(s.primary_specialization,'Автосервис') spec,
            COALESCE(s.city,'') city,COALESCE(s.address,'') address,
            COALESCE(NULLIF(s.work_hours,''),'График уточняется') workHours,COALESCE(s.reception_status,'busy') receptionStatus,COALESCE(s.rating,0) rating,
            COALESCE(s.orders_count,0) ordersCount,
            (SELECT COUNT(*) FROM service_offers sx WHERE sx.service_id=".$pdo->quote($id)."
              AND sx.owner_type='sto' AND sx.owner_entity_id=s.id AND sx.active=1
              AND sx.booking_enabled=1 AND sx.moderation_status='approved'
              AND sx.availability_status='available') offerCount,
            (SELECT MIN(NULLIF(sx.price,0)) FROM service_offers sx
              WHERE sx.service_id=".$pdo->quote($id)."
                AND sx.owner_type='sto' AND sx.owner_entity_id=s.id
                AND sx.active=1 AND sx.booking_enabled=1 AND sx.moderation_status='approved'
                AND sx.availability_status='available' AND sx.price_type<>'agreement') minPrice
            FROM sto_profiles s WHERE ".implode(' AND ',$where)." ORDER BY offerCount DESC,rating DESC,name LIMIT 100";
        $stmt=$pdo->prepare($sql);$stmt->execute($params);
        $payload['stations']=$stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
    $payload['metrics']['masters']=count($payload['masters']);
    $payload['metrics']['stations']=count($payload['stations']);
    $payload['metrics']['offers']=array_sum(array_map(static fn($r)=>(int)$r['offerCount'],$payload['masters']))+
        array_sum(array_map(static fn($r)=>(int)$r['offerCount'],$payload['stations']));
    header('Cache-Control: no-store, private');
    kareta_json(['ok'=>true,'data'=>$payload]);
} catch (Throwable $e) {
    if (function_exists('kareta_log_error')) kareta_log_error('MASTERS_BY_SERVICE',$e->getMessage());
    kareta_json(['ok'=>false,'error'=>'masters_by_service_unavailable'],503);
}
