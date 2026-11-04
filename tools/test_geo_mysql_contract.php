<?php
declare(strict_types=1);
/**
 * Real MySQL Geo contract. Run ONLY against a purpose-created disposable QA DB.
 * Required env: GEO_TEST_DSN, GEO_TEST_USER, GEO_TEST_PASS.
 * Does not create/drop a database and does not touch production.
 */
$dsn=(string)getenv('GEO_TEST_DSN');
$qaRollback=str_contains($dsn,'dbname=kareta_m_staging;')
    && getenv('GEO_TEST_QA_ROLLBACK')==='1';
if (!$qaRollback && !str_contains($dsn,'dbname=kareta_geo_qa_')) {
    fwrite(STDERR, "BLOCKED: only disposable QA or explicitly rolled-back kareta_m_staging\n");
    exit(2);
}
function kareta_table_exists(PDO $pdo,string $table): bool {
    $q=$pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?');
    $q->execute([$table]);
    return (bool)$q->fetchColumn();
}
function kareta_column_exists(PDO $pdo,string $table,string $column): bool {
    $q=$pdo->prepare('SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?');
    $q->execute([$table,$column]);
    return (bool)$q->fetchColumn();
}
function check(bool $assertion,string $message): void {
    if(!$assertion)throw new RuntimeException('FAIL: '.$message);
}
$pdo=new PDO((string)getenv('GEO_TEST_DSN'),(string)getenv('GEO_TEST_USER'),(string)getenv('GEO_TEST_PASS'),[
    PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES=>false
]);
require_once dirname(__DIR__).'/api/geo_core.php';
$migration=require dirname(__DIR__).'/api/migrations/137_geo_platform_core.php';
check((int)$migration['version']===137,'original migration contract');
if($qaRollback){
    check(kareta_table_exists($pdo,'geo_points'),'existing QA Geo schema');
    check((int)$pdo->query('SELECT COUNT(*) FROM geo_points')->fetchColumn()===0,
        'existing QA geo_points must be empty before transaction-only fixtures');
    $pdo->beginTransaction();
    register_shutdown_function(static function()use($pdo): void {
        if($pdo->inTransaction())$pdo->rollBack();
    });
}else{
    ($migration['run'])($pdo);
    ($migration['run'])($pdo);
}
check(kareta_table_exists($pdo,'geo_points'),'migration/schema exists');
$columns=$pdo->query('SHOW COLUMNS FROM geo_points')->fetchAll(PDO::FETCH_COLUMN);
foreach(['id','owner_type','owner_id','kind','label','country_code','city','address',
    'latitude','longitude','source','visibility','active','verified_at','metadata_json',
    'created_at','updated_at'] as $column) {
    check(in_array($column,$columns,true),'required column '.$column);
}
$indexNames=$pdo->query('SHOW INDEX FROM geo_points')->fetchAll(PDO::FETCH_ASSOC);
check(in_array('uq_geo_owner_kind',array_column($indexNames,'Key_name'),true),'unique owner-kind index');
$upsert=static function(array $extra)use($pdo): array {
    return kareta_geo_upsert_point($pdo,array_merge([
        'ownerType'=>'master','ownerId'=>'m_near','kind'=>'service','label'=>'Near',
        'city'=>'Усть-Каменогорск','latitude'=>49.9483,'longitude'=>82.6285,
        'visibility'=>'exact','address'=>'Публичный сервис','active'=>true,
    ],$extra));
};
$upsert([]);
$upsert(['label'=>'Near updated']);
$q=$pdo->query("SELECT COUNT(*) FROM geo_points WHERE owner_type='master' AND owner_id='m_near'");
check((int)$q->fetchColumn()===1,'upsert idempotent, no duplicate');
$pdo->exec("UPDATE geo_points SET verified_at='2026-01-01 00:00:00'
            WHERE owner_type='master' AND owner_id='m_near'");
$upsert(['label'=>'Near renamed']);
check((bool)$pdo->query("SELECT verified_at FROM geo_points WHERE owner_id='m_near'")->fetchColumn(),
    'label update preserves verification');
$upsert(['latitude'=>49.9484]);
check($pdo->query("SELECT verified_at FROM geo_points WHERE owner_id='m_near'")->fetchColumn()===null,
    'coordinate update revokes verification');

$upsert(['ownerId'=>'m_hidden','visibility'=>'hidden','label'=>'Private home']);
$upsert(['ownerId'=>'m_city','visibility'=>'city','label'=>'City only']);
$upsert(['ownerType'=>'shop','ownerId'=>'shop_w','kind'=>'warehouse',
    'visibility'=>'exact','label'=>'Private warehouse']);
check((string)$pdo->query("SELECT visibility FROM geo_points WHERE owner_id='shop_w'")->fetchColumn()==='hidden',
    'warehouse stays hidden regardless of request');

$upsert(['ownerId'=>'mobile_a','kind'=>'mobile_origin','visibility'=>'exact',
    'label'=>'Mobile private','metadata'=>['geoExactConsentRecordedAt'=>'FORGED']]);
check((string)$pdo->query("SELECT visibility FROM geo_points WHERE owner_id='mobile_a'")->fetchColumn()==='city',
    'mobile exact rejected without consent');
$upsert(['ownerId'=>'mobile_a','kind'=>'mobile_origin','visibility'=>'exact',
    'label'=>'Mobile opt-in','publishExact'=>true,'metadata'=>['geoExactConsentRecordedAt'=>'FORGED']]);
$meta=(string)$pdo->query("SELECT metadata_json FROM geo_points WHERE owner_id='mobile_a'")->fetchColumn();
$decoded=json_decode($meta,true,512,JSON_THROW_ON_ERROR);
check(!empty($decoded['geoExactConsentRecordedAt'])&&$decoded['geoExactConsentRecordedAt']!=='FORGED',
    'server overwrites forged consent receipt');
$upsert(['ownerId'=>'mobile_a','kind'=>'mobile_origin','visibility'=>'city',
    'label'=>'Mobile revoked','metadata'=>['geoExactConsentRecordedAt'=>'FORGED']]);
$meta=(string)$pdo->query("SELECT metadata_json FROM geo_points WHERE owner_id='mobile_a'")->fetchColumn();
check(!isset((json_decode($meta,true)?:[])['geoExactConsentRecordedAt']),'revoked consent not reused');
check(kareta_geo_owner_points($pdo,'shop','shop_w',true)===[],'owner publicOnly excludes warehouse');
check(kareta_geo_owner_points($pdo,'master','m_hidden',true)===[],'owner publicOnly excludes hidden');

$upsert(['ownerType'=>'sto','ownerId'=>'sto_near','label'=>'Nearby STO','latitude'=>49.9485,'longitude'=>82.6286]);
$insert=$pdo->prepare("INSERT INTO geo_points
    (id,owner_type,owner_id,kind,label,city,latitude,longitude,visibility,active)
    VALUES(?, 'master', ?, 'service', 'Far', 'Усть-Каменогорск', ?, ?, 'exact', 1)");
$bulkOwnTransaction=!$pdo->inTransaction();
if($bulkOwnTransaction)$pdo->beginTransaction();
for($i=0;$i<350;$i++){
    $insert->execute(['far_'.$i,'m_far_'.$i,50.20+(($i%10)*0.01),82.9]);
}
if($bulkOwnTransaction)$pdo->commit();
$near=kareta_geo_nearby($pdo,49.9483,82.6285,100,['master','sto'],2);
check(count($near)===2,'limit after sorting');
check($near[0]['owner_id']==='m_near'&&$near[1]['owner_id']==='sto_near','nearest after 350 competing records');
check((float)$near[0]['geoDistanceKm']<(float)$near[1]['geoDistanceKm'],'Haversine sorted');
check(count(kareta_geo_nearby($pdo,49.9483,82.6285,100,['shop'],10))===0,'hidden warehouse excluded nearby');
check(kareta_geo_nearby($pdo,0,0,1,['master'],10)===[],'empty radius result');

$upsert(['ownerType'=>'sto','ownerId'=>'east_dateline','latitude'=>0,'longitude'=>179.98,'label'=>'East']);
$upsert(['ownerType'=>'sto','ownerId'=>'west_dateline','latitude'=>0,'longitude'=>-179.98,'label'=>'West']);
$across=kareta_geo_nearby($pdo,0,179.99,20,['sto'],10);
$ids=array_column($across,'owner_id');
check(in_array('east_dateline',$ids,true)&&in_array('west_dateline',$ids,true),'antimeridian crossing');
$upsert(['ownerType'=>'sto','ownerId'=>'polar','latitude'=>89.99,'longitude'=>-179,'label'=>'Polar']);
check(in_array('polar',array_column(kareta_geo_nearby($pdo,89.99,179,50,['sto'],10),'owner_id'),true),
    'polar all-longitudes coverage');
check(!kareta_geo_coords_valid(90.01,40.0)&&!kareta_geo_coords_valid(0.0,-180.01),
    'invalid coordinates rejected');
$plan=$pdo->query("EXPLAIN SELECT id FROM geo_points
    WHERE visibility='exact' AND owner_type='master' AND active=1
    AND latitude BETWEEN 49 AND 51 AND longitude BETWEEN 82 AND 84
    LIMIT 10")->fetch(PDO::FETCH_ASSOC);
check(is_array($plan),'EXPLAIN was executed');
$testRows=(int)$pdo->query('SELECT COUNT(*) FROM geo_points')->fetchColumn();
if($qaRollback){
    $pdo->rollBack();
    check((int)$pdo->query('SELECT COUNT(*) FROM geo_points')->fetchColumn()===0,
        'rollback removed all QA fixtures');
}
printf("GEO_MYSQL: PASS schema=137 migration_retry=%s test_rows=%d privacy=PASS nearest=PASS antimeridian=PASS poles=PASS EXPLAIN_key=%s rollback=%s\n",
    $qaRollback?'NOT_RUN':'PASS',$testRows,(string)($plan['key']??'NULL'),
    $qaRollback?'PASS':'NOT_APPLICABLE');
