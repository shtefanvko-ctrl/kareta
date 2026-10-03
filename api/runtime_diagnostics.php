<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    kareta_json(['ok'=>false,'error'=>'method_not_allowed','code'=>'METHOD_NOT_ALLOWED'], 405);
}

$started = microtime(true);
$pdo = kareta_pdo();
$authorized = kareta_diagnostics_authorized();
$diagnostic = kareta_db_read_diagnostic();

if ($pdo instanceof PDO) {
    $diagnostic = [
        'time'=>date('c'),
        'requestId'=>defined('KARETA_REQUEST_ID') ? KARETA_REQUEST_ID : '',
        'traceId'=>(string)($_SERVER['HTTP_X_KARETA_TRACE_ID'] ?? ''),
        'phase'=>'ready',
        'category'=>'ready',
        'message'=>'Подключение к базе данных установлено.',
        'hint'=>'Дополнительные действия не требуются.',
        'pdoMysqlDriver'=>true,
        'php'=>['version'=>PHP_VERSION,'sapi'=>PHP_SAPI],
    ];
} elseif (!$diagnostic) {
    $diagnostic = [
        'time'=>date('c'),
        'requestId'=>defined('KARETA_REQUEST_ID') ? KARETA_REQUEST_ID : '',
        'traceId'=>(string)($_SERVER['HTTP_X_KARETA_TRACE_ID'] ?? ''),
        'phase'=>'connect',
        'category'=>'diagnostic_unavailable',
        'message'=>'PDO не создал подключение и не передал исключение в диагностический буфер.',
        'hint'=>'Проверьте, что сервер использует текущую версию bootstrap.php.',
        'pdoMysqlDriver'=>kareta_pdo_mysql_driver_available(),
        'php'=>['version'=>PHP_VERSION,'sapi'=>PHP_SAPI],
    ];
}

$databaseState = kareta_db_public_state($pdo, $diagnostic);
$failureMeta = kareta_db_public_failure_meta($diagnostic);
$response = [
    'ok'=>true,
    'dbReady'=>$pdo instanceof PDO,
    // Public diagnostics expose only actionable states, never hostnames,
    // database/user names, passwords, paths or exception details.
    'databaseState'=>$databaseState,
    'recoveryAction'=>kareta_db_public_recovery_action($databaseState),
    'runtimeState'=>PHP_VERSION_ID >= 80100 ? 'compatible' : 'php_version_unsupported',
    'configurationSource'=>defined('KARETA_DB_CONFIG_SOURCE') ? KARETA_DB_CONFIG_SOURCE : 'unknown',
    'missingConfigurationFields'=>function_exists('kareta_db_missing_config_fields') ? kareta_db_missing_config_fields() : [],
    'dbAutoUpgrade'=>defined('KARETA_DB_AUTO_UPGRADE') ? KARETA_DB_AUTO_UPGRADE : false,
    'dbAutoMigrate'=>defined('KARETA_DB_AUTO_MIGRATE') ? KARETA_DB_AUTO_MIGRATE : false,
    'dbTargetVersion'=>defined('KARETA_DB_VERSION') ? KARETA_DB_VERSION : 0,
    'assetVersion'=>defined('KARETA_ASSET_VERSION') ? KARETA_ASSET_VERSION : '',
    'durationMs'=>(int)round((microtime(true)-$started)*1000),
    'failureStage'=>$failureMeta['failureStage'],
    'failedMigrationVersion'=>$failureMeta['failedMigrationVersion'],
    'failedMigrationFile'=>$failureMeta['failedMigrationFile'] ?? '',
    'diagnosticCode'=>$failureMeta['diagnosticCode'],'failureCategory'=>$failureMeta['failureCategory'],
            'failureSqlState'=>$failureMeta['failureSqlState'],'failureDriverCode'=>$failureMeta['failureDriverCode'],
];
if($authorized)$response['diagnostic']=$diagnostic;
kareta_json($response);
