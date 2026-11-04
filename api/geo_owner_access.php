<?php
declare(strict_types=1);

/** Context and capability authorization for Geo writes. Read-only members cannot edit points. */
function geo_owner_types(): array { return ['master','sto','organization','organization_unit','shop']; }

function geo_context_allows_owner(PDO $pdo,KaretaAuthResolution $auth,string $ownerType,string $ownerId): bool {
    if (!in_array($ownerType,geo_owner_types(),true) || $ownerId==='') return false;
    $context=$auth->context;
    $type=strtolower((string)($context['type']??''));
    // Context membership alone is not edit permission. In particular,
    // organization.member and organization.master must not edit an STO.
    $allowed=$auth->capabilities;
    $denied=$auth->deniedCapabilities;
    if(in_array('*',$denied,true)||in_array('geo.upsert',$denied,true))return false;
    if($type==='profile'&&!in_array('*',$allowed,true)
        &&!in_array('profile.edit_own',$allowed,true)
        &&!in_array('profile.manage',$allowed,true))return false;
    if($type==='organization'){
        $orgOwner=in_array('*',$allowed,true);
        $storeManager=($ownerType==='shop' ||
            ($ownerType==='organization'&&($context['organizationType']??'')==='parts_store'))
            &&in_array('profile.manage',$allowed,true);
        if(!$orgOwner&&!$storeManager)return false;
    }

    if ($type==='profile') {
        $profileId=(int)($context['profileId']??0);
        $profileType=strtolower((string)($context['profileType']??''));
        if ($profileId<=0) return false;
        $q=$pdo->prepare("SELECT legacy_entity_type,legacy_entity_id FROM person_profiles WHERE id=? AND status='active' LIMIT 1");
        $q->execute([$profileId]);
        $profile=$q->fetch(PDO::FETCH_ASSOC)?:[];
        $legacyType=strtolower((string)($profile['legacy_entity_type']??''));
        $legacyId=(string)($profile['legacy_entity_id']??'');
        if ($profileType==='master' && $legacyType==='master') return $ownerType==='master' && hash_equals($legacyId,$ownerId);
        if ($profileType==='seller' && $legacyType==='seller_profile') return $ownerType==='shop' && hash_equals($legacyId,$ownerId);
        return false;
    }

    if ($type!=='organization') return false;
    $organizationId=trim((string)($context['organizationKey']??$context['organizationId']??''));
    if ($organizationId==='') return false;
    if ($ownerType==='organization' && hash_equals($organizationId,$ownerId)) return true;

    if ($ownerType==='organization_unit') {
        $q=$pdo->prepare("SELECT 1 FROM organization_units WHERE id=? AND organization_id=? AND status='active' LIMIT 1");
        $q->execute([$ownerId,$organizationId]);
        return (bool)$q->fetchColumn();
    }

    $q=$pdo->prepare("SELECT legacy_entity_type,legacy_entity_id FROM organizations WHERE id=? AND status='active' LIMIT 1");
    $q->execute([$organizationId]);
    $organization=$q->fetch(PDO::FETCH_ASSOC)?:[];
    $legacyType=strtolower((string)($organization['legacy_entity_type']??''));
    $legacyId=(string)($organization['legacy_entity_id']??'');
    if ($ownerType==='sto' && $legacyType==='sto_profile') return $legacyId!=='' && hash_equals($legacyId,$ownerId);
    if ($ownerType==='shop' && $legacyType==='seller_profile') return $legacyId!=='' && hash_equals($legacyId,$ownerId);
    return false;
}
