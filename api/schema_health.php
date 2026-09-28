<?php
declare(strict_types=1);
ini_set('display_errors','0');
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/identity/schema_contract.php';
$pdo=kareta_pdo();
if(!$pdo instanceof PDO) kareta_json(['ok'=>false,'status'=>'unavailable','error'=>'database_unavailable'],503);
$result=KaretaSchemaContract::inspect($pdo);
KaretaSchemaContract::record($pdo,$result,'schema_health');
if(!kareta_diagnostics_authorized())kareta_json(['ok'=>$result['ok'],'status'=>$result['ok']?'ready':'degraded','assetVersion'=>defined('KARETA_ASSET_VERSION')?KARETA_ASSET_VERSION:''],$result['ok']?200:503);
kareta_json([
 'ok'=>$result['ok'],
 'status'=>$result['ok']?'ready':'degraded',
 'schema'=>$result,
 'dbVersion'=>defined('KARETA_DB_VERSION')?KARETA_DB_VERSION:0,
 'assetVersion'=>defined('KARETA_ASSET_VERSION')?KARETA_ASSET_VERSION:'',
 'serverTime'=>date(DATE_ATOM),
],$result['ok']?200:503);
