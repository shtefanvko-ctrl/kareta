<?php
declare(strict_types=1);
$root = dirname(__DIR__);
$errors = [];
$css = $root . '/css/next/community_feed_desktop_grid.css';
$registry = file_get_contents($root . '/inc/asset_registry.php') ?: '';
$version = file_get_contents($root . '/inc/asset_version.php') ?: '';
$sw = file_get_contents($root . '/sw.js') ?: '';
if (!is_file($css)) $errors[] = 'missing community feed desktop grid css';
$content = is_file($css) ? (file_get_contents($css) ?: '') : '';
foreach ([
    '@media (min-width: 901px)',
    'repeat(3, minmax(0, 1fr))',
    '@media (min-width: 1600px)',
    'repeat(4, minmax(0, 1fr))',
    '.k-community-feed',
    '.k-community-skeleton',
] as $needle) {
    if (!str_contains($content, $needle)) $errors[] = 'missing css contract: ' . $needle;
}
if (!str_contains($registry, 'css/next/community_feed_desktop_grid.css')) $errors[] = 'asset registry missing r1885599 css';
if (!str_contains($version, 'r1885599-community-feed-desktop-grid')) $errors[] = 'asset version missing r1885599';
if (!str_contains($sw, 'r1885599-community-feed-desktop-grid')) $errors[] = 'service worker release missing r1885599';
if ($errors) {
    fwrite(STDERR, json_encode(['ok'=>false,'errors'=>$errors], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT) . PHP_EOL);
    exit(1);
}
echo json_encode(['ok'=>true,'release'=>'R188.5.5.6.39'], JSON_UNESCAPED_UNICODE) . PHP_EOL;
