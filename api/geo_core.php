<?php
declare(strict_types=1);

function kareta_geo_point_id(string $ownerType,string $ownerId,string $kind): string {
    return 'geo_'.hash('sha256',strtolower(trim($ownerType)).'|'.trim($ownerId).'|'.strtolower(trim($kind)));
}
function kareta_geo_number($value): ?float {
    if($value===null||$value===''||!is_numeric($value))return null;
    $number=(float)$value;
    return is_finite($number) ? $number : null;
}
function kareta_geo_coords_valid(?float $lat,?float $lng): bool {
    if($lat===null&&$lng===null)return true;
    return $lat!==null&&$lng!==null&&$lat>=-90.0&&$lat<=90.0&&$lng>=-180.0&&$lng<=180.0;
}
/**
 * Exact-public Geo boundary. Private mobile origins need an explicit
 * server-recorded consent receipt; user-supplied metadata cannot create it.
 */
function kareta_geo_public_where(): string {
    return "active=1 AND visibility='exact' AND kind<>'warehouse'
        AND latitude IS NOT NULL AND longitude IS NOT NULL
        AND (kind<>'mobile_origin' OR
            (JSON_VALID(metadata_json) AND
             NULLIF(JSON_UNQUOTE(JSON_EXTRACT(
                IF(JSON_VALID(metadata_json),metadata_json,'{}'),
                '$.geoExactConsentRecordedAt')), '') IS NOT NULL))";
}

/** Bounding box with antimeridian and pole handling. Always verify Haversine. */
function kareta_geo_bounds(float $lat,float $lng,float $radiusKm): array {
    $angular=$radiusKm/6371.0088;
    $latDelta=rad2deg($angular);
    $minLat=max(-90.0,$lat-$latDelta);
    $maxLat=min(90.0,$lat+$latDelta);
    if($minLat<=-90.0||$maxLat>=90.0) {
        return ['minLat'=>$minLat,'maxLat'=>$maxLat,'lngMode'=>'all','minLng'=>-180.0,'maxLng'=>180.0];
    }
    $cos=cos(deg2rad($lat));
    $ratio=sin($angular)/max(1.0e-12,abs($cos));
    if($ratio>=1.0) {
        return ['minLat'=>$minLat,'maxLat'=>$maxLat,'lngMode'=>'all','minLng'=>-180.0,'maxLng'=>180.0];
    }
    $lngDelta=rad2deg(asin(min(1.0,$ratio)));
    $left=$lng-$lngDelta;
    $right=$lng+$lngDelta;
    $wrap=$left<-180.0||$right>180.0;
    if($left<-180.0)$left+=360.0;
    if($right>180.0)$right-=360.0;
    return ['minLat'=>$minLat,'maxLat'=>$maxLat,
        'lngMode'=>$wrap?'wrap':'between','minLng'=>$left,'maxLng'=>$right];
}

/** Execute the exact-public nearest-neighbor search against real MySQL. */
function kareta_geo_nearby(PDO $pdo,float $lat,float $lng,float $radius,array $types,int $limit): array {
    $radius=max(1.0,min(100.0,$radius));
    $limit=max(1,min(100,$limit));
    $allowed=['master','sto','organization','organization_unit','shop'];
    $types=array_values(array_unique(array_intersect($types,$allowed)));
    if(!$types)return [];
    $bounds=kareta_geo_bounds($lat,$lng,$radius);
    $marks=implode(',',array_fill(0,count($types),'?'));
    $where="latitude BETWEEN ? AND ?";
    $params=[$lat,$lat,$lng,$bounds['minLat'],$bounds['maxLat']];
    if($bounds['lngMode']==='between'){
        $where.=" AND longitude BETWEEN ? AND ?";
        array_push($params,$bounds['minLng'],$bounds['maxLng']);
    }elseif($bounds['lngMode']==='wrap'){
        $where.=" AND (longitude >= ? OR longitude <= ?)";
        array_push($params,$bounds['minLng'],$bounds['maxLng']);
    }
    array_push($params,...$types);
    $params[]=$radius;
    // Index first via public bounding box, then Haversine ORDER/LIMIT.
    // An unordered LIMIT before the distance calculation drops closer results.
    $distanceSql="(6371.0088 * 2 * ASIN(LEAST(1.0,SQRT(
        POW(SIN(RADIANS(latitude - ?)/2),2)
        + COS(RADIANS(?))*COS(RADIANS(latitude))
        * POW(SIN(RADIANS(longitude - ?)/2),2)))))";
    $sql="SELECT id,owner_type,owner_id,kind,label,country_code,city,address,
                 latitude,longitude,verified_at, $distanceSql AS geoDistanceKm
          FROM geo_points
          WHERE ".kareta_geo_public_where()."
            AND $where AND owner_type IN ($marks)
          HAVING geoDistanceKm <= ?
          ORDER BY geoDistanceKm ASC, id ASC LIMIT $limit";
    $q=$pdo->prepare($sql);
    $q->execute($params);
    return $q->fetchAll(PDO::FETCH_ASSOC)?:[];
}

function kareta_geo_sync_legacy_address(PDO $pdo,array $point): void {
    $ownerType=(string)($point['ownerType']??'');$ownerId=(string)($point['ownerId']??'');$kind=(string)($point['kind']??'');
    $city=(string)($point['city']??'');$address=(string)($point['address']??'');$lat=$point['latitude']??null;$lng=$point['longitude']??null;
    if($ownerType==='master'&&$kind==='service'&&kareta_table_exists($pdo,'masters')){
        $sets=['city=?','service_address=?'];$args=[$city,$address];
        if(kareta_column_exists($pdo,'masters','service_lat')){$sets[]='service_lat=?';$args[]=$lat;}
        if(kareta_column_exists($pdo,'masters','service_lng')){$sets[]='service_lng=?';$args[]=$lng;}
        $args[]=$ownerId;$pdo->prepare("UPDATE masters SET ".implode(',',$sets)." WHERE BINARY id=BINARY ?")->execute($args);return;
    }
    if($ownerType==='sto'&&in_array($kind,['service','branch'],true)&&kareta_table_exists($pdo,'sto_profiles')){
        $pdo->prepare("UPDATE sto_profiles SET city=?,address=?,updated_at=CURRENT_TIMESTAMP WHERE BINARY id=BINARY ?")->execute([$city,$address,$ownerId]);return;
    }
    if($ownerType==='organization'&&kareta_table_exists($pdo,'organizations')){
        $pdo->prepare("UPDATE organizations SET city=?,address=?,updated_at=CURRENT_TIMESTAMP WHERE BINARY id=BINARY ?")->execute([$city,$address,$ownerId]);return;
    }
    if($ownerType==='organization_unit'&&kareta_table_exists($pdo,'organization_units')){
        $pdo->prepare("UPDATE organization_units SET city=?,address=?,updated_at=CURRENT_TIMESTAMP WHERE BINARY id=BINARY ?")->execute([$city,$address,$ownerId]);return;
    }
    if($ownerType==='shop'&&$kind==='warehouse'&&kareta_table_exists($pdo,'seller_profiles')){
        $pdo->prepare("UPDATE seller_profiles SET city=?,warehouse_address=?,updated_at=CURRENT_TIMESTAMP WHERE BINARY CAST(id AS CHAR)=BINARY ?")->execute([$city,$address,$ownerId]);
    }
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
    $meta=is_array($point['metadata']??null)?$point['metadata']:[];
    // This key is reserved: the client cannot manufacture a publication receipt.
    unset($meta['geoExactConsentRecordedAt']);
    if($kind==='mobile_origin'&&$visibility==='exact'&&!empty($point['publishExact'])){
        $meta['geoExactConsentRecordedAt']=gmdate('Y-m-d\TH:i:s\Z');
    }
    $metadata=$meta?json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR):null;
    $active=array_key_exists('active',$point)?!empty($point['active']):true;
    // Owner-editable input never grants verification status.
    $verifiedAt=null;
    $id=kareta_geo_point_id($ownerType,$ownerId,$kind);
    $q=$pdo->prepare("INSERT INTO geo_points
      (id,owner_type,owner_id,kind,label,country_code,city,address,latitude,longitude,source,visibility,metadata_json,verified_at,active)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        verified_at=CASE WHEN NOT(latitude<=>VALUES(latitude))
                            OR NOT(longitude<=>VALUES(longitude))
                            OR NOT(address<=>VALUES(address))
                         THEN NULL ELSE verified_at END,
        label=VALUES(label),country_code=VALUES(country_code),city=VALUES(city),address=VALUES(address),
        latitude=VALUES(latitude),longitude=VALUES(longitude),source=VALUES(source),visibility=VALUES(visibility),
        metadata_json=VALUES(metadata_json),
        active=VALUES(active),updated_at=CURRENT_TIMESTAMP");
    $q->execute([$id,$ownerType,$ownerId,$kind,$label,$country,$city,$address,$lat,$lng,$source,$visibility,$metadata,$verifiedAt,$active?1:0]);
    $result=['id'=>$id,'ownerType'=>$ownerType,'ownerId'=>$ownerId,'kind'=>$kind,'label'=>$label,'countryCode'=>$country,'city'=>$city,'address'=>$address,'latitude'=>$lat,'longitude'=>$lng,'source'=>$source,'visibility'=>$visibility,'active'=>$active];
    kareta_geo_sync_legacy_address($pdo,$result);
    return $result;
}
function kareta_geo_set_owner_kind_active(PDO $pdo,string $ownerType,string $ownerId,string $kind,bool $active): void {
    if(!kareta_table_exists($pdo,'geo_points'))return;
    $q=$pdo->prepare("UPDATE geo_points SET active=?,updated_at=CURRENT_TIMESTAMP WHERE owner_type=? AND owner_id=? AND kind=?");
    $q->execute([$active?1:0,strtolower(trim($ownerType)),trim($ownerId),strtolower(trim($kind))]);
}
function kareta_geo_owner_points(PDO $pdo,string $ownerType,string $ownerId,bool $publicOnly=false): array {
    if(!kareta_table_exists($pdo,'geo_points'))return [];
    $sql="SELECT id,owner_type AS ownerType,owner_id AS ownerId,kind,label,country_code AS countryCode,city,address,latitude,longitude,source,visibility,verified_at AS verifiedAt,active,updated_at AS updatedAt FROM geo_points WHERE owner_type=? AND owner_id=? AND active=1";
    if($publicOnly)$sql.=" AND ".kareta_geo_public_where();
    $sql.=" ORDER BY FIELD(kind,'service','branch','pickup','warehouse','mobile_origin'),updated_at DESC";
    $q=$pdo->prepare($sql);$q->execute([strtolower(trim($ownerType)),trim($ownerId)]);
    $rows=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
    foreach($rows as &$row){$row['active']=!empty($row['active']);if($row['latitude']!==null)$row['latitude']=(float)$row['latitude'];if($row['longitude']!==null)$row['longitude']=(float)$row['longitude'];}unset($row);
    return $rows;
}
