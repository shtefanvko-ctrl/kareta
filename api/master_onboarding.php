<?php
declare(strict_types=1);
ini_set('display_errors','0');
ini_set('html_errors','0');
header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__).'/inc/request_logger.php';
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/identity/context_service.php';
require_once __DIR__.'/identity/capability_service.php';
require_once __DIR__.'/identity/auth_resolver.php';
require_once __DIR__.'/catalog/service_catalog.php';
require_once __DIR__.'/geo_core.php';

const KMOB_TERMS_VERSION = 'master-terms-2026-08';

$pdo=kareta_pdo();
if(!$pdo instanceof PDO)kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);
if(kareta_table_exists($pdo,'users')){
    kareta_ensure_column($pdo,'users','avatar_url',"ALTER TABLE `users` ADD COLUMN `avatar_url` MEDIUMTEXT NULL AFTER `initials`");
    kareta_ensure_column($pdo,'users','bio',"ALTER TABLE `users` ADD COLUMN `bio` TEXT NULL AFTER `avatar_url`");
}
if(!kareta_table_exists($pdo,'master_onboarding_state'))kareta_json(['ok'=>false,'error'=>'master_onboarding_schema_missing','message'=>'Требуется миграция базы данных 128'],503);

try{$auth=(new KaretaAuthResolver($pdo))->resolve(true);}catch(DomainException $e){kareta_json(['ok'=>false,'error'=>$e->getMessage()],$e->getMessage()==='session_identity_conflict'?409:401);}
$contexts=new KaretaIdentityContextService($pdo);
$contexts->resolveAccount($auth->legacyUser??[]);
$accountId=(int)$auth->accountId;
$current=$contexts->currentContext($accountId);
if(strtolower((string)($current['type']??''))!=='profile'||strtolower((string)($current['profileType']??''))!=='master'){
    kareta_json(['ok'=>false,'error'=>'master_context_required','message'=>'Выберите контекст Мастера'],409);
}
$profileId=(int)($current['profileId']??0);
$personId=(int)($current['personId']??0);
if($profileId<=0||$personId<=0)kareta_json(['ok'=>false,'error'=>'master_profile_context_invalid'],409);

function kmob_text($value,int $max=255): string{
    $value=trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u','',(string)$value)??'');
    return mb_substr($value,0,$max,'UTF-8');
}
function kmob_contact_like(string $value): bool{
    if($value==='')return false;
    return (bool)(preg_match('~(?:https?://|www\.|t\.me/|wa\.me/|whatsapp|telegram|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})~iu',$value)
      ||preg_match('~\+?\d(?:[\s().-]*\d){7,14}~u',$value));
}
function kmob_decode($value,$fallback=[]){if(is_array($value))return $value;if(!is_string($value)||trim($value)==='')return $fallback;$d=json_decode($value,true);return is_array($d)?$d:$fallback;}
function kmob_experience_label(string $range): string{
    return [
      'none'=>'Без опыта','lt1'=>'Менее 1 года','1'=>'1 год','2_4'=>'2–4 года','5_9'=>'5–9 лет','10_14'=>'10–14 лет','15_plus'=>'15 лет и более'
    ][$range]??'';
}
function kmob_mode_to_storage(string $mode): string{return $mode==='fixed'?'shop':($mode==='mobile'?'mobile':($mode==='both'?'both':'shop'));}
function kmob_mode_from_storage(string $mode): string{return $mode==='shop'?'fixed':(in_array($mode,['mobile','both'],true)?$mode:'');}
function kmob_city_slug(string $city): string{
    $city=kmob_text($city,120);
    $slug=mb_strtolower($city,'UTF-8');
    $slug=preg_replace('/[^\p{L}\p{N}]+/u','_',$slug)??'';
    return trim($slug,'_');
}
function kmob_city_options(PDO $pdo,array $master,array $auth): array{
    $seed=[
      ['Алматы','Алматы',43.2389,76.8897],['Астана','Астана',51.1694,71.4491],['Шымкент','Шымкент',42.3417,69.5901],
      ['Караганда','Карагандинская область',49.8064,73.0855],['Усть-Каменогорск','Восточно-Казахстанская область',49.9483,82.6285],
      ['Семей','Абайская область',50.4111,80.2275],['Павлодар','Павлодарская область',52.2873,76.9674],['Риддер','Восточно-Казахстанская область',50.3441,83.5129],
      ['Костанай','Костанайская область',null,null],['Петропавловск','Северо-Казахстанская область',null,null],['Кокшетау','Акмолинская область',null,null],
      ['Актобе','Актюбинская область',null,null],['Атырау','Атырауская область',null,null],['Актау','Мангистауская область',null,null],['Уральск','Западно-Казахстанская область',null,null],
      ['Тараз','Жамбылская область',null,null],['Талдыкорган','Жетысуская область',null,null],['Кызылорда','Кызылординская область',null,null],['Туркестан','Туркестанская область',null,null]
    ];
    $rows=[];$push=static function(string $name,string $region='Казахстан',$lat=null,$lng=null)use(&$rows):void{
        $name=kmob_text($name,120);if($name==='')return;$key=mb_strtolower($name,'UTF-8');
        if(isset($rows[$key]))return;$rows[$key]=['id'=>kmob_city_slug($name),'name'=>$name,'region'=>$region!==''?$region:'Казахстан','latitude'=>is_numeric($lat)?(float)$lat:null,'longitude'=>is_numeric($lng)?(float)$lng:null];
    };
    foreach($seed as $row)$push((string)$row[0],(string)$row[1],$row[2],$row[3]);
    $push((string)($master['city']??''));
    $uid=(int)($master['user_id']??$auth['legacyUser']['id']??0);
    if($uid>0&&kareta_table_exists($pdo,'users')){try{$q=$pdo->prepare("SELECT city FROM users WHERE id=? LIMIT 1");$q->execute([$uid]);$push((string)($q->fetchColumn()?:''));}catch(Throwable $_){}}
    foreach([['masters','city'],['sto_profiles','city'],['organizations','city'],['organization_units','city']] as [$table,$column]){
      if(!kareta_table_exists($pdo,$table))continue;try{$q=$pdo->query("SELECT DISTINCT `$column` FROM `$table` WHERE `$column`<>'' ORDER BY `$column` LIMIT 250");foreach($q->fetchAll(PDO::FETCH_COLUMN)?:[] as $city)$push((string)$city);}catch(Throwable $_){}
    }
    $out=array_values($rows);usort($out,static fn(array $a,array $b):int=>strcoll((string)$a['name'],(string)$b['name']));return $out;
}
function kmob_organization_locations(PDO $pdo,array $master,array $auth): array{
    $masterId=(string)($master['id']??'');$uid=(int)($master['user_id']??$auth['legacyUser']['id']??0);$rows=[];
    $push=static function(string $id,string $name,string $city,string $address,$lat=null,$lng=null,string $source='organization')use(&$rows):void{
      $id=kmob_text($id,120);$name=kmob_text($name,191);$city=kmob_text($city,120);$address=kmob_text($address,255);if($id===''||$name==='')return;
      $rows[$id]=['id'=>$id,'name'=>$name,'city'=>$city,'cityId'=>kmob_city_slug($city),'address'=>$address,'latitude'=>is_numeric($lat)?(float)$lat:null,'longitude'=>is_numeric($lng)?(float)$lng:null,'source'=>$source];
    };
    if($masterId!==''&&kareta_table_exists($pdo,'sto_master_links')&&kareta_table_exists($pdo,'sto_profiles')){
      try{$q=$pdo->prepare("SELECT s.id,s.name,s.city,s.address FROM sto_master_links l JOIN sto_profiles s ON BINARY s.id=BINARY l.sto_id WHERE BINARY l.master_id=BINARY ? AND l.status='active' AND s.active=1 ORDER BY s.name");$q->execute([$masterId]);foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r)$push('sto:'.(string)$r['id'],(string)$r['name'],(string)$r['city'],(string)$r['address'],null,null,'sto');}catch(Throwable $_){}
    }
    if($uid>0&&kareta_table_exists($pdo,'organizations')&&kareta_table_exists($pdo,'organization_members')){
      try{$q=$pdo->prepare("SELECT o.id,o.name,o.city,o.address FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=? AND m.status='active' AND o.status='active' AND o.type='service_station' ORDER BY o.name");$q->execute([$uid]);foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r)$push('org:'.(string)$r['id'],(string)$r['name'],(string)$r['city'],(string)$r['address'],null,null,'organization');}catch(Throwable $_){}
      if(kareta_table_exists($pdo,'organization_units')){try{$q=$pdo->prepare("SELECT u.id,u.name,u.city,u.address,o.name organization_name FROM organization_members m JOIN organizations o ON o.id=m.organization_id JOIN organization_units u ON u.organization_id=o.id WHERE m.user_id=? AND m.status='active' AND o.status='active' AND o.type='service_station' AND u.status='active' ORDER BY o.name,u.name");$q->execute([$uid]);foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r)$push('unit:'.(string)$r['id'],(string)$r['organization_name'].' · '.(string)$r['name'],(string)$r['city'],(string)$r['address'],null,null,'organization_unit');}catch(Throwable $_){}}
    }
    return array_values($rows);
}
function kmob_master(PDO $pdo,int $profileId,array $auth): array{
    $q=$pdo->prepare("SELECT pp.legacy_entity_id,p.account_id FROM person_profiles pp JOIN persons p ON p.id=pp.person_id WHERE pp.id=? AND pp.profile_type='master' AND pp.status='active' LIMIT 1");
    $q->execute([$profileId]);$pp=$q->fetch(PDO::FETCH_ASSOC)?:[];$legacy=trim((string)($pp['legacy_entity_id']??''));
    if($legacy!==''){$q=$pdo->prepare("SELECT * FROM masters WHERE BINARY id=BINARY ? AND active=1 LIMIT 1");$q->execute([$legacy]);$m=$q->fetch(PDO::FETCH_ASSOC);if($m)return $m;}
    $uid=(int)($auth['legacyUser']['id']??0);$phone=kareta_normalize_phone((string)($auth['legacyUser']['phone']??''));
    $where=[];$args=[];$order='id';
    if($uid>0){$where[]='user_id=?';$args[]=$uid;$order='(user_id='.((int)$uid).') DESC,id';}
    if($phone!==''){$where[]='user_phone=?';$args[]=$phone;$where[]='phone=?';$args[]=$phone;}
    if(!$where)return [];
    $q=$pdo->prepare("SELECT * FROM masters WHERE active=1 AND (".implode(' OR ',$where).") ORDER BY {$order} LIMIT 1");$q->execute($args);$m=$q->fetch(PDO::FETCH_ASSOC)?:[];
    if($m&&$legacy===''&&kareta_table_exists($pdo,'person_profiles'))$pdo->prepare("UPDATE person_profiles SET legacy_entity_type='master',legacy_entity_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")->execute([(string)$m['id'],$profileId]);
    return $m;
}
function kmob_ensure_state(PDO $pdo,int $accountId,int $personId,int $profileId,array $current,array $master): array{
    $q=$pdo->prepare("SELECT * FROM master_onboarding_state WHERE profile_id=? LIMIT 1");$q->execute([$profileId]);$row=$q->fetch(PDO::FETCH_ASSOC)?:[];
    if($row)return $row;
    $masterId=(string)($master['id']??'');$contextId=(int)($current['id']??0)?:null;
    $pdo->prepare("INSERT INTO master_onboarding_state(profile_id,context_id,account_id,person_id,master_id,status,current_step,current_view,draft_json,revision) VALUES(?,?,?,?,?,'not_started',1,'master-profile',JSON_OBJECT(),0)")->execute([$profileId,$contextId,$accountId,$personId,$masterId]);
    $q=$pdo->prepare("SELECT * FROM master_onboarding_state WHERE profile_id=? LIMIT 1");$q->execute([$profileId]);return $q->fetch(PDO::FETCH_ASSOC)?:[];
}
function kmob_prefill(PDO $pdo,array $state,array $master,array $auth): array{
    $draft=kmob_decode($state['draft_json']??null,[]);
    $resume=kmob_decode($master['resume']??null,[]);
    $uid=(int)($master['user_id']??$auth['legacyUser']['id']??0);$user=[];
    if($uid>0){$q=$pdo->prepare("SELECT name,city,avatar_url FROM users WHERE id=? LIMIT 1");$q->execute([$uid]);$user=$q->fetch(PDO::FETCH_ASSOC)?:[];}
    $offers=[];
    if(($master['id']??'')!==''&&kareta_table_exists($pdo,'service_offers')){
      $q=$pdo->prepare("SELECT so.service_id,so.price,so.price_type,sc.name,sc.category_key FROM service_offers so LEFT JOIN service_catalog sc ON sc.id=so.service_id WHERE so.owner_type='master' AND BINARY so.owner_entity_id=BINARY ? AND so.active=1 ORDER BY so.updated_at DESC");$q->execute([(string)$master['id']]);
      foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $r)$offers[]=['serviceId'=>(string)$r['service_id'],'customServiceId'=>null,'source'=>'catalog','categoryId'=>(string)($r['category_key']??''),'name'=>(string)($r['name']??$r['service_id']),'priceFrom'=>(int)round((float)$r['price']),'priceMode'=>(string)$r['price_type']==='agreement'?'negotiable':'from','description'=>'','isActive'=>true];
    }
    $custom=is_array($resume['customServices']??null)?$resume['customServices']:[];foreach($custom as $c)if(is_array($c))$offers[]=$c+['source'=>'custom','isActive'=>true];
    $city=kmob_text($master['city']??$user['city']??'',120);$mode=kmob_mode_from_storage(strtolower((string)($master['work_mode']??'')));
    $baseline=[
      'schemaVersion'=>1,'accountId'=>(int)($state['account_id']??0),'personId'=>(int)($state['person_id']??0),'contextId'=>isset($state['context_id'])?(int)$state['context_id']:null,'currentStep'=>(int)($state['current_step']??1)?:1,'currentView'=>(string)($state['current_view']??'master-profile'),'returnTarget'=>null,
      'profile'=>[
        'avatarUploadToken'=>null,'avatarUrl'=>(str_starts_with((string)($user['avatar_url']??''),'data:image/')?'/api/master_onboarding.php?action=avatar':(string)($user['avatar_url']??'')),'displayName'=>kmob_text($master['name']??$user['name']??'',100),
        'experienceYears'=>null,'experienceRange'=>'','primarySpecializationId'=>kmob_text($master['spec']??'',64),'bio'=>kmob_text($master['description']??$resume['bio']??'',500)
      ],
      'services'=>$offers,
      'workLocation'=>[
        'cityId'=>$city!==''?mb_strtolower(str_replace(' ','_',$city),'UTF-8'):null,'cityName'=>$city,'cityConfirmed'=>false,'mode'=>$mode?:null,'locationSource'=>'personal','organizationLocationId'=>null,
        'address'=>['text'=>kmob_text($master['service_address']??'',200),'latitude'=>isset($master['service_lat'])?(float)$master['service_lat']:null,'longitude'=>isset($master['service_lng'])?(float)$master['service_lng']:null,'placeId'=>null,'isPublic'=>true],
        'mobileOrigin'=>['text'=>'','latitude'=>isset($master['service_lat'])?(float)$master['service_lat']:null,'longitude'=>isset($master['service_lng'])?(float)$master['service_lng']:null,'isPublic'=>false],
        'serviceArea'=>['type'=>(int)($master['service_radius_km']??0)>0?'radius':null,'radiusKm'=>(int)($master['service_radius_km']??0)?:null,'districtIds'=>[]]
      ],
      'agreement'=>['accepted'=>false,'termsVersion'=>null,'acceptedAt'=>null],
      'onboardingStatus'=>(string)($state['status']??'not_started'),'revision'=>(int)($state['revision']??0),'idempotencyKey'=>(string)($state['idempotency_key']??''),'updatedAt'=>(string)($state['updated_at']??'')
    ];
    if(!$draft)return $baseline;
    $merged=array_replace_recursive($baseline,$draft);
    // List-like draft fields must replace the baseline exactly. Recursive array merge would resurrect removed services/districts by numeric index.
    if(array_key_exists('services',$draft)&&is_array($draft['services']))$merged['services']=array_values($draft['services']);
    if(isset($draft['workLocation']['serviceArea'])&&is_array($draft['workLocation']['serviceArea'])&&array_key_exists('districtIds',$draft['workLocation']['serviceArea'])&&is_array($draft['workLocation']['serviceArea']['districtIds']))$merged['workLocation']['serviceArea']['districtIds']=array_values($draft['workLocation']['serviceArea']['districtIds']);
    return $merged;
}
function kmob_catalog_snapshot(PDO $pdo): array{
    $payload=kareta_service_catalog_public_payload($pdo);
    $services=[];$categories=[];
    foreach(is_array($payload['services']??null)?$payload['services']:[] as $service){if(!is_array($service))continue;$id=kmob_text($service['id']??'',120);if($id!=='')$services[$id]=$service;}
    foreach(is_array($payload['serviceCategories']??null)?$payload['serviceCategories']:[] as $category){if(!is_array($category))continue;$key=kmob_text($category['key']??'',64);if($key!=='')$categories[$key]=$category;}
    return ['services'=>$services,'categories'=>$categories];
}
function kmob_resolve_city(PDO $pdo,array $master,array $auth,array $location): ?array{
    $id=kmob_text($location['cityId']??'',120);$name=kmob_text($location['cityName']??'',120);
    foreach(kmob_city_options($pdo,$master,$auth) as $city){
      if(($id!==''&&(string)($city['id']??'')===$id)||($name!==''&&mb_strtolower((string)($city['name']??''),'UTF-8')===mb_strtolower($name,'UTF-8')))return $city;
    }
    return null;
}
function kmob_resolve_organization_location(PDO $pdo,array $master,array $auth,array $location): ?array{
    if(($location['locationSource']??'personal')!=='organization')return null;
    $wanted=kmob_text($location['organizationLocationId']??'',120);if($wanted==='')return null;
    foreach(kmob_organization_locations($pdo,$master,$auth) as $row)if((string)($row['id']??'')===$wanted)return $row;
    return null;
}
function kmob_effective_capabilities_safe(PDO $pdo,KaretaIdentityContextService $contexts,int $accountId,int $contextId): array{
    try{
        $caps=(new KaretaCapabilityService($pdo,$contexts))->effective($accountId,$contextId);
        return array_values(is_array($caps['allowed']??null)?$caps['allowed']:[]);
    }catch(Throwable $e){
        if(function_exists('kareta_log_error'))kareta_log_error('MASTER_ONBOARDING_CAPABILITIES',$e->getMessage());
        return [];
    }
}
function kmob_completed_payload(PDO $pdo,KaretaIdentityContextService $contexts,int $accountId,array $current,array $state,array $master,bool $idempotent=true): array{
    $allowed=kmob_effective_capabilities_safe($pdo,$contexts,$accountId,(int)$current['id']);
    return ['ok'=>true,'status'=>'completed','masterProfileId'=>(string)($state['master_id']??$master['id']??''),'contextId'=>(int)$current['id'],'capabilities'=>$allowed,'redirectRoute'=>'#/master','idempotent'=>$idempotent,'idempotencyKey'=>(string)($state['idempotency_key']??'')];
}
function kmob_coord_valid($value,float $min,float $max): bool{
    if($value===null||$value==='')return true;
    if(!is_numeric($value))return false;$n=(float)$value;return is_finite($n)&&$n>=$min&&$n<=$max;
}
function kmob_validate(array $draft): array{
    $errors=[];$profile=is_array($draft['profile']??null)?$draft['profile']:[];$allServices=is_array($draft['services']??null)?$draft['services']:[];$loc=is_array($draft['workLocation']??null)?$draft['workLocation']:[];$agreement=is_array($draft['agreement']??null)?$draft['agreement']:[];
    $rawName=trim((string)($profile['displayName']??''));$name=kmob_text($rawName,100);$nameLen=mb_strlen($rawName,'UTF-8');
    if($nameLen<2)$errors['profile.displayName']='name_required';elseif($nameLen>100)$errors['profile.displayName']='name_too_long';elseif(preg_match('/[0-9]/u',$name))$errors['profile.displayName']='name_invalid';
    $range=kmob_text($profile['experienceRange']??'',32);$experienceRanges=['none','lt1','1','2_4','5_9','10_14','15_plus'];if($range==='')$errors['profile.experienceRange']='experience_required';elseif(!in_array($range,$experienceRanges,true))$errors['profile.experienceRange']='experience_invalid';
    if(kmob_text($profile['primarySpecializationId']??'',64)==='')$errors['profile.primarySpecializationId']='specialization_required';
    $rawBio=(string)($profile['bio']??'');if(mb_strlen($rawBio,'UTF-8')>500)$errors['profile.bio']='bio_too_long';$bio=kmob_text($rawBio,500);if(kmob_contact_like($bio))$errors['profile.bio']='contacts_not_allowed';
    $services=[];foreach($allServices as $service)if(is_array($service)&&(!array_key_exists('isActive',$service)||!empty($service['isActive'])))$services[]=$service;
    if(!$services)$errors['services']='service_required';$seen=[];
    foreach($services as $i=>$service){
      $source=kmob_text($service['source']??'catalog',16);if(!in_array($source,['catalog','custom'],true))$errors["services.$i.source"]='service_source_invalid';
      $id=kmob_text($source==='custom'?($service['customServiceId']??''):($service['serviceId']??''),120);if($id==='')$errors["services.$i.id"]='service_id_required';elseif(isset($seen[$source.':'.$id]))$errors["services.$i.id"]='service_duplicate';else$seen[$source.':'.$id]=true;
      $priceMode=kmob_text($service['priceMode']??'from',24);if(!in_array($priceMode,['from','negotiable'],true))$errors["services.$i.priceMode"]='price_mode_invalid';if($priceMode!=='negotiable'){$rawPrice=$service['priceFrom']??null;if(!is_numeric($rawPrice)||(float)$rawPrice<=0||floor((float)$rawPrice)!==(float)$rawPrice)$errors["services.$i.priceFrom"]='invalid_price';}
      if($source==='custom'){$rawCustomName=trim((string)($service['name']??''));$customName=kmob_text($rawCustomName,120);$customLen=mb_strlen($rawCustomName,'UTF-8');if($customLen<3)$errors["services.$i.name"]='custom_service_name_required';elseif($customLen>120)$errors["services.$i.name"]='custom_service_name_too_long';elseif(kmob_contact_like($customName))$errors["services.$i.name"]='contacts_not_allowed';if(kmob_text($service['categoryId']??'',64)==='')$errors["services.$i.categoryId"]='custom_service_category_required';$rawDescription=(string)($service['description']??'');if(mb_strlen($rawDescription,'UTF-8')>500)$errors["services.$i.description"]='custom_service_description_too_long';elseif(kmob_contact_like(kmob_text($rawDescription,500)))$errors["services.$i.description"]='contacts_not_allowed';}
    }
    $source=kmob_text($loc['locationSource']??'personal',32);if(!in_array($source,['personal','organization'],true))$errors['workLocation.locationSource']='location_source_invalid';
    $city=kmob_text($loc['cityName']??$loc['cityId']??'',120);if($city==='')$errors['workLocation.cityId']='city_required';elseif(empty($loc['cityConfirmed'])&&$source!=='organization')$errors['workLocation.cityConfirmed']='city_confirmation_required';$mode=kmob_text($loc['mode']??'',16);if(!in_array($mode,['mobile','fixed','both'],true))$errors['workLocation.mode']='work_mode_required';
    $address=is_array($loc['address']??null)?$loc['address']:[];$origin=is_array($loc['mobileOrigin']??null)?$loc['mobileOrigin']:[];$area=is_array($loc['serviceArea']??null)?$loc['serviceArea']:[];
    $addressText=trim((string)($address['text']??''));$originText=trim((string)($origin['text']??''));if(mb_strlen($addressText,'UTF-8')>200)$errors['workLocation.address']='address_too_long';if(mb_strlen($originText,'UTF-8')>200)$errors['workLocation.mobileOrigin']='address_too_long';
    if(!kmob_coord_valid($address['latitude']??null,-90,90)||!kmob_coord_valid($address['longitude']??null,-180,180))$errors['workLocation.address']='coordinate_invalid';if(!kmob_coord_valid($origin['latitude']??null,-90,90)||!kmob_coord_valid($origin['longitude']??null,-180,180))$errors['workLocation.mobileOrigin']='coordinate_invalid';
    $fixedReady=kmob_text($addressText,200)!=='';$originReady=kmob_text($originText,200)!==''||((isset($origin['latitude'],$origin['longitude']))&&kmob_coord_valid($origin['latitude'],-90,90)&&kmob_coord_valid($origin['longitude'],-180,180))||($mode==='both'&&$fixedReady);
    $areaType=kmob_text($area['type']??'',16);$areaReady=false;if($areaType==='city')$areaReady=true;elseif($areaType==='radius'){$radius=(int)($area['radiusKm']??0);if(!in_array($radius,[5,10,15,25],true))$errors['workLocation.serviceArea']='radius_invalid';else$areaReady=true;}elseif($areaType==='districts'){$districts=is_array($area['districtIds']??null)?array_values(array_filter($area['districtIds'],static fn($v)=>trim((string)$v)!=='')):[];if(!$districts)$errors['workLocation.serviceArea']='service_area_required';else$areaReady=true;}elseif($areaType!=='')$errors['workLocation.serviceArea']='service_area_invalid';
    if($source==='organization'&&kmob_text($loc['organizationLocationId']??'',120)==='')$errors['workLocation.organizationLocationId']='organization_location_required';if(in_array($mode,['fixed','both'],true)&&!$fixedReady&&$source!=='organization')$errors['workLocation.address']='address_required';if(in_array($mode,['mobile','both'],true)&&!$originReady)$errors['workLocation.mobileOrigin']='mobile_origin_required';if(in_array($mode,['mobile','both'],true)&&!$areaReady&&!isset($errors['workLocation.serviceArea']))$errors['workLocation.serviceArea']='service_area_required';
    if(empty($agreement['accepted']))$errors['agreement.accepted']='agreement_required';elseif(kmob_text($agreement['termsVersion']??'',64)!==KMOB_TERMS_VERSION)$errors['agreement.termsVersion']='terms_version_invalid';
    return $errors;
}

$master=kmob_master($pdo,$profileId,['legacyUser'=>$auth->legacyUser??[]]);
if(!$master)kareta_json(['ok'=>false,'error'=>'master_profile_not_materialized','message'=>'Профиль Мастера ещё не создан'],409);
$state=kmob_ensure_state($pdo,$accountId,$personId,$profileId,$current,$master);
$method=strtoupper((string)($_SERVER['REQUEST_METHOD']??'GET'));$body=$method==='POST'?kareta_read_json():[];$action=trim((string)($_GET['action']??($body['action']??'current')));

if($method==='GET'&&$action==='avatar'){
    $uid=(int)($master['user_id']??0);if($uid<=0){http_response_code(404);exit;}
    $q=$pdo->prepare("SELECT avatar_url FROM users WHERE id=? LIMIT 1");$q->execute([$uid]);$value=(string)($q->fetchColumn()?:'');
    if(!preg_match('~^data:image/(jpeg|png|webp);base64,(.+)$~s',$value,$m)){http_response_code(404);exit;}
    $bytes=base64_decode(preg_replace('/\s+/','',$m[2]),true);if($bytes===false){http_response_code(404);exit;}
    header_remove('Content-Type');header('Content-Type: image/'.($m[1]==='jpeg'?'jpeg':$m[1]));header('Cache-Control: private, max-age=300');header('X-Content-Type-Options: nosniff');echo $bytes;exit;
}

if($method==='GET'&&$action==='servicesCatalog'){
    $snapshot=kmob_catalog_snapshot($pdo);$q=mb_strtolower(kmob_text($_GET['q']??'',120),'UTF-8');$category=kmob_text($_GET['category']??'',64);$limit=max(1,min(50,(int)($_GET['limit']??40)));$offset=max(0,(int)($_GET['offset']??0));
    $rows=[];foreach($snapshot['services'] as $service){$cat=kmob_text($service['cat']??'',64);if($category!==''&&$cat!==$category)continue;$categoryName=(string)($snapshot['categories'][$cat]['name']??'');$synonyms='';if(is_array($service['list']??null))$synonyms=implode(' ',array_map(static fn($v):string=>is_scalar($v)?(string)$v:'',$service['list']));$hay=mb_strtolower(kmob_text(($service['name']??'').' '.($service['shortDesc']??'').' '.$categoryName.' '.$cat.' '.$synonyms,1600),'UTF-8');if($q!==''&&!str_contains($hay,$q))continue;$rows[]=$service;}
    $total=count($rows);$rows=array_slice($rows,$offset,$limit);kareta_json(['ok'=>true,'data'=>['services'=>array_values($rows),'serviceCategories'=>array_values($snapshot['categories']),'meta'=>['total'=>$total,'offset'=>$offset,'limit'=>$limit]]]);
}

if($method==='GET'&&$action==='status'){
    $idem=kmob_text($_GET['idempotencyKey']??$_SERVER['HTTP_IDEMPOTENCY_KEY']??'',96);$status=(string)($state['status']??'not_started');
    if($status==='completed')kareta_json(kmob_completed_payload($pdo,$contexts,$accountId,$current,$state,$master,true)+['idempotencyMatch'=>$idem!==''&&hash_equals((string)($state['idempotency_key']??''),$idem)]);
    kareta_json(['ok'=>true,'status'=>$status,'revision'=>(int)($state['revision']??0),'currentStep'=>(int)($state['current_step']??1),'currentView'=>(string)($state['current_view']??'master-profile'),'idempotencyMatch'=>false]);
}

if($method==='GET'&&$action==='current'){
    $draft=kmob_prefill($pdo,$state,$master,['legacyUser'=>$auth->legacyUser??[]]);
    $caps=(new KaretaCapabilityService($pdo,$contexts))->effective($accountId,(int)$current['id']);
    kareta_json(['ok'=>true,'contextId'=>(int)$current['id'],'status'=>(string)$state['status'],'revision'=>(int)$state['revision'],'currentStep'=>(int)$state['current_step'],'currentView'=>(string)$state['current_view'],'draft'=>$draft,'options'=>['cities'=>kmob_city_options($pdo,$master,['legacyUser'=>$auth->legacyUser??[]]),'organizationLocations'=>kmob_organization_locations($pdo,$master,['legacyUser'=>$auth->legacyUser??[]]),'avatar'=>['maxBytes'=>1500000,'mimeTypes'=>['image/jpeg','image/png','image/webp']],'termsVersion'=>KMOB_TERMS_VERSION],'currentContext'=>$current,'capabilities'=>$caps['allowed'],'redirectRoute'=>'#/master']);
}

if($method==='POST'&&$action==='defer'){
    if((string)$state['status']==='completed')kareta_json(['ok'=>true,'status'=>'completed','revision'=>(int)$state['revision'],'redirectRoute'=>'#/master','idempotent'=>true]);
    $hours=max(24,min(48,(int)($body['hours']??48)));
    $until=(new DateTimeImmutable('now',new DateTimeZone('UTC')))->modify('+'.$hours.' hours')->format(DATE_ATOM);
    try{
      $pdo->beginTransaction();
      $q=$pdo->prepare("SELECT status,draft_json,revision,current_step,current_view FROM master_onboarding_state WHERE profile_id=? FOR UPDATE");
      $q->execute([$profileId]);$locked=$q->fetch(PDO::FETCH_ASSOC)?:[];
      if(!$locked){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'onboarding_state_missing'],409);}
      if((string)($locked['status']??'')==='completed'){
        $pdo->commit();
        kareta_json(['ok'=>true,'status'=>'completed','revision'=>(int)($locked['revision']??0),'redirectRoute'=>'#/master','idempotent'=>true]);
      }
      $draft=is_array($body['draft']??null)?$body['draft']:kmob_decode($locked['draft_json']??null,[]);
      $draft['deferredUntil']=$until;
      $draft['deferredHours']=$hours;
      $draft['deferredAt']=(new DateTimeImmutable('now',new DateTimeZone('UTC')))->format(DATE_ATOM);
      $encoded=json_encode($draft,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
      if($encoded===false||strlen($encoded)>250000){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'draft_invalid'],422);}
      $pdo->prepare("UPDATE master_onboarding_state SET status='in_progress',draft_json=?,revision=revision+1,updated_at=NOW() WHERE profile_id=?")->execute([$encoded,$profileId]);
      try{$pdo->prepare("UPDATE person_profiles SET payload_json=JSON_SET(COALESCE(payload_json,JSON_OBJECT()),'$.onboardingStatus','in_progress','$.onboardingDeferredUntil',?),updated_at=CURRENT_TIMESTAMP WHERE id=?")->execute([$until,$profileId]);}catch(Throwable $_){}
      $pdo->commit();
      if(function_exists('kareta_log_audit'))kareta_log_audit($pdo,'master.onboarding.deferred',['profileId'=>$profileId,'hours'=>$hours,'until'=>$until]);
      kareta_json(['ok'=>true,'status'=>'in_progress','deferredUntil'=>$until,'deferredHours'=>$hours,'revision'=>(int)($locked['revision']??0)+1,'redirectRoute'=>'#/master']);
    }catch(Throwable $e){
      if($pdo->inTransaction())$pdo->rollBack();
      throw $e;
    }
}

if($method==='POST'&&$action==='saveDraft'){
    if((string)$state['status']==='completed')kareta_json(['ok'=>true,'status'=>'completed','revision'=>(int)$state['revision'],'redirectRoute'=>'#/master','idempotent'=>true]);
    $draft=is_array($body['draft']??null)?$body['draft']:[];$encoded=json_encode($draft,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);if($encoded===false||strlen($encoded)>250000)kareta_json(['ok'=>false,'error'=>'draft_invalid'],422);
    $step=max(1,min(4,(int)($body['currentStep']??$draft['currentStep']??1)));$view=kmob_text($body['currentView']??$draft['currentView']??'master-profile',64);$expected=(int)($body['expectedRevision']??$state['revision']);
    $q=$pdo->prepare("UPDATE master_onboarding_state SET status='in_progress',current_step=?,current_view=?,draft_json=?,revision=revision+1,updated_at=NOW() WHERE profile_id=? AND revision=? AND status<>'completed'");$q->execute([$step,$view,$encoded,$profileId,$expected]);
    if($q->rowCount()<1){$r=$pdo->prepare("SELECT revision,status,draft_json,current_step,current_view,updated_at FROM master_onboarding_state WHERE profile_id=?");$r->execute([$profileId]);$latest=$r->fetch(PDO::FETCH_ASSOC)?:[];kareta_json(['ok'=>false,'error'=>'draft_revision_conflict','revision'=>(int)($latest['revision']??0),'status'=>(string)($latest['status']??''),'draft'=>kmob_decode($latest['draft_json']??null,[]),'updatedAt'=>(string)($latest['updated_at']??'')],409);}
    try{$pdo->prepare("UPDATE person_profiles SET payload_json=JSON_SET(COALESCE(payload_json,JSON_OBJECT()),'$.onboardingStatus','in_progress'),updated_at=CURRENT_TIMESTAMP WHERE id=?")->execute([$profileId]);}catch(Throwable $_){}
    $q=$pdo->prepare("SELECT revision,updated_at FROM master_onboarding_state WHERE profile_id=?");$q->execute([$profileId]);$saved=$q->fetch(PDO::FETCH_ASSOC)?:[];kareta_json(['ok'=>true,'status'=>'in_progress','revision'=>$expected+1,'updatedAt'=>(string)($saved['updated_at']??'')]);
}

if($method==='POST'&&$action==='removeAvatar'){
    $uid=(int)($master['user_id']??0);
    if($uid<=0)kareta_json(['ok'=>false,'error'=>'master_user_link_missing'],409);
    $pdo->prepare("UPDATE users SET avatar_url=NULL WHERE id=?")->execute([$uid]);
    kareta_json(['ok'=>true,'avatarUrl'=>'','uploadToken'=>null]);
}

if($method==='POST'&&$action==='uploadAvatar'){
    $data=(string)($body['dataUrl']??'');if(!preg_match('~^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=\r\n]+)$~',$data,$avatarMatch))kareta_json(['ok'=>false,'error'=>'avatar_invalid'],422);
    $bytes=base64_decode(preg_replace('/\s+/','',(string)$avatarMatch[2]),true);if($bytes===false)kareta_json(['ok'=>false,'error'=>'avatar_invalid'],422);if(strlen($bytes)>1500000)kareta_json(['ok'=>false,'error'=>'avatar_too_large'],413);
    $imageInfo=function_exists('getimagesizefromstring')?@getimagesizefromstring($bytes):false;$detected=is_array($imageInfo)?strtolower((string)($imageInfo['mime']??'')):'';$allowed=['image/jpeg','image/png','image/webp'];if($imageInfo===false||!in_array($detected,$allowed,true))kareta_json(['ok'=>false,'error'=>'avatar_invalid'],422);
    $data='data:'.$detected.';base64,'.base64_encode($bytes);
    $uid=(int)($master['user_id']??0);if($uid<=0)kareta_json(['ok'=>false,'error'=>'master_user_link_missing'],409);kareta_ensure_column($pdo,'users','avatar_url',"ALTER TABLE `users` ADD COLUMN `avatar_url` MEDIUMTEXT NULL AFTER `initials`");$pdo->prepare("UPDATE users SET avatar_url=? WHERE id=?")->execute([$data,$uid]);$token='master_avatar_'.substr(hash('sha256',$profileId.'|'.hash('sha256',$bytes).'|'.microtime(true)),0,24);kareta_json(['ok'=>true,'uploadToken'=>$token,'avatarUrl'=>'/api/master_onboarding.php?action=avatar&v='.rawurlencode($token)]);
}

if($method==='POST'&&$action==='complete'){
    $idem=kmob_text($_SERVER['HTTP_IDEMPOTENCY_KEY']??$body['idempotencyKey']??'',96);if($idem==='')$idem='mob_'.substr(hash('sha256',$profileId.'|'.microtime(true).'|'.random_int(1,PHP_INT_MAX)),0,40);
    $catalog=kmob_catalog_snapshot($pdo);
    try{$pdo->beginTransaction();$q=$pdo->prepare("SELECT * FROM master_onboarding_state WHERE profile_id=? FOR UPDATE");$q->execute([$profileId]);$locked=$q->fetch(PDO::FETCH_ASSOC)?:[];if(!$locked){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'onboarding_state_missing'],409);}if((string)$locked['status']==='completed'){$pdo->commit();kareta_json(kmob_completed_payload($pdo,$contexts,$accountId,$current,$locked,$master,true));}
      $draft=is_array($body['draft']??null)?$body['draft']:kmob_decode($locked['draft_json']??null,[]);$expected=(int)($body['expectedRevision']??$draft['revision']??$locked['revision']);if($expected!==(int)$locked['revision']){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'draft_revision_conflict','revision'=>(int)$locked['revision'],'status'=>(string)$locked['status'],'draft'=>kmob_decode($locked['draft_json']??null,[]),'updatedAt'=>(string)($locked['updated_at']??'')],409);}
      $loc=is_array($draft['workLocation']??null)?$draft['workLocation']:[];
      if(($loc['locationSource']??'personal')==='organization'){$selected=kmob_resolve_organization_location($pdo,$master,['legacyUser'=>$auth->legacyUser??[]],$loc);if(!$selected){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'validation_failed','fields'=>['workLocation.organizationLocationId'=>'organization_location_forbidden']],422);} $loc['cityId']=$selected['cityId'];$loc['cityName']=$selected['city'];$loc['cityConfirmed']=true;$loc['address']=['text'=>$selected['address'],'latitude'=>$selected['latitude'],'longitude'=>$selected['longitude'],'placeId'=>$selected['id'],'isPublic'=>true];$draft['workLocation']=$loc;}
      $cityRow=kmob_resolve_city($pdo,$master,['legacyUser'=>$auth->legacyUser??[]],$loc);if(!$cityRow){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'validation_failed','fields'=>['workLocation.cityId'=>'city_invalid']],422);} $draft['workLocation']['cityId']=$cityRow['id'];$draft['workLocation']['cityName']=$cityRow['name'];$loc=$draft['workLocation'];
      $errors=kmob_validate($draft);if($errors){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'validation_failed','fields'=>$errors],422);}
      $profile=$draft['profile'];$services=array_values(array_filter(is_array($draft['services']??null)?$draft['services']:[],static fn($service):bool=>is_array($service)&&(!array_key_exists('isActive',$service)||!empty($service['isActive']))));$draft['services']=$services;$agreement=$draft['agreement'];$masterId=(string)$master['id'];$uid=(int)($master['user_id']??0);
      $specId=kmob_text($profile['primarySpecializationId']??'',64);if(!isset($catalog['categories'][$specId])){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'validation_failed','fields'=>['profile.primarySpecializationId'=>'specialization_invalid']],422);}
      foreach($services as $i=>$service){if(!is_array($service))continue;$source=(string)($service['source']??'catalog');if($source==='catalog'){$sid=kmob_text($service['serviceId']??'',120);if($sid===''||!isset($catalog['services'][$sid])){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'validation_failed','fields'=>["services.$i.serviceId"=>'service_not_found']],422);}}else{$categoryId=kmob_text($service['categoryId']??'',64);if(!isset($catalog['categories'][$categoryId])){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'validation_failed','fields'=>["services.$i.categoryId"=>'custom_service_category_invalid']],422);}}}
      $name=kmob_text($profile['displayName'],100);$bio=kmob_text($profile['bio']??'',500);$range=kmob_text($profile['experienceRange'],32);$city=kmob_text($loc['cityName']??$loc['cityId'],120);$mode=kmob_text($loc['mode'],16);$address=is_array($loc['address']??null)?$loc['address']:[];$origin=is_array($loc['mobileOrigin']??null)?$loc['mobileOrigin']:[];$area=is_array($loc['serviceArea']??null)?$loc['serviceArea']:[];
      $custom=[];$primary=[];foreach($services as $service){if(!is_array($service)||empty($service['isActive'])&&array_key_exists('isActive',$service))continue;$primary[]=kmob_text($service['name']??$service['serviceId']??'',120);if(($service['source']??'catalog')==='custom'){$custom[]=[
        'serviceId'=>null,
        'customServiceId'=>kmob_text($service['customServiceId']??'',120),
        'source'=>'custom',
        'categoryId'=>kmob_text($service['categoryId']??'',64),
        'name'=>kmob_text($service['name']??'',120),
        'priceFrom'=>($service['priceMode']??'from')==='negotiable'?0:max(1,(int)($service['priceFrom']??0)),
        'priceMode'=>($service['priceMode']??'from')==='negotiable'?'negotiable':'from',
        'description'=>kmob_text($service['description']??'',500),
        'isActive'=>true,
        'moderationStatus'=>'pending',
      ];}}
      $resume=kmob_decode($master['resume']??null,[]);$resume['bio']=$bio;$resume['experience']=kmob_experience_label($range);$resume['experienceRange']=$range;$resume['primarySpecializationId']=$specId;$resume['customServices']=$custom;$resume['workLocationSource']=kmob_text($loc['locationSource']??'personal',32);$resume['organizationLocationId']=kmob_text($loc['organizationLocationId']??'',120);$resume['onboardingCompletedAt']=date(DATE_ATOM);
      $sets=[];$vals=[];$put=function(string $column,$value)use(&$sets,&$vals,$pdo){if(kareta_column_exists($pdo,'masters',$column)){$sets[]="`{$column}`=?";$vals[]=$value;}};
      $put('name',$name);$put('spec',$specId);$put('description',$bio);$put('city',$city);$put('work_mode',kmob_mode_to_storage($mode));$activeAddress=in_array($mode,['fixed','both'],true)?kmob_text($address['text']??'',200):'';$activeRadius=in_array($mode,['mobile','both'],true)?max(0,min(500,(int)($area['radiusKm']??0))):0;$put('service_address',$activeAddress);$put('service_radius_km',$activeRadius);$lat=$mode==='mobile'?($origin['latitude']??null):($address['latitude']??$origin['latitude']??null);$lng=$mode==='mobile'?($origin['longitude']??null):($address['longitude']??$origin['longitude']??null);if(is_numeric($lat))$put('service_lat',(float)$lat);if(is_numeric($lng))$put('service_lng',(float)$lng);$put('location_visibility',$mode==='mobile'?'city':'exact');$put('experience_label',kmob_experience_label($range));$put('primary_services',json_encode(array_values(array_filter($primary)),JSON_UNESCAPED_UNICODE));$put('profile_visible',1);$put('resume',json_encode($resume,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
      if($sets){$vals[]=$masterId;$pdo->prepare("UPDATE masters SET ".implode(',',$sets)." WHERE BINARY id=BINARY ?")->execute($vals);}if($uid>0){$userSets=['name=?','city=?'];$userVals=[$name,$city];if(kareta_column_exists($pdo,'users','bio')){$userSets[]='bio=?';$userVals[]=$bio;}$userVals[]=$uid;$pdo->prepare("UPDATE users SET ".implode(',',$userSets)." WHERE id=?")->execute($userVals);}
      if(kareta_table_exists($pdo,'geo_points')){
        $fixedLat=kareta_geo_number($address['latitude']??null);$fixedLng=kareta_geo_number($address['longitude']??null);
        $originLat=kareta_geo_number($origin['latitude']??null);$originLng=kareta_geo_number($origin['longitude']??null);
        if(in_array($mode,['fixed','both'],true)&&kareta_geo_coords_valid($fixedLat,$fixedLng)&&$fixedLat!==null&&$fixedLng!==null){
          kareta_geo_upsert_point($pdo,['ownerType'=>'master','ownerId'=>$masterId,'kind'=>'service','label'=>$name,'city'=>$city,'address'=>$activeAddress,'latitude'=>$fixedLat,'longitude'=>$fixedLng,'source'=>($loc['locationSource']??'personal')==='organization'?'organization':'gps','visibility'=>'exact','active'=>true,'metadata'=>['workMode'=>$mode,'organizationLocationId'=>kmob_text($loc['organizationLocationId']??'',120)]]);
        }else{kareta_geo_set_owner_kind_active($pdo,'master',$masterId,'service',false);}
        if(in_array($mode,['mobile','both'],true)&&kareta_geo_coords_valid($originLat,$originLng)&&$originLat!==null&&$originLng!==null){
          kareta_geo_upsert_point($pdo,['ownerType'=>'master','ownerId'=>$masterId,'kind'=>'mobile_origin','label'=>$name,'city'=>$city,'address'=>kmob_text($origin['text']??'',200),'latitude'=>$originLat,'longitude'=>$originLng,'source'=>'gps','visibility'=>'city','active'=>true,'metadata'=>['workMode'=>$mode,'radiusKm'=>$activeRadius]]);
        }else{kareta_geo_set_owner_kind_active($pdo,'master',$masterId,'mobile_origin',false);}
      }
      if(kareta_table_exists($pdo,'service_offers')){$selected=[];foreach($services as $service){if(!is_array($service)||($service['source']??'catalog')==='custom')continue;$sid=kmob_text($service['serviceId']??'',64);if($sid==='')continue;$check=$pdo->prepare("SELECT id FROM service_catalog WHERE id=? AND active=1 LIMIT 1");$check->execute([$sid]);if(!$check->fetchColumn()){throw new RuntimeException('service_not_found:'.$sid);}$selected[]=$sid;$priceMode=($service['priceMode']??'from')==='negotiable'?'agreement':'from';$price=$priceMode==='agreement'?0:max(1,(int)($service['priceFrom']??0));$sql="INSERT INTO service_offers(service_id,owner_type,owner_user_id,owner_entity_id,city,price,price_type,price_max,duration_min,duration_max_min,warranty_days,availability_status,booking_enabled,notes,active,moderation_status) VALUES(?,'master',?,?,?,?,?,0,0,0,0,'available',1,'',1,'approved') ON DUPLICATE KEY UPDATE city=VALUES(city),price=VALUES(price),price_type=VALUES(price_type),availability_status='available',booking_enabled=1,active=1,moderation_status='approved',updated_at=CURRENT_TIMESTAMP";$pdo->prepare($sql)->execute([$sid,$uid,$masterId,$city,$price,$priceMode]);}
        if($selected){$marks=implode(',',array_fill(0,count($selected),'?'));$args=array_merge([$masterId],$selected);$pdo->prepare("UPDATE service_offers SET active=0,booking_enabled=0,availability_status='paused',updated_at=CURRENT_TIMESTAMP WHERE owner_type='master' AND BINARY owner_entity_id=BINARY ? AND service_id NOT IN ($marks)")->execute($args);}else{$pdo->prepare("UPDATE service_offers SET active=0,booking_enabled=0,availability_status='paused',updated_at=CURRENT_TIMESTAMP WHERE owner_type='master' AND BINARY owner_entity_id=BINARY ?")->execute([$masterId]);}}
      $terms=KMOB_TERMS_VERSION;$draft['onboardingStatus']='completed';$draft['agreement']['acceptedAt']=date(DATE_ATOM);$encoded=json_encode($draft,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
      $pdo->prepare("UPDATE master_onboarding_state SET status='completed',current_step=4,current_view='master-review',draft_json=?,revision=revision+1,idempotency_key=?,terms_version=?,completed_at=NOW(),updated_at=NOW() WHERE profile_id=?")->execute([$encoded,$idem,$terms,$profileId]);
      $pdo->prepare("UPDATE person_profiles SET payload_json=JSON_SET(COALESCE(payload_json,JSON_OBJECT()),'$.onboardingStatus','completed','$.publicationStatus','active','$.verificationStatus',COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.verificationStatus')),'unverified'),'$.onboardingCompletedAt',DATE_FORMAT(NOW(),'%Y-%m-%dT%H:%i:%sZ')),updated_at=CURRENT_TIMESTAMP WHERE id=?")->execute([$profileId]);
      if(kareta_column_exists($pdo,'person_profiles','onboarding_status'))$pdo->prepare("UPDATE person_profiles SET onboarding_status='completed' WHERE id=?")->execute([$profileId]);
      if(kareta_column_exists($pdo,'person_profiles','publication_status'))$pdo->prepare("UPDATE person_profiles SET publication_status='active' WHERE id=?")->execute([$profileId]);
      $pdo->commit();
      if(function_exists('kareta_log_audit'))kareta_log_audit($pdo,'master.onboarding.completed',['accountId'=>$accountId,'profileId'=>$profileId,'masterId'=>$masterId,'services'=>count($services),'mode'=>$mode]);
      $allowed=kmob_effective_capabilities_safe($pdo,$contexts,$accountId,(int)$current['id']);kareta_json(['ok'=>true,'status'=>'completed','masterProfileId'=>$masterId,'contextId'=>(int)$current['id'],'capabilitiesVersion'=>null,'capabilities'=>$allowed,'redirectRoute'=>'#/master']);
    }catch(RuntimeException $e){if($pdo->inTransaction())$pdo->rollBack();$m=$e->getMessage();if(function_exists('kareta_log_error'))kareta_log_error('MASTER_ONBOARDING_COMPLETE_RUNTIME',$m);if(str_starts_with($m,'service_not_found:'))kareta_json(['ok'=>false,'error'=>'validation_failed','fields'=>['services'=>'service_not_found']],422);kareta_json(['ok'=>false,'error'=>'master_onboarding_complete_failed','message'=>'Не удалось сохранить профиль'],500);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if(function_exists('kareta_log_error'))kareta_log_error('MASTER_ONBOARDING_COMPLETE',$e->getMessage());kareta_json(['ok'=>false,'error'=>'master_onboarding_complete_failed','message'=>'Не удалось сохранить профиль'],500);}
}

kareta_json(['ok'=>false,'error'=>'not_found'],404);
