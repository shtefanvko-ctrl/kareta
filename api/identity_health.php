<?php
declare(strict_types=1);
ini_set('display_errors','0');
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/identity/auth_resolver.php';
require_once __DIR__.'/identity/schema_contract.php';
$pdo=kareta_pdo();
if(!$pdo instanceof PDO) kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);
try {
  $schema=KaretaSchemaContract::inspect($pdo);
  KaretaSchemaContract::record($pdo,$schema,'identity_health');
  if(!$schema['ok']) kareta_json(kareta_diagnostics_authorized()?['ok'=>false,'error'=>'schema_contract_failed','status'=>'degraded','schema'=>$schema]:['ok'=>false,'status'=>'degraded','error'=>'identity_unavailable'],503);
  $auth=(new KaretaAuthResolver($pdo))->resolve(false);
  if(!kareta_diagnostics_authorized())kareta_json(['ok'=>true,'status'=>'ready','assetVersion'=>defined('KARETA_ASSET_VERSION')?KARETA_ASSET_VERSION:'']);
  kareta_json([
    'ok'=>true,'status'=>'ready',
    'assetVersion'=>defined('KARETA_ASSET_VERSION')?KARETA_ASSET_VERSION:'',
    'dbVersion'=>defined('KARETA_DB_VERSION')?KARETA_DB_VERSION:0,
    'authenticated'=>$auth!==null,
    'mode'=>$auth ? $auth->mode : 'anonymous',
    'accountId'=>$auth ? $auth->accountId : null,
    'personId'=>$auth ? $auth->personId : null,
    'context'=>$auth ? $auth->context : null,
    'capabilityCount'=>$auth ? count($auth->capabilities) : 0,
    'serverTime'=>date(DATE_ATOM),
  ]);
} catch(DomainException $e) {
  kareta_json(['ok'=>false,'error'=>$e->getMessage(),'status'=>'degraded'],409);
}
