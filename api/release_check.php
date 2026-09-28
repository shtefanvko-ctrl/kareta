<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function kareta_release_file_ok(string $relative): array
{
    $root = dirname(__DIR__);
    $path = $root . '/' . ltrim($relative, '/');
    return [
        'file' => $relative,
        'exists' => is_file($path),
        'readable' => is_file($path) && is_readable($path),
        'size' => is_file($path) ? filesize($path) : 0,
    ];
}

function kareta_release_dir_ok(string $relative, bool $needWritable = false): array
{
    $root = dirname(__DIR__);
    $path = $root . '/' . trim($relative, '/');
    return [
        'dir' => $relative,
        'exists' => is_dir($path),
        'readable' => is_dir($path) && is_readable($path),
        'writable' => !$needWritable || (is_dir($path) && is_writable($path)),
    ];
}

function kareta_release_check(): void
{
    if (!kareta_diagnostics_authorized()) kareta_json(['ok'=>false,'error'=>'diagnostics_authorization_required'],403);
    $files = [
        kareta_release_file_ok('index.php'),
        kareta_release_file_ok('config.private.example.php'),
        kareta_release_file_ok('manifest.json'),
        kareta_release_file_ok('sw.js'),
        kareta_release_file_ok('.htaccess'),
        kareta_release_file_ok('.gitignore'),
        kareta_release_file_ok('inc/asset_version.php'),
        kareta_release_file_ok('inc/asset_registry.php'),
        kareta_release_file_ok('api/db.php'),
        kareta_release_file_ok('api/readiness.php'),
        kareta_release_file_ok('api/deploy_check.php'),
        kareta_release_file_ok('api/release_check.php'),
        kareta_release_file_ok('api/release_status.php'),
        kareta_release_file_ok('api/version_check.php'),
        kareta_release_file_ok('api/post_deploy_check.php'),
        kareta_release_file_ok('api/client_event.php'),
        kareta_release_file_ok('api/maintenance_check.php'),
        kareta_release_file_ok('api/static_quality_check.php'),
        kareta_release_file_ok('api/css_quality_check.php'),
        kareta_release_file_ok('api/accessibility_check.php'),
        kareta_release_file_ok('js/next/runtime_dependencies.js'),
        kareta_release_file_ok('js/next/api_client.js'),
        kareta_release_file_ok('js/next/pages/chats.js'),
        kareta_release_file_ok('js/next/app_next.js'),
        kareta_release_file_ok('css/onboarding_bundle.css'),
        kareta_release_file_ok('css/next/app_next.css'),
        kareta_release_file_ok('css/next/home_simple.css'),
        kareta_release_file_ok('css/next/onboarding_kflow_reference.css'),
        kareta_release_file_ok('storage/.htaccess'),
        kareta_release_file_ok('tools/backup_project.php'),
        kareta_release_file_ok('tools/cleanup_runtime.php'),
        kareta_release_file_ok('tools/.htaccess'),
        kareta_release_file_ok('storage/backups/.htaccess'),
    ];

    $dirs = [
        kareta_release_dir_ok('api'),
        kareta_release_dir_ok('assets'),
        kareta_release_dir_ok('css'),
        kareta_release_dir_ok('css/next'),
        kareta_release_dir_ok('js'),
        kareta_release_dir_ok('js/next'),
        kareta_release_dir_ok('storage', true),
        kareta_release_dir_ok('storage/logs', true),
        kareta_release_dir_ok('storage/backups', true),
        kareta_release_dir_ok('tools'),
    ];

    $missingFiles = array_values(array_filter($files, static fn($item) => !$item['exists'] || !$item['readable']));
    $badDirs = array_values(array_filter($dirs, static fn($item) => !$item['exists'] || !$item['readable'] || $item['writable'] === false));

    $pdo = null;
    $dbOk = false;
    $dbError = null;
    try {
        $pdo = kareta_pdo();
        $dbOk = $pdo instanceof PDO;
    } catch (Throwable $e) {
        $dbError = $e->getMessage();
    }

    $migrationCurrent = 0;
    $migrationExpected = defined('KARETA_DB_VERSION') ? (int)KARETA_DB_VERSION : 0;
    if ($pdo instanceof PDO) {
        try {
            if (kareta_table_exists($pdo, 'db_migrations')) {
                $migrationCurrent = (int)($pdo->query("SELECT COALESCE(MAX(version),0) FROM `db_migrations`")->fetchColumn() ?: 0);
            }
        } catch (Throwable $_e) {}
    }

    $serverChecks = [
        'php' => PHP_VERSION_ID >= 80100,
        'pdoMysql' => kareta_pdo_mysql_driver_available(),
        'database' => $dbOk,
        'migrations' => $migrationExpected <= 0 || $migrationCurrent >= $migrationExpected,
        'files' => empty($missingFiles),
        'directories' => empty($badDirs),
        'assetVersion' => defined('KARETA_ASSET_VERSION') && trim((string)KARETA_ASSET_VERSION) !== '',
        'debugDisabledByDefault' => !kareta_api_debug_enabled(),
    ];

    $ok = !in_array(false, $serverChecks, true);

    kareta_json([
        'ok' => $ok,
        'status' => $ok ? 'release_server_ready' : 'release_server_blocked',
        'checks' => $serverChecks,
        'files' => $files,
        'missingFiles' => $missingFiles,
        'directories' => $dirs,
        'badDirectories' => $badDirs,
        'database' => [
            'ok' => $dbOk,
            'error' => $dbError,
            'migrationCurrent' => $migrationCurrent,
            'migrationExpected' => $migrationExpected,
        ],
        'runtime' => [
            'phpVersion' => PHP_VERSION,
            'assetVersion' => defined('KARETA_ASSET_VERSION') ? KARETA_ASSET_VERSION : '',
            'time' => date(DATE_ATOM),
        ],
    ], $ok ? 200 : 503);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    kareta_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

kareta_release_check();
