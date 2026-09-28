<?php
declare(strict_types=1);
$root = dirname(__DIR__);
$errors = [];
$cssPath = $root . '/css/next/desktop_card_grid_expansion.css';
$css = is_file($cssPath) ? (file_get_contents($cssPath) ?: '') : '';
$registry = file_get_contents($root . '/inc/asset_registry.php') ?: '';
$version = file_get_contents($root . '/inc/asset_version.php') ?: '';
$sw = file_get_contents($root . '/sw.js') ?: '';
if (!is_file($cssPath)) $errors[] = 'missing r1885600 desktop card grid css';
foreach ([
    '.k-client-cabinet-grid',
    '.k-staff-cabinet-grid',
    '.k-provider-grid',
    '.k-work-feed-grid',
    '.k-market-products',
    '@media (min-width: 1800px)',
    '@media (min-width: 1900px)',
    '@media (min-width: 2000px)',
    'repeat(4, minmax(0, 1fr))',
] as $needle) {
    if (!str_contains($css, $needle)) $errors[] = 'missing desktop grid contract: ' . $needle;
}
foreach (['.k-request-grid','.k-lifecycle-check-grid','.k-op-fin-grid','.k-workflow-board'] as $forbidden) {
    if (str_contains($css, $forbidden)) $errors[] = 'dense operational surface must not be changed: ' . $forbidden;
}
if (!str_contains($registry, 'css/next/desktop_card_grid_expansion.css')) $errors[] = 'asset registry missing r1885600 css';
if (!str_contains($version, 'r1885600-desktop-card-grid-expansion')) $errors[] = 'asset version missing r1885600';
if (!str_contains($sw, 'r1885600-desktop-card-grid-expansion')) $errors[] = 'service worker release missing r1885600';
if ($errors) {
    fwrite(STDERR, json_encode(['ok'=>false,'errors'=>$errors], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT) . PHP_EOL);
    exit(1);
}
echo json_encode(['ok'=>true,'release'=>'R188.5.5.6.40'], JSON_UNESCAPED_UNICODE) . PHP_EOL;
