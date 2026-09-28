<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$checks=[
 'endpoint'=>is_file($root.'/api/runtime_diagnostics.php'),
 'bootstrap_store'=>strpos((string)file_get_contents($root.'/api/bootstrap.php'),'kareta_db_store_diagnostic')!==false,
 'browser_console'=>strpos((string)file_get_contents($root.'/js/next/runtime_logger.js'),'SERVER DIAGNOSTICS')!==false,
 'manual_api'=>strpos((string)file_get_contents($root.'/js/next/runtime_logger.js'),'KaretaDiagnostics')!==false,
 'version'=>strpos((string)file_get_contents($root.'/inc/asset_version.php'),'browser-db-diagnostics-r173')!==false,
];
$failed=array_keys(array_filter($checks,fn($v)=>!$v));
echo json_encode(['ok'=>!$failed,'checks'=>$checks,'failed'=>$failed],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE).PHP_EOL;
exit($failed?1:0);
