<?php
declare(strict_types=1);

function kareta_catalog_table_has_column(PDO $pdo, string $table, string $column): bool {
    try {
        $st = $pdo->prepare("SHOW COLUMNS FROM `{$table}` LIKE ?");
        $st->execute([$column]);
        return (bool)$st->fetch(PDO::FETCH_ASSOC);
    } catch (Throwable $_e) { return false; }
}

function kareta_masters_catalog_payload(?PDO $pdo): array {
    if (!$pdo) return ['masters'=>[], 'stos'=>[], 'totals'=>['masters'=>0,'stos'=>0,'offers'=>0]];

    $hasMasters = function_exists('kareta_table_exists') ? kareta_table_exists($pdo, 'masters') : true;
    $hasStos = function_exists('kareta_table_exists') ? kareta_table_exists($pdo, 'sto_profiles') : true;
    $hasOffers = function_exists('kareta_table_exists') ? kareta_table_exists($pdo, 'service_offers') : true;
    $hasStoLinks = function_exists('kareta_table_exists') ? kareta_table_exists($pdo, 'sto_master_links') : true;
    $hasGeo = function_exists('kareta_table_exists') && kareta_table_exists($pdo, 'geo_points');
    // Public catalog is never allowed to infer points from legacy private GPS.
    $masterPublicGeo = "g.owner_type='master' AND BINARY g.owner_id=BINARY m.id
        AND g.kind='service' AND g.visibility='exact' AND g.active=1
        AND g.latitude IS NOT NULL AND g.longitude IS NOT NULL
        AND COALESCE(m.work_mode,'shop')<>'mobile'";
    $stoPublicGeo = "g.owner_type='sto' AND BINARY g.owner_id=BINARY s.id
        AND g.kind IN ('service','branch') AND g.visibility='exact' AND g.active=1
        AND g.latitude IS NOT NULL AND g.longitude IS NOT NULL";

    $offerHasActive = $hasOffers && kareta_catalog_table_has_column($pdo, 'service_offers', 'active');
    $offerHasAvailability = $hasOffers && kareta_catalog_table_has_column($pdo, 'service_offers', 'availability_status');
    $offerHasPrice = $hasOffers && kareta_catalog_table_has_column($pdo, 'service_offers', 'price');
    $offerMasterCountExpr = $hasOffers
        ? "(SELECT COUNT(*) FROM service_offers so WHERE so.owner_type='master' AND so.owner_entity_id=m.id)"
        : '0';
    $offerMasterMinExpr = ($hasOffers && $offerHasPrice)
        ? "(SELECT MIN(NULLIF(so.price,0)) FROM service_offers so WHERE so.owner_type='master' AND so.owner_entity_id=m.id"
            . ($offerHasActive ? " AND so.active=1" : '')
            . ($offerHasAvailability ? " AND so.availability_status='available'" : '') . ')'
        : 'NULL';
    $offerStoCountExpr = $hasOffers
        ? "(SELECT COUNT(*) FROM service_offers so WHERE so.owner_type='sto' AND so.owner_entity_id=s.id)"
        : '0';
    $offerStoMinExpr = ($hasOffers && $offerHasPrice)
        ? "(SELECT MIN(NULLIF(so.price,0)) FROM service_offers so WHERE so.owner_type='sto' AND so.owner_entity_id=s.id"
            . ($offerHasActive ? " AND so.active=1" : '')
            . ($offerHasAvailability ? " AND so.availability_status='available'" : '') . ')'
        : 'NULL';

    $masterRating = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'rating') ? 'm.rating' : '4.8';
    $masterOrders = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'orders_count') ? 'm.orders_count' : '0';
    $masterExperience = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'experience_label') ? 'm.experience_label' : "''";
    $masterDescription = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'description') ? 'm.description' : "''";
    $masterUserId = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'user_id') ? 'm.user_id' : 'NULL';
    $masterCity = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'city') ? 'm.city' : "''";
    $masterResume = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'resume') ? 'm.resume' : 'NULL';
    $masterOfferText = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'offer_text') ? 'm.offer_text' : "''";
    $masterWorkMode = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'work_mode') ? 'm.work_mode' : "''";
    $masterDistrict = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'district') ? 'm.district' : "''";
    $masterPrimaryServices = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'primary_services') ? 'm.primary_services' : 'NULL';
    $masterAvailability = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'availability') ? 'm.availability' : "'online'";
    $masterProfileVisible = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'profile_visible') ? 'm.profile_visible' : '1';
    $masterServiceAddress = $hasGeo
        ? "(SELECT g.address FROM geo_points g WHERE {$masterPublicGeo} LIMIT 1)" : "''";
    $masterServiceRadius = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'service_radius_km') ? 'm.service_radius_km' : '0';
    $masterServiceLat = $hasGeo
        ? "(SELECT g.latitude FROM geo_points g WHERE {$masterPublicGeo} LIMIT 1)" : 'NULL';
    $masterServiceLng = $hasGeo
        ? "(SELECT g.longitude FROM geo_points g WHERE {$masterPublicGeo} LIMIT 1)" : 'NULL';
    $masterLocationVisibility = $hasGeo
        ? "(CASE WHEN EXISTS(SELECT 1 FROM geo_points g WHERE {$masterPublicGeo}) THEN 'exact' ELSE 'city' END)" : "'city'";
    $masterAddress = $masterServiceAddress;
    $masterOrgName = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'org_name') ? 'm.org_name' : "''";
    $masterBusinessType = $hasMasters && kareta_catalog_table_has_column($pdo, 'masters', 'business_type') ? 'm.business_type' : "''";
    $masterAvatar = $hasMasters && kareta_catalog_table_has_column($pdo, 'users', 'avatar_url') ? "(SELECT u.avatar_url FROM users u WHERE (u.id=m.user_id OR u.phone=m.user_phone OR u.phone=m.phone) AND u.active=1 ORDER BY (u.id=m.user_id) DESC LIMIT 1)" : "''";

    $mastersSql = "SELECT m.id,{$masterUserId} AS user_id,m.name,m.phone,m.initials,m.color,m.spec,m.sto_id,m.sto_name,
        {$masterCity} AS city,{$masterRating} AS rating,{$masterOrders} AS orders_count,{$masterExperience} AS experience_label,
        {$masterDescription} AS description,{$masterResume} AS resume,{$masterOfferText} AS offer_text,
        {$masterWorkMode} AS work_mode,{$masterDistrict} AS district,{$masterPrimaryServices} AS primary_services,
        {$masterAvailability} AS availability,{$masterProfileVisible} AS profile_visible,
        {$masterServiceAddress} AS service_address,{$masterServiceRadius} AS service_radius_km,{$masterServiceLat} AS service_lat,{$masterServiceLng} AS service_lng,
        {$masterLocationVisibility} AS location_visibility,{$masterAddress} AS address,
        {$masterOrgName} AS org_name,{$masterBusinessType} AS business_type,{$masterAvatar} AS avatar_url,
        {$offerMasterCountExpr} AS offers_count,
        {$offerMasterMinExpr} AS min_price
      FROM masters m
      WHERE m.active=1
      ORDER BY rating DESC,offers_count DESC,m.name";
    $masters = [];
    if ($hasMasters) {
        try {
            $masters = $pdo->query($mastersSql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Throwable $e) {
            if (function_exists('kareta_log_error')) kareta_log_error('MASTERS_CATALOG_MASTER_FAILSOFT', $e->getMessage());
            $masters = [];
        }
    }

    $stoDescription = $hasStos && kareta_catalog_table_has_column($pdo, 'sto_profiles', 'description') ? 's.description' : "''";
    $stoRating = $hasStos && kareta_catalog_table_has_column($pdo, 'sto_profiles', 'rating') ? 's.rating' : '4.7';
    $stoOrders = $hasStos && kareta_catalog_table_has_column($pdo, 'sto_profiles', 'orders_count') ? 's.orders_count' : '0';
    $stoSpec = $hasStos && kareta_catalog_table_has_column($pdo, 'sto_profiles', 'primary_specialization') ? 's.primary_specialization' : "''";
    $stoLogo = $hasStos && kareta_catalog_table_has_column($pdo, 'sto_profiles', 'logo_url') ? 's.logo_url' : "''";
    $stoReceptionStatus = $hasStos && kareta_catalog_table_has_column($pdo, 'sto_profiles', 'reception_status') ? 's.reception_status' : "'open'";
    // Averaging private employee locations does not produce a verified STO address.
    $stoLatExpr = $hasGeo
        ? "(SELECT g.latitude FROM geo_points g WHERE {$stoPublicGeo} ORDER BY FIELD(g.kind,'service','branch'),g.id LIMIT 1)" : 'NULL';
    $stoLngExpr = $hasGeo
        ? "(SELECT g.longitude FROM geo_points g WHERE {$stoPublicGeo} ORDER BY FIELD(g.kind,'service','branch'),g.id LIMIT 1)" : 'NULL';

    $stoMastersCountExpr = $hasStoLinks
        ? "(SELECT COUNT(DISTINCT l.master_id) FROM sto_master_links l WHERE l.sto_id=s.id AND l.status='active')"
        : '0';

    $stosSql = "SELECT s.id,s.name,s.contact_phone AS phone,s.city,s.address,s.work_hours,
        {$stoDescription} AS description,{$stoRating} AS rating,{$stoOrders} AS orders_count,
        {$stoSpec} AS primary_specialization,{$stoLogo} AS logo_url,{$stoReceptionStatus} AS reception_status,{$stoLatExpr} AS service_lat,{$stoLngExpr} AS service_lng,
        {$stoMastersCountExpr} AS masters_count,
        {$offerStoCountExpr} AS offers_count,
        {$offerStoMinExpr} AS min_price
      FROM sto_profiles s
      WHERE s.active=1
      ORDER BY rating DESC,offers_count DESC,s.name";
    $stos = [];
    if ($hasStos) {
        try {
            $stos = $pdo->query($stosSql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Throwable $e) {
            if (function_exists('kareta_log_error')) kareta_log_error('MASTERS_CATALOG_STO_FAILSOFT', $e->getMessage());
            $stos = [];
        }
    }

    foreach ($masters as &$row) {
        $row['rating'] = max(0, min(5, (float)($row['rating'] ?: 4.8)));
        $row['orders_count'] = (int)$row['orders_count'];
        $row['offers_count'] = (int)$row['offers_count'];
        $row['service_radius_km'] = (int)($row['service_radius_km'] ?? 0);
        $row['profile_visible'] = !isset($row['profile_visible']) || (bool)$row['profile_visible'];
        $row['min_price'] = $row['min_price'] !== null ? (float)$row['min_price'] : null;
        foreach (['resume','primary_services'] as $jsonField) {
            if (is_string($row[$jsonField] ?? null) && trim((string)$row[$jsonField]) !== '') {
                $decoded = json_decode((string)$row[$jsonField], true);
                if (json_last_error() === JSON_ERROR_NONE) $row[$jsonField] = $decoded;
            }
        }
        if (!is_array($row['resume'] ?? null)) $row['resume'] = [];
        if (!is_array($row['primary_services'] ?? null)) $row['primary_services'] = [];
        $row['type'] = 'master';
    }
    unset($row);
    foreach ($stos as &$row) {
        $row['rating'] = max(0, min(5, (float)($row['rating'] ?: 4.7)));
        $row['orders_count'] = (int)$row['orders_count'];
        $row['masters_count'] = (int)$row['masters_count'];
        $row['offers_count'] = (int)$row['offers_count'];
        $row['min_price'] = $row['min_price'] !== null ? (float)$row['min_price'] : null;
        $status = strtolower(trim((string)($row['reception_status'] ?? 'open')));
        if (!in_array($status,['open','busy','day_off'],true)) $status='open';
        $row['receptionStatus'] = $status;
        $row['type'] = 'sto';
    }
    unset($row);

    $offersTotal = 0;
    if ($hasOffers) {
        try { $offersTotal = (int)$pdo->query("SELECT COUNT(*) FROM service_offers" . ($offerHasActive ? " WHERE active=1" : ''))->fetchColumn(); }
        catch (Throwable $e) { if (function_exists('kareta_log_error')) kareta_log_error('MASTERS_CATALOG_OFFERS_TOTAL_FAILSOFT', $e->getMessage()); }
    }

    return [
        'masters'=>$masters,
        'stos'=>$stos,
        'totals'=>[
            'masters'=>count($masters),
            'stos'=>count($stos),
            'offers'=>$offersTotal,
        ],
    ];
}
