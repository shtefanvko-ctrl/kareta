<?php
declare(strict_types=1);
/**
 * Staging-only, additive professional service catalog import.
 * Does not modify old records, master prices, permissions, bookings, or provider offers.
 * Run: php tools/professional_services_staging_import.php --check|--apply
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit(1); }
$root = dirname(__DIR__);
$mode = $argv[1] ?? '--check';
if (!in_array($mode, ['--check','--apply'], true)) {fwrite(STDERR, "Only --check or --apply\n");exit(2);}
if (realpath($root) !== '/home/karetadmin/kareta-workspace/staging-site/kareta') {
    fwrite(STDERR,"Refused: not local KARETA staging root\n");exit(2);
}
require_once $root.'/config.php';
$input = $root.'/storage/catalog/professional_services_draft.json';
if (!is_file($input)) {fwrite(STDERR,"Candidate source missing\n");exit(2);}
$draft = json_decode((string)file_get_contents($input),true,512,JSON_THROW_ON_ERROR);
if (($draft['status']??'') !== 'DRAFT_ONLY_NOT_IMPORTED' ||
    ($draft['published']??true)!==false ||
    ($draft['matchingEnabled']??true)!==false ||
    ($draft['technicalRelationsVerified']??true)!==false) {
    fwrite(STDERR,"Unsafe candidate manifest\n");exit(2);
}
$items=$draft['items']??[];
if (!is_array($items)||count($items)!==113) {fwrite(STDERR,"Expected 113 candidates\n");exit(2);}
$prof=json_decode((string)file_get_contents($root.'/storage/catalog/master_professions.json'),true,512,JSON_THROW_ON_ERROR);
$eq=json_decode((string)file_get_contents($root.'/storage/catalog/master_equipment.json'),true,512,JSON_THROW_ON_ERROR);
$profIds=array_fill_keys(array_column($prof['items'],'id'),true);
$eqIds=array_fill_keys(array_column($eq['items'],'id'),true);
$categories=[];
$catalog=json_decode((string)file_get_contents($root.'/storage/catalog/services.json'),true,512,JSON_THROW_ON_ERROR);
foreach ($catalog['categories'] as $cat) $categories[(string)$cat['key']] = $cat;
$legacyIds=array_fill_keys(array_column($catalog['services'],'id'),true);
$seen=[];$names=[];
foreach ($items as $i=>$item) {
    $id=(string)($item['serviceId']??''); $title=trim((string)($item['nameRu']??''));
    $category=(string)($item['categoryKey']??'');
    if (!preg_match('/^pro_[a-z0-9_]{4,60}$/D',$id) || isset($seen[$id]) || isset($legacyIds[$id])
        || !isset($categories[$category]) || mb_strlen($title)<8 || mb_strlen($title)>191
        || ($item['status']??'')!=='DRAFT_ONLY' || ($item['availableForBooking']??true)!==false
        || ($item['autoEnableForMasters']??true)!==false || ($item['hardEquipmentFilter']??true)!==false
        || !array_key_exists('basePrice',$item) || $item['basePrice']!==null || empty($item['professionIds'])) {
        fwrite(STDERR,"Candidate validation failed at index {$i}\n");exit(2);
    }
    foreach ($item['professionIds'] as $p) if (!isset($profIds[$p])) {fwrite(STDERR,"Unknown profession at index {$i}\n");exit(2);}
    foreach ($item['suggestedEquipmentIds']??[] as $e) if (!isset($eqIds[$e])) {fwrite(STDERR,"Unknown equipment at index {$i}\n");exit(2);}
    $key=$category.'/'.mb_strtolower($title);
    if (isset($names[$key])) {fwrite(STDERR,"Duplicate candidate title at index {$i}\n");exit(2);}
    $seen[$id]=true;$names[$key]=true;
}
$dbConf=KARETA_DB;
$dsn=trim((string)($dbConf['socket']??''))!==''
    ? 'mysql:unix_socket='.$dbConf['socket'].';dbname='.$dbConf['database'].';charset=utf8mb4'
    : 'mysql:host='.$dbConf['host'].';port='.$dbConf['port'].';dbname='.$dbConf['database'].';charset=utf8mb4';
$pdo = new PDO($dsn,$dbConf['username']??$dbConf['user']??'',$dbConf['password']??'',
    [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false,PDO::ATTR_TIMEOUT=>5]);
$pdo->exec("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
$existing=(int)$pdo->query("SELECT COUNT(*) FROM service_catalog")->fetchColumn();
$existingOffers=(int)$pdo->query("SELECT COUNT(*) FROM service_offers")->fetchColumn();
$existingLegacy=(int)$pdo->query("SELECT COUNT(*) FROM services")->fetchColumn();
$ids=array_keys($seen);
$in=implode(',',array_fill(0,count($ids),'?'));
$found=$pdo->prepare("SELECT id,source_key FROM service_catalog WHERE id IN ($in)");
$found->execute($ids);
$already=$found->fetchAll();
foreach ($already as $row) if ($row['source_key']!=='kareta_professional_20261021') {
    fwrite(STDERR,"Existing ID belongs to another source; no changes applied\n");exit(2);
}
echo "mode={$mode} candidates=".count($items)." already=".count($already)
    ." catalog_before={$existing} legacy_before={$existingLegacy} offers_before={$existingOffers}\n";
if ($mode==='--check') {echo "CHECK_OK no data changed\n";exit(0);}
$backupDir=$root.'/storage/backups/professional_services_20261021';
if (!is_dir($backupDir) && !mkdir($backupDir,0700,true) && !is_dir($backupDir))
    throw new RuntimeException('Cannot create backup directory');
chmod($backupDir,0700);
$backup=$backupDir.'/pre_import_'.gmdate('Ymd_His').'_'.bin2hex(random_bytes(4)).'.json';
$snapshot=['createdAt'=>gmdate('c'),'source'=>'staging','catalog'=>$pdo->query("SELECT * FROM service_catalog")->fetchAll(),
    'legacy'=>$pdo->query("SELECT * FROM services")->fetchAll(),
    'offers'=>$pdo->query("SELECT * FROM service_offers")->fetchAll()];
if (file_put_contents($backup,json_encode($snapshot,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),LOCK_EX)===false)
    throw new RuntimeException('Backup failed');
chmod($backup,0600);
$lock=(int)$pdo->query("SELECT GET_LOCK('kareta_professional_20261021',5)")->fetchColumn();
if ($lock!==1) throw new RuntimeException('Catalog import lock not acquired');
$inserted=0;$legacyInserted=0;
try {
    $pdo->beginTransaction();
    $cat=$pdo->prepare("INSERT INTO service_catalog
        (id,category_key,icon,name,short_desc,why_text,base_price,avg_time,price_label,time_label,steps_json,variants_json,sort,active,manual_override,source_key,source_hash)
        VALUES (?,?,?,?,?,?,0,'','По согласованию','',?, '[]',?,1,0,'kareta_professional_20261021',?)");
    $legacy=$pdo->prepare("INSERT INTO services
        (id,icon,name,cat,short_desc,why_text,base_price,avg_time,price_label,time_label,steps_json,list_json,sort,active)
        VALUES (?,?,?,?,?,?,0,'','По согласованию','',?, '[]',?,1)");
    $existingTitles=[];
    foreach ($pdo->query("SELECT category_key, name FROM service_catalog")->fetchAll() as $old) {
        $existingTitles[$old['category_key'].'/'.mb_strtolower(trim((string)$old['name']))]=true;
    }
    foreach ($items as $n=>$item) {
        $id=$item['serviceId'];$category=$item['categoryKey'];$name=$item['nameRu'];
        $alreadyThis=false;
        foreach ($already as $old) if ($old['id']===$id) {$alreadyThis=true;break;}
        if ($alreadyThis) continue;
        $titleKey=$category.'/'.mb_strtolower($name);
        if (isset($existingTitles[$titleKey])) throw new RuntimeException('Duplicate title in live DB');
        $icon=(string)($categories[$category]['icon']??'🔧');
        $desc='Конкретная профессиональная работа. Исполнитель, стоимость, применимость и сроки согласуются индивидуально.';
        $scope='Автомобиль и состав работ уточняются до начала ремонта. Цена определяется конкретным мастером.';
        $steps=json_encode(['Уточнение автомобиля и объёма работ','Согласование условий с исполнителем','Выполнение и проверка результата'],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        $sort=10000+$n;
        $hash=hash('sha256',json_encode($item,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
        $cat->execute([$id,$category,$icon,$name,$desc,$scope,$steps,$sort,$hash]);$inserted += $cat->rowCount();
        $legacy->execute([$id,$icon,$name,$category,$desc,$scope,$steps,$sort]);$legacyInserted += $legacy->rowCount();
        $existingTitles[$titleKey]=true;
    }
    $confirm=$pdo->prepare("SELECT COUNT(*) FROM service_catalog WHERE id IN ($in) AND source_key='kareta_professional_20261021' AND active=1");$confirm->execute($ids);
    if ((int)$confirm->fetchColumn()!==count($items)) throw new RuntimeException('Catalog count verification failed');
    if ((int)$pdo->query("SELECT COUNT(*) FROM service_offers")->fetchColumn()!==$existingOffers) throw new RuntimeException('Unexpected change to master offers');
    $pdo->commit();
    echo "APPLIED_OK inserted={$inserted} legacy_inserted={$legacyInserted} total="
        .$pdo->query("SELECT COUNT(*) FROM service_catalog")->fetchColumn()
        ." offers_unchanged={$existingOffers} backup=".basename($backup)."\n";
} catch(Throwable $e) {
    if ($pdo->inTransaction())$pdo->rollBack();
    fwrite(STDERR,"IMPORT_ROLLED_BACK ".get_class($e)." code=".$e->getCode()." error=".preg_replace("/[\r\n]+/"," ",substr($e->getMessage(),0,240))."\n");
    exit(1);
} finally {
    $pdo->query("SELECT RELEASE_LOCK('kareta_professional_20261021')");
}
