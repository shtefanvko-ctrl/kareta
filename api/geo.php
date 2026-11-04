<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/request_logger.php';
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/identity/auth_resolver.php';
require_once __DIR__ . '/geo_owner_access.php';
require_once __DIR__ . '/geo_core.php';

$pdo = kareta_pdo();
if (!$pdo instanceof PDO) kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);
if (!kareta_table_exists($pdo,'geo_points')) kareta_json(['ok'=>false,'error'=>'geo_schema_missing'],503);

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = strtolower(trim((string)($_GET['action'] ?? 'nearby')));

function geo_text($value, int $max=255): string {
    $value = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u','',(string)$value) ?? '');
    return mb_substr($value,0,$max,'UTF-8');
}
function geo_float($value): ?float {
    if ($value === null || $value === '' || !is_numeric($value)) return null;
    $number=(float)$value;
    return is_finite($number)?$number:null;
}
function geo_valid_lat(?float $lat): bool { return $lat !== null && $lat >= -90.0 && $lat <= 90.0; }
function geo_valid_lng(?float $lng): bool { return $lng !== null && $lng >= -180.0 && $lng <= 180.0; }
function geo_kinds(): array { return ['service','branch','pickup','warehouse','mobile_origin']; }
function geo_visibility(): array { return ['exact','approximate','city','hidden']; }
function geo_default_visibility(string $kind): string {
    if ($kind === 'warehouse') return 'hidden';
    if ($kind === 'mobile_origin') return 'city';
    return 'exact';
}
function geo_id(string $ownerType,string $ownerId,string $kind): string {
    return 'geo_'.hash('sha256',$ownerType.'|'.$ownerId.'|'.$kind);
}
function geo_haversine(float $lat1,float $lng1,float $lat2,float $lng2): float {
    $r=6371.0088;
    $dLat=deg2rad($lat2-$lat1);
    $dLng=deg2rad($lng2-$lng1);
    $a=sin($dLat/2)**2+cos(deg2rad($lat1))*cos(deg2rad($lat2))*sin($dLng/2)**2;
    return 2*$r*asin(min(1.0,sqrt($a)));
}
function geo_public_payload(array $row,float $distanceKm): array {
    $payload=[
        'id'=>(string)$row['id'],
        'ownerType'=>(string)$row['owner_type'],
        'ownerId'=>(string)$row['owner_id'],
        'kind'=>(string)$row['kind'],
        'label'=>(string)$row['label'],
        'countryCode'=>(string)$row['country_code'],
        'city'=>(string)$row['city'],
        'address'=>(string)$row['address'],
        'latitude'=>(float)$row['latitude'],
        'longitude'=>(float)$row['longitude'],
        'distanceKm'=>round($distanceKm,2),
        'verifiedAt'=>$row['verified_at']??null,
    ];
    return $payload;
}

if ($method==='GET' && $action==='nearby') {
    $lat=geo_float($_GET['lat']??null);
    $lng=geo_float($_GET['lng']??null);
    if (!geo_valid_lat($lat) || !geo_valid_lng($lng)) kareta_json(['ok'=>false,'error'=>'invalid_coordinates'],422);

    $radius=max(1.0,min(100.0,(float)($_GET['radiusKm']??20)));
    $limit=max(1,min(100,(int)($_GET['limit']??30)));
    $requested=array_values(array_filter(array_unique(array_map(
        static fn($v)=>strtolower(trim((string)$v)),
        explode(',',(string)($_GET['types']??implode(',',geo_owner_types())))
    )),static fn($v)=>in_array($v,geo_owner_types(),true)));
    if (!$requested) $requested=geo_owner_types();

    $items=[];
    foreach(kareta_geo_nearby($pdo,$lat,$lng,$radius,$requested,$limit) as $row) {
        $items[]=geo_public_payload($row,(float)$row['geoDistanceKm']);
    }
    kareta_json(['ok'=>true,'items'=>$items,'meta'=>['radiusKm'=>$radius,'limit'=>$limit,'distanceMode'=>'straight_line','visibility'=>'exact_only']]);
}

if ($method==='GET' && $action==='entity') {
    $ownerType=strtolower(geo_text($_GET['ownerType']??'',32));
    $ownerId=geo_text($_GET['ownerId']??'',96);
    if (!in_array($ownerType,geo_owner_types(),true) || $ownerId==='') kareta_json(['ok'=>false,'error'=>'invalid_owner'],422);
    $q=$pdo->prepare("SELECT id,owner_type,owner_id,kind,label,country_code,city,address,latitude,longitude,verified_at
                      FROM geo_points
                      WHERE owner_type=? AND owner_id=? AND ".kareta_geo_public_where()."
                      ORDER BY FIELD(kind,'service','branch','pickup','mobile_origin'),updated_at DESC LIMIT 100");
    $q->execute([$ownerType,$ownerId]);
    $items=[];
    foreach ($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $row) {
        $items[]=geo_public_payload($row,0.0);
        unset($items[array_key_last($items)]['distanceKm']);
    }
    kareta_json(['ok'=>true,'items'=>$items]);
}

if ($method==='POST' && $action==='upsert') {
    $body=json_decode((string)file_get_contents('php://input'),true);
    if (!is_array($body)) $body=[];
    try {$auth=(new KaretaAuthResolver($pdo))->resolve(true);}
    catch (DomainException $e) { kareta_json(['ok'=>false,'error'=>$e->getMessage()],$e->getMessage()==='session_identity_conflict'?409:401); }

    $ownerType=strtolower(geo_text($body['ownerType']??'',32));
    $ownerId=geo_text($body['ownerId']??'',96);
    $kind=strtolower(geo_text($body['kind']??'service',32));
    if (!in_array($ownerType,geo_owner_types(),true) || $ownerId==='') kareta_json(['ok'=>false,'error'=>'invalid_owner'],422);
    if (!in_array($kind,geo_kinds(),true)) kareta_json(['ok'=>false,'error'=>'invalid_kind'],422);
    if (!geo_context_allows_owner($pdo,$auth,$ownerType,$ownerId)) kareta_json(['ok'=>false,'error'=>'geo_owner_forbidden'],403);

    $lat=geo_float($body['latitude']??null);
    $lng=geo_float($body['longitude']??null);
    if (($lat!==null && !geo_valid_lat($lat)) || ($lng!==null && !geo_valid_lng($lng)) || (($lat===null)!==($lng===null))) {
        kareta_json(['ok'=>false,'error'=>'invalid_coordinates'],422);
    }

    $visibility=strtolower(geo_text($body['visibility']??geo_default_visibility($kind),24));
    if (!in_array($visibility,geo_visibility(),true)) kareta_json(['ok'=>false,'error'=>'invalid_visibility'],422);
    if ($kind==='warehouse') $visibility='hidden';
    if (kareta_geo_pickup_needs_consent($ownerType,$kind,$visibility) && !kareta_geo_explicit_publish_consent($body['publishExact']??null)) {
        kareta_json(['ok'=>false,'error'=>'exact_pickup_requires_explicit_consent'],422);
    }
    if ($kind==='mobile_origin' && $visibility==='exact' && !kareta_geo_explicit_publish_consent($body['publishExact']??null)) {
        kareta_json(['ok'=>false,'error'=>'exact_mobile_origin_requires_explicit_consent'],422);
    }
    if ($visibility==='exact' && ($lat===null || $lng===null)) kareta_json(['ok'=>false,'error'=>'exact_coordinates_required'],422);

    $label=geo_text($body['label']??'',191);
    $countryCode=strtoupper(geo_text($body['countryCode']??'KZ',8));
    $city=geo_text($body['city']??'',120);
    $address=geo_text($body['address']??'',255);
    $source=strtolower(geo_text($body['source']??'manual',24));
    if (!in_array($source,['manual','gps','geocoder','organization'],true)) $source='manual';
    $active=array_key_exists('active',$body)?(bool)$body['active']:true;
    if ($address==='' && $lat===null && $city==='') kareta_json(['ok'=>false,'error'=>'geo_location_required'],422);

    kareta_idempotency_begin($pdo,'geo.upsert',$body);
    try{
        $point=kareta_geo_upsert_point($pdo,[
            'ownerType'=>$ownerType,'ownerId'=>$ownerId,'kind'=>$kind,'label'=>$label,'countryCode'=>$countryCode,
            'city'=>$city,'address'=>$address,'latitude'=>$lat,'longitude'=>$lng,'source'=>$source,
            'visibility'=>$visibility,'active'=>$active,'publishExact'=>kareta_geo_explicit_publish_consent($body['publishExact']??null),
            'metadata'=>is_array($body['metadata']??null)?$body['metadata']:[]
        ]);
    }catch(InvalidArgumentException $e){kareta_json(['ok'=>false,'error'=>$e->getMessage()],422);}
    kareta_json(['ok'=>true,'point'=>$point]);
}

kareta_json(['ok'=>false,'error'=>'not_found'],404);
