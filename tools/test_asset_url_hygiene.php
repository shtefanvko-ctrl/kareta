<?php
declare(strict_types=1);

$root = dirname(__DIR__);
require_once $root . '/inc/asset_version.php';
require_once $root . '/inc/asset_registry.php';

$errors = [];
$token = kareta_asset_cache_token();
if (strlen($token) > 32) {
    $errors[] = 'asset cache token is longer than 32 chars';
}
if (preg_match('/^[A-Za-z0-9._-]+$/', $token) !== 1) {
    $errors[] = 'asset cache token contains unsafe URL chars';
}

$registry = kareta_asset_registry();
foreach (['styles','scripts','images'] as $bucket) {
    foreach (($registry[$bucket] ?? []) as $path) {
        $base = basename((string)$path);
        if (preg_match('/^r\d+(?:[_\-.]|$)/i', $base) === 1) {
            $errors[] = "versioned public asset filename: {$path}";
        }
        $url = asset_ver((string)$path);
        if (strlen($url) > 180) {
            $errors[] = "excessive public asset URL: {$url}";
        }
    }
}

$sw = (string)file_get_contents($root . '/sw.js');
$swRelease = '';
if (preg_match("/const\\s+RELEASE\\s*=\\s*'([^']+)'/", $sw, $m) !== 1 || strlen((string)($m[1] ?? '')) > 32) {
    $errors[] = 'service worker RELEASE must be a short current token';
} else {
    $swRelease = (string)$m[1];
    if (!hash_equals($token, $swRelease)) {
        $errors[] = "service worker RELEASE mismatch: asset={$token}, sw={$swRelease}";
    }
}
$realtime = (string)file_get_contents($root . '/js/next/core/realtime_client.js');
if (strpos($realtime, "window.KARETA_NEXT_ASSET_VERSION") === false) {
    $errors[] = 'realtime runtime must reuse the current global release token';
}

if ($errors) {
    fwrite(STDERR, "ASSET URL HYGIENE FAIL\n - " . implode("\n - ", $errors) . "\n");
    exit(1);
}

echo json_encode([
    'ok' => true,
    'assetVersion' => KARETA_ASSET_VERSION,
    'cacheToken' => $token,
    'styles' => count($registry['styles'] ?? []),
    'scripts' => count($registry['scripts'] ?? []),
    'maxUrlLength' => max(array_map('strlen', array_merge(
        array_map('asset_ver', $registry['styles'] ?? []),
        array_map('asset_ver', $registry['scripts'] ?? []),
        array_map('asset_ver', $registry['images'] ?? [])
    ))),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
