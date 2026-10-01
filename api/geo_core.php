<?php
declare(strict_types=1);

function kareta_geo_point_id(string $ownerType,string $ownerId,string $kind): string {
    return 'geo_'.hash('sha256',strtolower(trim($ownerType)).'|'.trim($ownerId).'|'.strtolower(trim($kind)));
}
function kareta_geo_number($value): ?float {
    if($value===null||$value===''||!is_numeric($value))return null;
    return (float)$value;
}
function kareta_geo_coords_valid(?float $lat,?float $lng): bool {
    if($lat===null&&$lng===null)return true;
    return $lat!==null&&$lng!==null&&$lat>=-90.0&&$lat<=90.0&&$lng>=-180.0&&$lng<=180.0;
}
function kareta_geo_upsert_point(PDO $pdo,array $point): array {
    if(!kareta_table_exists($pdo,'geo_points'))throw new RuntimeException('geo_schema_missing');
    $ownerType=strtolower(trim((string)($point['ownerType']??$point['owner_type']??'')));
    $ownerId=trim((string)($point['ownerId']??$point['owner_id']??''));
    $kind=strtolower(trim((string)($point['kind']??'service')));
    $allowedOwners=['master','sto','organization','organization_unit','shop'];
    $allowedKinds=['service','branch','pickup','warehouse','mobile_origin'];
    $allowedVisibility=['exact','approximate','city','hidden'];
    if(!in_array($ownerType,$allowedOwners,true)||$ownerId==='')throw new InvalidArgumentException('invalid_geo_owner');
    if(!in_array($kind,$allowedKinds,true))throw new InvalidArgumentException('invalid_geo_kind');
    $lat=kareta_geo_number($point['latitude']??null);$lng=kareta_geo_number($point['longitude']??null);
    if(!kareta_geo_coords_valid($lat,$lng))throw new InvalidArgumentException('invalid_geo_coordinates');
    $visibility=strtolower(trim((string)($point['visibility']??'hidden')));
    if(!in_array($visibility,$allowedVisibility,true))$visibility='hidden';
    if($kind==='warehouse')$visibility='hidden';
    if($kind==='mobile_origin'&&$visibility==='exact'&&empty($point['publishExact']))$visibility='city';
    if($visibility==='exact'&&($lat===null||$lng===null))throw new InvalidArgumentException('exact_geo_coordinates_required');
    $source=strtolower(trim((string)($point['source']??'manual')));
    if(!in_array($source,['manual','gps','geocoder','organization'],true))$source='manual';
    $label=mb_substr(trim((string)($point['label']??'')),0,191,'UTF-8');
    $country=strtoupper(mb_substr(trim((string)($point['countryCode']??$point['country_code']??'KZ')),0,8,'UTF-8'));
    $city=mb_substr(trim((string)($point['city']??'')),0,120,'UTF-8');
    $address=mb_substr(trim((string)($point['address']??'')),0,255,'UTF-8');
    $metadata=is_array($point['metadata']??null)?json_encode($point['metadata'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES):null;
    $active=array_key_exists('active',$point)?!empty($point['active']):true;
    $verifiedAt=trim((string)($point['verifiedAt']??$point['verified_at']??''))?:null;
    $id=kareta_geo_point_id($ownerType,$ownerId,$kind);
    $q=$pdo->prepare("INSERT INTO geo_points
      (id,owner_type,owner_id,kind,label,country_code,city,address,latitude,longitude,source,visibility,metadata_json,verified_at,active)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE label=VALUES(label),country_code=VALUES(country_code),city=VALUES(city),address=VALUES(address),
        latitude=VALUES(latitude),longitude=VALUES(longitude),source=VALUES(source),visibility=VALUES(visibility),
        metadata_json=VALUES(metadata_json),verified_at=VALUES(verified_at),active=VALUES(active),updated_at=CURRENT_TIMESTAMP");
    $q->execute([$id,$ownerType,$ownerId,$kind,$label,$country,$city,$address,$lat,$lng,$source,$visibility,$metadata,$verifiedAt,$active?1:0]);
    return ['id'=>$id,'ownerType'=>$ownerType,'ownerId'=>$ownerId,'kind'=>$kind,'label'=>$label,'countryCode'=>$country,'city'=>$city,'address'=>$address,'latitude'=>$lat,'longitude'=>$lng,'source'=>$source,'visibility'=>$visibility,'active'=>$active];
}
function kareta_geo_set_owner_kind_active(PDO $pdo,string $ownerType,string $ownerId,string $kind,bool $active): void {
    if(!kareta_table_exists($pdo,'geo_points'))return;
    $q=$pdo->prepare("UPDATE geo_points SET active=?,updated_at=CURRENT_TIMESTAMP WHERE owner_type=? AND owner_id=? AND kind=?");
    $q->execute([$active?1:0,strtolower(trim($ownerType)),trim($ownerId),strtolower(trim($kind))]);
}
function kareta_geo_owner_points(PDO $pdo,string $ownerType,string $ownerId,bool $publicOnly=false): array {
    if(!kareta_table_exists($pdo,'geo_points'))return [];
    $sql="SELECT id,owner_type AS ownerType,owner_id AS ownerId,kind,label,country_code AS countryCode,city,address,latitude,longitude,source,visibility,verified_at AS verifiedAt,active,updated_at AS updatedAt FROM geo_points WHERE owner_type=? AND owner_id=? AND active=1";
    if($publicOnly)$sql.=" AND visibility='exact' AND latitude IS NOT NULL AND longitude IS NOT NULL";
    $sql.=" ORDER BY FIELD(kind,'service','branch','pickup','warehouse','mobile_origin'),updated_at DESC";
    $q=$pdo->prepare($sql);$q->execute([strtolower(trim($ownerType)),trim($ownerId)]);
    $rows=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
    foreach($rows as &$row){$row['active']=!empty($row['active']);if($row['latitude']!==null)$row['latitude']=(float)$row['latitude'];if($row['longitude']!==null)$row['longitude']=(float)$row['longitude'];}unset($row);
    return $rows;
}
