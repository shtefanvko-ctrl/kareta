<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function kareta_release_status_file(string $relative): array
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

function kareta_release_status_dir(string $relative, bool $needWritable = false): array
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

function kareta_release_status_endpoint(string $name, string $file): array
{
    $root = dirname(__DIR__);
    $path = __DIR__ . '/' . $file;
    return [
        'name' => $name,
        'path' => 'api/' . $file,
        'url' => 'api/' . $file,
        'exists' => is_file($path),
        'readable' => is_file($path) && is_readable($path),
    ];
}

function kareta_release_status_check(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        kareta_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
    }
    if (!kareta_diagnostics_authorized()) kareta_json(['ok'=>false,'error'=>'diagnostics_authorization_required'],403);

    $endpoints = [
        kareta_release_status_endpoint('deploy', 'deploy_check.php'),
        kareta_release_status_endpoint('readiness', 'readiness.php'),
        kareta_release_status_endpoint('maintenance', 'maintenance_check.php'),
        kareta_release_status_endpoint('staticQuality', 'static_quality_check.php'),
        kareta_release_status_endpoint('cssQuality', 'css_quality_check.php'),
        kareta_release_status_endpoint('accessibility', 'accessibility_check.php'),
        kareta_release_status_endpoint('release', 'release_check.php'),
        kareta_release_status_endpoint('releaseStatus', 'release_status.php'),
        kareta_release_status_endpoint('versionCheck', 'version_check.php'),
        kareta_release_status_endpoint('postDeploy', 'post_deploy_check.php'),
        kareta_release_status_endpoint('provenance', 'provenance.php'),
        kareta_release_status_endpoint('clientEvent', 'client_event.php'),
    ];

    $files = [
        kareta_release_status_file('index.php'),
        kareta_release_status_file('config.php'),
        kareta_release_status_file('config.private.example.php'),
        kareta_release_status_file('.htaccess'),
        kareta_release_status_file('.gitignore'),
        kareta_release_status_file('manifest.json'),
        kareta_release_status_file('sw.js'),
        kareta_release_status_file('inc/asset_registry.php'),
        kareta_release_status_file('js/next/runtime_dependencies.js'),
        kareta_release_status_file('js/next/api_client.js'),
        kareta_release_status_file('js/next/pages/chats.js'),
        kareta_release_status_file('js/next/app_next.js'),
        kareta_release_status_file('css/next/app_next.css'),
        kareta_release_status_file('css/next/home_simple.css'),
        kareta_release_status_file('css/next/onboarding_kflow_reference.css'),
        kareta_release_status_file('tools/backup_project.php'),
        kareta_release_status_file('tools/cleanup_runtime.php'),
    ];

    $dirs = [
        kareta_release_status_dir('storage', true),
        kareta_release_status_dir('storage/logs', true),
        kareta_release_status_dir('storage/backups', true),
        kareta_release_status_dir('tools'),
    ];

    $endpointOk = !in_array(false, array_map(static fn($item) => $item['exists'] && $item['readable'], $endpoints), true);
    $fileOk = !in_array(false, array_map(static fn($item) => $item['exists'] && $item['readable'], $files), true);
    $dirOk = !in_array(false, array_map(static fn($item) => $item['exists'] && $item['readable'] && $item['writable'] !== false, $dirs), true);

    $ok = $endpointOk && $fileOk && $dirOk;

    kareta_json([
        'ok' => $ok,
        'status' => $ok ? 'release_dashboard_ready' : 'release_dashboard_attention_required',
        'assetVersion' => defined('KARETA_ASSET_VERSION') ? KARETA_ASSET_VERSION : (defined('APP_VER') ? APP_VER : ''),
        'endpoints' => $endpoints,
        'files' => $files,
        'directories' => $dirs,
        'manualChecks' => [
            'api/deploy_check.php',
            'api/readiness.php',
            'api/maintenance_check.php',
            'api/static_quality_check.php',
            'api/css_quality_check.php',
            'api/accessibility_check.php',
            'api/release_check.php',
            'api/version_check.php',
            'api/post_deploy_check.php',
            'api/provenance.php',
            'window.KaretaGridContracts.audit()',
            'window.KaretaBlockGridContracts.audit()',
            'window.KaretaServicesQuick.audit()',
            'window.KaretaLayoutSanity.audit()',
            'window.KaretaButtonOverlap.audit()',
            'window.KaretaNext.audit()',
            'await window.KaretaPostDeploy.run()',
            'await window.KaretaVersionCheck.run()',
            'await window.KaretaReleaseAcceptance.run()',
        ],
        'runtimeDashboard' => [
            'open' => 'window.KaretaReleaseDashboard.open()',
            'refresh' => 'window.KaretaReleaseDashboard.refresh()',
            'close' => 'window.KaretaReleaseDashboard.close()',
        ],
        'time' => date(DATE_ATOM),
    ], $ok ? 200 : 503);
}

kareta_release_status_check();
