<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function kareta_readiness_check_storage_dir(string $label, string $path): array
{
    $exists = is_dir($path);
    return [
        'label' => $label,
        'path' => $path,
        'exists' => $exists,
        'readable' => $exists && is_readable($path),
        'writable' => $exists && is_writable($path),
    ];
}

function kareta_readiness_table_count(?PDO $pdo, string $table): ?int
{
    if (!$pdo) return null;
    try {
        if (!kareta_table_exists($pdo, $table)) return null;
        return (int)$pdo->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
    } catch (Throwable $_e) {
        return null;
    }
}

function kareta_readiness_migration_version(?PDO $pdo): int
{
    if (!$pdo) return 0;
    try {
        if (!kareta_table_exists($pdo, 'db_migrations')) return 0;
        return (int)($pdo->query("SELECT COALESCE(MAX(version),0) FROM `db_migrations`")->fetchColumn() ?: 0);
    } catch (Throwable $_e) {
        return 0;
    }
}

function kareta_readiness_expected_tables(): array
{
    return [
        'users',
        'clients',
        'masters',
        'orders',
        'chats',
        'messages',
        'audit_log',
        'system_logs',
        'site_content',
        'reviews_public',
        'client_vehicles',
        'parts_catalog',
        'product_categories',
        'seller_products',
        'parts_request_offers',
        'sto_profiles',
        'sto_master_links',
        'sto_client_links',
        'order_assignments',
    ];
}

function kareta_readiness(): void
{
    $started = microtime(true);
    $pdo = null;
    $dbOk = false;
    $dbError = null;

    try {
        $pdo = kareta_pdo();
        $dbOk = $pdo instanceof PDO;
    } catch (Throwable $e) {
        $dbError = $e->getMessage();
    }

    $expectedTables = kareta_readiness_expected_tables();
    $tables = [];
    $missingTables = [];

    if ($pdo instanceof PDO) {
        foreach ($expectedTables as $table) {
            $exists = false;
            try { $exists = kareta_table_exists($pdo, $table); } catch (Throwable $_e) {}
            $tables[$table] = $exists;
            if (!$exists) $missingTables[] = $table;
        }
    } else {
        foreach ($expectedTables as $table) {
            $tables[$table] = false;
            $missingTables[] = $table;
        }
    }

    $storage = [
        kareta_readiness_check_storage_dir('storage', defined('KARETA_STORAGE_ROOT') ? KARETA_STORAGE_ROOT : dirname(__DIR__) . '/storage'),
        kareta_readiness_check_storage_dir('logs', defined('KARETA_LOG_ROOT') ? KARETA_LOG_ROOT : dirname(__DIR__) . '/storage/logs'),
    ];
    $storageOk = true;
    foreach ($storage as $item) {
        if (!$item['exists'] || !$item['readable'] || !$item['writable']) {
            $storageOk = false;
            break;
        }
    }

    $migrationCurrent = kareta_readiness_migration_version($pdo);
    $migrationExpected = defined('KARETA_DB_VERSION') ? (int)KARETA_DB_VERSION : 0;
    $migrationOk = $migrationExpected <= 0 || $migrationCurrent >= $migrationExpected;

    $counts = [
        'users' => kareta_readiness_table_count($pdo, 'users'),
        'masters' => kareta_readiness_table_count($pdo, 'masters'),
        'orders' => kareta_readiness_table_count($pdo, 'orders'),
        'parts_catalog' => kareta_readiness_table_count($pdo, 'parts_catalog'),
        'product_categories' => kareta_readiness_table_count($pdo, 'product_categories'),
        'seller_products' => kareta_readiness_table_count($pdo, 'seller_products'),
        'site_content' => kareta_readiness_table_count($pdo, 'site_content'),
    ];

    $config = [
        'appName' => defined('KARETA_APP') && is_array(KARETA_APP) ? (KARETA_APP['name'] ?? 'KARETA.KZ') : 'KARETA.KZ',
        'timezone' => date_default_timezone_get(),
        'assetVersion' => defined('KARETA_ASSET_VERSION') ? KARETA_ASSET_VERSION : (defined('APP_VER') ? APP_VER : ''),
        'dbVersionExpected' => $migrationExpected,
        'demoMode' => defined('KARETA_DEMO_MODE') ? (bool)KARETA_DEMO_MODE : null,
        'demoExchange' => defined('KARETA_DEMO_EXCHANGE') ? (bool)KARETA_DEMO_EXCHANGE : null,
        'seedOnEmptyDb' => defined('KARETA_SEED_ON_EMPTY_DB') ? (bool)KARETA_SEED_ON_EMPTY_DB : null,
    ];

    $checks = [
        'php' => PHP_VERSION_ID >= 80100,
        'pdoMysql' => kareta_pdo_mysql_driver_available(),
        'database' => $dbOk,
        'tables' => empty($missingTables),
        'migrations' => $migrationOk,
        'storage' => $storageOk,
        'assetsVersioned' => trim((string)$config['assetVersion']) !== '',
        'deployCheckEndpoint' => is_file(__DIR__ . '/deploy_check.php'),
        'releaseCheckEndpoint' => is_file(__DIR__ . '/release_check.php'),
        'releaseStatusEndpoint' => is_file(__DIR__ . '/release_status.php'),
        'versionCheckEndpoint' => is_file(__DIR__ . '/version_check.php'),
        'postDeployEndpoint' => is_file(__DIR__ . '/post_deploy_check.php'),
        'maintenanceCheckEndpoint' => is_file(__DIR__ . '/maintenance_check.php'),
        'staticQualityEndpoint' => is_file(__DIR__ . '/static_quality_check.php'),
        'cssQualityEndpoint' => is_file(__DIR__ . '/css_quality_check.php'),
        'accessibilityEndpoint' => is_file(__DIR__ . '/accessibility_check.php'),
    ];

    $ok = !in_array(false, $checks, true);
    $status = $ok ? 200 : 503;

    if (!kareta_diagnostics_authorized()) {
        kareta_json([
            'ok'=>$ok,
            'status'=>$ok?'ready':'not_ready',
            'assetVersion'=>(string)$config['assetVersion'],
            'checks'=>[
                'php'=>$checks['php'],
                'pdoMysql'=>$checks['pdoMysql'],
                'database'=>$checks['database'],
                'migrations'=>$checks['migrations'],
                'storage'=>$checks['storage'],
                'assetsVersioned'=>$checks['assetsVersioned'],
            ],
            'requestId'=>defined('KARETA_REQUEST_ID')?KARETA_REQUEST_ID:'',
        ],$status);
    }

    kareta_json([
        'ok' => $ok,
        'status' => $ok ? 'ready' : 'not_ready',
        'checks' => $checks,
        'config' => $config,
        'database' => [
            'ok' => $dbOk,
            'error' => $dbError,
            'migrationCurrent' => $migrationCurrent,
            'migrationExpected' => $migrationExpected,
            'missingTables' => $missingTables,
            'tables' => $tables,
            'counts' => $counts,
        ],
        'storage' => $storage,
        'runtime' => [
            'phpVersion' => PHP_VERSION,
            'memoryLimit' => ini_get('memory_limit'),
            'maxUpload' => ini_get('upload_max_filesize'),
            'postMaxSize' => ini_get('post_max_size'),
            'requestMs' => round((microtime(true) - $started) * 1000, 2),
            'time' => date(DATE_ATOM),
        ],
    ], $status);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    kareta_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

kareta_readiness();
