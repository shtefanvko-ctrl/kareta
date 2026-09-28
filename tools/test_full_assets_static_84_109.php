<?php
declare(strict_types=1);

$root = dirname(__DIR__);
require_once $root . '/inc/asset_registry.php';
require_once $root . '/inc/asset_version.php';

$expectedRelease = '188.5.5.6.84.109';
if (!defined('KARETA_ASSET_VERSION') || KARETA_ASSET_VERSION !== $expectedRelease) {
    fwrite(STDERR, "release mismatch\n");
    exit(1);
}

$registry = kareta_asset_registry();
$images = $registry['images'] ?? [];
if (!is_array($images) || count($images) !== 23) {
    fwrite(STDERR, "registry image count mismatch: " . count((array)$images) . "\n");
    exit(1);
}

$groups = ['logos'=>0, 'welcome'=>0, 'errors'=>0, 'media'=>0];
$fail = [];
foreach ($images as $relative) {
    $relative = str_replace('\\', '/', (string)$relative);
    $path = $root . '/' . $relative;
    if (!is_file($path)) {
        $fail[] = "missing {$relative}";
        continue;
    }
    $size = filesize($path);
    if ($size === false || $size <= 0) $fail[] = "empty {$relative}";
    $fh = fopen($path, 'rb');
    $sig = $fh ? fread($fh, 8) : false;
    if (is_resource($fh)) fclose($fh);
    if ($sig !== "\x89PNG\r\n\x1a\n") $fail[] = "bad_png_signature {$relative}";
    $mime = function_exists('mime_content_type') ? mime_content_type($path) : '';
    if ($mime !== 'image/png') $fail[] = "bad_mime {$relative}={$mime}";
    if (str_contains($relative, 'kareta_logo_')) $groups['logos']++;
    elseif (str_contains($relative, '/backgrounds/welcome/')) $groups['welcome']++;
    elseif (str_contains($relative, '/errors/403/')) $groups['errors']++;
    elseif (str_starts_with($relative, 'media/')) $groups['media']++;
}
$expectedGroups = ['logos'=>2, 'welcome'=>12, 'errors'=>8, 'media'=>1];
if ($groups !== $expectedGroups) {
    $fail[] = 'group counts=' . json_encode($groups, JSON_UNESCAPED_SLASHES);
}

$manifests = [
    'assets/onboarding/backgrounds/welcome/manifest.json',
    'assets/errors/403/manifest.json',
];
foreach ($manifests as $relative) {
    $path = $root . '/' . $relative;
    if (!is_file($path)) {
        $fail[] = "manifest missing {$relative}";
        continue;
    }
    $json = json_decode((string)file_get_contents($path), true);
    if (!is_array($json)) $fail[] = "manifest invalid_json {$relative}";
}

if ($fail) {
    echo "FULL_ASSET_STATIC_84_109: FAIL\n";
    foreach ($fail as $line) echo "ERROR: {$line}\n";
    exit(1);
}
echo "FULL_ASSET_STATIC_84_109: PASS\n";
echo "release={$expectedRelease}\n";
echo "registry_images=" . count($images) . "\n";
echo "logos={$groups['logos']} welcome={$groups['welcome']} errors={$groups['errors']} media={$groups['media']}\n";
