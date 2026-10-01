<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function kareta_file_exists_status(string $label, string $path): array
{
    return [
        'label' => $label,
        'exists' => is_file($path),
        'readable' => is_file($path) && is_readable($path),
    ];
}

function kareta_deploy_check(): void
{
    if (!kareta_diagnostics_authorized()) kareta_json(['ok'=>false,'error'=>'diagnostics_authorization_required'],403);
    $root = dirname(__DIR__);
    $files = [
        kareta_file_exists_status('index.php', $root . '/index.php'),
        kareta_file_exists_status('private_config_example', $root . '/config.private.example.php'),
        kareta_file_exists_status('manifest.json', $root . '/manifest.json'),
        kareta_file_exists_status('service_worker', $root . '/sw.js'),
        kareta_file_exists_status('asset_registry', $root . '/inc/asset_registry.php'),
        kareta_file_exists_status('runtime_dependencies', $root . '/js/next/runtime_dependencies.js'),
        kareta_file_exists_status('api_client', $root . '/js/next/api_client.js'),
        kareta_file_exists_status('chats_page', $root . '/js/next/pages/chats.js'),
        kareta_file_exists_status('app_next', $root . '/js/next/app_next.js'),
        kareta_file_exists_status('app_next_css', $root . '/css/next/app_next.css'),
        kareta_file_exists_status('home_css', $root . '/css/next/home_simple.css'),
        kareta_file_exists_status('onboarding_css', $root . '/css/next/onboarding_kflow_reference.css'),
        kareta_file_exists_status('htaccess', $root . '/.htaccess'),
        kareta_file_exists_status('gitignore', $root . '/.gitignore'),
        kareta_file_exists_status('client_event', $root . '/api/client_event.php'),
        kareta_file_exists_status('maintenance_check', $root . '/api/maintenance_check.php'),
        kareta_file_exists_status('static_quality_check', $root . '/api/static_quality_check.php'),
        kareta_file_exists_status('css_quality_check', $root . '/api/css_quality_check.php'),
        kareta_file_exists_status('release_status', $root . '/api/release_status.php'),
        kareta_file_exists_status('version_check', $root . '/api/version_check.php'),
        kareta_file_exists_status('post_deploy_check', $root . '/api/post_deploy_check.php'),
        kareta_file_exists_status('provenance', $root . '/api/provenance.php'),
        kareta_file_exists_status('accessibility_check', $root . '/api/accessibility_check.php'),
        kareta_file_exists_status('storage_htaccess', $root . '/storage/.htaccess'),
        kareta_file_exists_status('backup_project', $root . '/tools/backup_project.php'),
        kareta_file_exists_status('cleanup_runtime', $root . '/tools/cleanup_runtime.php'),
        kareta_file_exists_status('tools_htaccess', $root . '/tools/.htaccess'),
        kareta_file_exists_status('backups_htaccess', $root . '/storage/backups/.htaccess'),
    ];

    $missing = array_values(array_filter($files, static fn($item) => empty($item['exists']) || empty($item['readable'])));

    $directories = [
        'api' => is_dir($root . '/api'),
        'assets' => is_dir($root . '/assets'),
        'css' => is_dir($root . '/css'),
        'js' => is_dir($root . '/js'),
        'storage' => is_dir($root . '/storage'),
        'logs' => is_dir($root . '/storage/logs'),
    ];

    $ok = empty($missing) && !in_array(false, $directories, true);

    kareta_json([
        'ok' => $ok,
        'status' => $ok ? 'deploy_files_ready' : 'deploy_files_missing',
        'files' => $files,
        'missing' => $missing,
        'directories' => $directories,
        'assetVersion' => defined('KARETA_ASSET_VERSION') ? KARETA_ASSET_VERSION : (defined('APP_VER') ? APP_VER : ''),
        'time' => date(DATE_ATOM),
    ], $ok ? 200 : 503);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    kareta_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

kareta_deploy_check();
