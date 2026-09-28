<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root=dirname(__DIR__);
require $root.'/config.php';
require $root.'/api/bootstrap.php';
require $root.'/api/identity/identity_migration_service.php';
$pdo=kareta_pdo();
if (!$pdo) { fwrite(STDERR,"Database unavailable\n"); exit(2); }
$args=getopt('', ['apply','dry-run','after::','limit::','status']);
$service=new KaretaIdentityMigrationService($pdo);
if (isset($args['status'])) { echo json_encode($service->status(),JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE).PHP_EOL; exit; }
$dryRun=!isset($args['apply']);
$result=$service->runBatch((int)($args['after']??0),(int)($args['limit']??100),$dryRun,null);
echo json_encode($result,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE).PHP_EOL;
