<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function kareta_version_read_asset_version(): string
{
    $file = dirname(__DIR__) . '/inc/asset_version.php';
    if (!is_file($file)) return '';
    $text = (string)@file_get_contents($file);
    if (preg_match("~KARETA_ASSET_VERSION\s*=\s*['\"]([^'\"]+)['\"]~", $text, $m)) return $m[1];
    return '';
}

function kareta_version_read_sw_release(): string
{
    $file = dirname(__DIR__) . '/sw.js';
    if (!is_file($file)) return '';
    $text = (string)@file_get_contents($file);
    if (preg_match("~const\s+RELEASE\s*=\s*['\"]([^'\"]+)['\"]~", $text, $m)) return $m[1];
    return '';
}

function kareta_version_file_status(string $relative): array
{
    $root = dirname(__DIR__);
    $path = $root . '/' . ltrim($relative, '/');
    $exists = is_file($path);
    $mtime = $exists ? (int)filemtime($path) : 0;
    $size = $exists ? (int)filesize($path) : 0;
    return [
        'file' => $relative,
        'exists' => $exists,
        'readable' => $exists && is_readable($path),
        'size' => $size,
        'mtime' => $mtime,
        'mtimeIso' => $mtime ? date(DATE_ATOM, $mtime) : null,
        'sha1_12' => $exists ? substr(sha1_file($path) ?: '', 0, 12) : '',
    ];
}

function kareta_version_check(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        kareta_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
    }
    if (!kareta_diagnostics_authorized()) kareta_json(['ok'=>false,'error'=>'diagnostics_authorization_required'],403);

    $assetVersion = kareta_version_read_asset_version();
    $swRelease = kareta_version_read_sw_release();
    $swExpected = $assetVersion;

    $files = [
        kareta_version_file_status('index.php'),
        kareta_version_file_status('inc/asset_version.php'),
        kareta_version_file_status('inc/asset_registry.php'),
        kareta_version_file_status('sw.js'),
        kareta_version_file_status('manifest.json'),
        kareta_version_file_status('css/onboarding_bundle.css'),
        kareta_version_file_status('css/next/app_next.css'),
        kareta_version_file_status('css/next/home_simple.css'),
        kareta_version_file_status('css/next/onboarding_kflow_reference.css'),
        kareta_version_file_status('js/next/runtime_dependencies.js'),
        kareta_version_file_status('js/next/api_client.js'),
        kareta_version_file_status('js/next/pages/chats.js'),
        kareta_version_file_status('js/next/app_next.js'),
    ];

    $missing = array_values(array_filter($files, static fn($file) => !$file['exists'] || !$file['readable']));
    $ok = $assetVersion !== '' && $swRelease === $swExpected && count($missing) === 0;

    kareta_json([
        'ok' => $ok,
        'status' => $ok ? 'version_consistent' : 'version_attention_required',
        'assetVersion' => $assetVersion,
        'serviceWorkerRelease' => $swRelease,
        'expectedServiceWorkerRelease' => $swExpected,
        'releaseMatchesAssetVersion' => $swRelease === $swExpected,
        'files' => $files,
        'missing' => $missing,
        'browserCommands' => [
            'await window.KaretaVersionCheck.run()',
            'await window.KaretaCacheReset.reload()',
            'await window.KaretaCacheReset.hard()',
        ],
        'time' => date(DATE_ATOM),
    ], $ok ? 200 : 503);
}

kareta_version_check();
