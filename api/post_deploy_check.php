<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function kareta_post_deploy_asset_version(): string
{
    $file = dirname(__DIR__) . '/inc/asset_version.php';
    if (!is_file($file)) return '';
    $text = (string)@file_get_contents($file);
    if (preg_match("~KARETA_ASSET_VERSION\s*=\s*['\"]([^'\"]+)['\"]~", $text, $m)) return $m[1];
    return '';
}

function kareta_post_deploy_sw_release(): string
{
    $file = dirname(__DIR__) . '/sw.js';
    if (!is_file($file)) return '';
    $text = (string)@file_get_contents($file);
    if (preg_match("~const\s+RELEASE\s*=\s*['\"]([^'\"]+)['\"]~", $text, $m)) return $m[1];
    return '';
}

function kareta_post_deploy_file(string $relative, bool $required = true): array
{
    $root = dirname(__DIR__);
    $path = $root . '/' . ltrim($relative, '/');
    $exists = is_file($path);
    $mtime = $exists ? (int)filemtime($path) : 0;
    return [
        'file' => $relative,
        'required' => $required,
        'ok' => (!$required && !$exists) || ($exists && is_readable($path)),
        'exists' => $exists,
        'readable' => $exists && is_readable($path),
        'size' => $exists ? (int)filesize($path) : 0,
        'mtime' => $mtime,
        'mtimeIso' => $mtime ? date(DATE_ATOM, $mtime) : null,
        'sha1_12' => $exists ? substr(sha1_file($path) ?: '', 0, 12) : '',
    ];
}

function kareta_post_deploy_dir(string $relative, bool $needWritable = false): array
{
    $root = dirname(__DIR__);
    $path = $root . '/' . trim($relative, '/');
    $exists = is_dir($path);
    return [
        'dir' => $relative,
        'ok' => $exists && is_readable($path) && (!$needWritable || is_writable($path)),
        'exists' => $exists,
        'readable' => $exists && is_readable($path),
        'writable' => $exists && is_writable($path),
        'requiredWritable' => $needWritable,
    ];
}

function kareta_post_deploy_check(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        kareta_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
    }
    if (!kareta_diagnostics_authorized()) kareta_json(['ok'=>false,'error'=>'diagnostics_authorization_required'],403);

    $assetVersion = kareta_post_deploy_asset_version();
    $swRelease = kareta_post_deploy_sw_release();
    $expectedSwRelease = $assetVersion;

    $files = [
        kareta_post_deploy_file('index.php'),
        kareta_post_deploy_file('.htaccess'),
        kareta_post_deploy_file('manifest.json'),
        kareta_post_deploy_file('inc/asset_version.php'),
        kareta_post_deploy_file('inc/asset_registry.php'),
        kareta_post_deploy_file('sw.js'),
        kareta_post_deploy_file('config.php'),
        kareta_post_deploy_file('config.private.example.php'),
        kareta_post_deploy_file('css/onboarding_bundle.css'),
        kareta_post_deploy_file('css/next/app_next.css'),
        kareta_post_deploy_file('css/next/home_simple.css'),
        kareta_post_deploy_file('css/next/onboarding_kflow_reference.css'),
        kareta_post_deploy_file('js/next/runtime_dependencies.js'),
        kareta_post_deploy_file('js/next/api_client.js'),
        kareta_post_deploy_file('js/next/pages/chats.js'),
        kareta_post_deploy_file('js/next/app_next.js'),
        kareta_post_deploy_file('api/readiness.php'),
        kareta_post_deploy_file('api/deploy_check.php'),
        kareta_post_deploy_file('api/release_check.php'),
        kareta_post_deploy_file('api/release_status.php'),
        kareta_post_deploy_file('api/version_check.php'),
        kareta_post_deploy_file('api/post_deploy_check.php'),
        kareta_post_deploy_file('api/static_quality_check.php'),
        kareta_post_deploy_file('api/css_quality_check.php'),
        kareta_post_deploy_file('api/accessibility_check.php'),
    ];

    $dirs = [
        kareta_post_deploy_dir('api'),
        kareta_post_deploy_dir('css'),
        kareta_post_deploy_dir('css/next'),
        kareta_post_deploy_dir('js'),
        kareta_post_deploy_dir('js/next'),
        kareta_post_deploy_dir('storage', true),
        kareta_post_deploy_dir('storage/logs', true),
        kareta_post_deploy_dir('storage/backups', true),
    ];

    $missingFiles = array_values(array_filter($files, static fn($item) => !$item['ok']));
    $badDirs = array_values(array_filter($dirs, static fn($item) => !$item['ok']));

    $missingDatabaseConfig = function_exists('kareta_db_missing_config_fields') ? kareta_db_missing_config_fields() : ['database','username','password'];
    $checks = [
        'assetVersionPresent' => $assetVersion !== '',
        'swReleasePresent' => $swRelease !== '',
        'swMatchesAssetVersion' => $expectedSwRelease !== '' && $swRelease === $expectedSwRelease,
        'requiredFiles' => count($missingFiles) === 0,
        'requiredDirs' => count($badDirs) === 0,
        'databaseConfigurationPresent' => $missingDatabaseConfig === [],
    ];

    $ok = !in_array(false, $checks, true);

    kareta_json([
        'ok' => $ok,
        'status' => $ok ? 'post_deploy_ready' : 'post_deploy_attention_required',
        'checks' => $checks,
        'assetVersion' => $assetVersion,
        'serviceWorkerRelease' => $swRelease,
        'expectedServiceWorkerRelease' => $expectedSwRelease,
        'files' => $files,
        'dirs' => $dirs,
        'databaseConfiguration' => [
            'source' => defined('KARETA_DB_CONFIG_SOURCE') ? KARETA_DB_CONFIG_SOURCE : 'unknown',
            'configured' => $missingDatabaseConfig === [],
            'missingFields' => $missingDatabaseConfig,
        ],
        'problems' => [
            'files' => $missingFiles,
            'dirs' => $badDirs,
            'databaseConfiguration' => $missingDatabaseConfig,
        ],
        'followUp' => [
            'server' => [
                'api/version_check.php',
                'api/readiness.php',
                'api/release_check.php',
                'api/release_status.php',
                'api/static_quality_check.php',
                'api/css_quality_check.php',
                'api/accessibility_check.php',
            ],
            'browser' => [
                'window.KaretaNext.audit()',
                'await window.KaretaPostDeploy.run()',
                'await window.KaretaVersionCheck.run()',
                'await window.KaretaCacheReset.reload()',
                'await window.KaretaReleaseAcceptance.run()',
            ],
        ],
        'time' => date(DATE_ATOM),
    ], $ok ? 200 : 503);
}

kareta_post_deploy_check();
