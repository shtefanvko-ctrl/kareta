<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/asset_registry.php';
require_once dirname(__DIR__) . '/inc/asset_version.php';

$missing = kareta_asset_missing();
if ($missing !== []) {
    fwrite(STDERR, "Missing KARETA assets:\n - " . implode("\n - ", $missing) . "\n");
    exit(1);
}

$registry = kareta_asset_registry();
printf(
    "Asset registry OK: %d CSS, %d JS, %d images. Release: %s\n",
    count($registry['styles']),
    count($registry['scripts']),
    count($registry['images']),
    KARETA_ASSET_VERSION
);
