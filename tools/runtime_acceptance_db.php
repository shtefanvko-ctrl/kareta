<?php
declare(strict_types=1);

$root=dirname(__DIR__);
require_once $root.'/api/bootstrap.php';
require_once $root.'/api/identity/schema_contract.php';

function acceptance_fail(string $message): never {
    fwrite(STDERR,"RUNTIME_DB_ACCEPTANCE: FAIL {$message}\n");
    exit(1);
}

$pdo=kareta_pdo();
if(!$pdo instanceof PDO) acceptance_fail('pdo_unavailable');

$expected=(int)(defined('KARETA_DB_VERSION')?KARETA_DB_VERSION:0);
if($expected!==144) acceptance_fail('unexpected_db_version_'.$expected);

$versionStmt=$pdo->prepare("SELECT `value` FROM `db_meta` WHERE `key`='schema_version' LIMIT 1");
$versionStmt->execute();
$schemaVersion=(int)($versionStmt->fetchColumn()?:0);
if($schemaVersion!==$expected) acceptance_fail("schema_version_{$schemaVersion}");

$historyStmt=$pdo->prepare("SELECT COUNT(*) AS c,COALESCE(MIN(`version`),0) AS min_v,COALESCE(MAX(`version`),0) AS max_v,
    SUM(CASE WHEN COALESCE(`checksum`,'')='' THEN 1 ELSE 0 END) AS empty_checksums
    FROM `db_migrations` WHERE `version` BETWEEN 1 AND ?");
$historyStmt->execute([$expected]);
$history=$historyStmt->fetch(PDO::FETCH_ASSOC)?:[];
if((int)($history['c']??0)!==$expected||(int)($history['min_v']??0)!==1||(int)($history['max_v']??0)!==$expected) {
    acceptance_fail('migration_history_not_contiguous');
}
if((int)($history['empty_checksums']??0)!==0) acceptance_fail('migration_checksum_missing');

$requiredTables=['users','accounts','persons','person_profiles','auth_sessions','geo_points','orders','obd_diagnostic_sessions'];
$tableStmt=$pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?");
foreach($requiredTables as $table){
    $tableStmt->execute([$table]);
    if((int)$tableStmt->fetchColumn()!==1) acceptance_fail('missing_table_'.$table);
}

$schema=KaretaSchemaContract::inspect($pdo);
if(empty($schema['ok'])) acceptance_fail('identity_schema_contract_failed');

$report=[
    'status'=>'PASS',
    'dbVersion'=>$expected,
    'schemaVersion'=>$schemaVersion,
    'migrationCount'=>(int)$history['c'],
    'migrationMin'=>(int)$history['min_v'],
    'migrationMax'=>(int)$history['max_v'],
    'requiredTables'=>$requiredTables,
    'identitySchemaOk'=>true,
    'checkedAt'=>gmdate(DATE_ATOM),
];
$dir=$root.'/artifacts/runtime-acceptance';
if(!is_dir($dir)&&!mkdir($dir,0775,true)&&!is_dir($dir)) acceptance_fail('artifact_dir_failed');
file_put_contents($dir.'/mysql.json',json_encode($report,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES).PHP_EOL);
echo "RUNTIME_DB_ACCEPTANCE: PASS db={$expected} migrations={$history['c']} schema_contract=PASS\n";
