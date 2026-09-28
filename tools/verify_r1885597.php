<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { exit(1); }
$root = dirname(__DIR__);
$fail = [];
$read = static fn(string $f): string => is_file($f) ? (string)file_get_contents($f) : '';
$app = $read($root.'/css/next/app_next.css');
$wide = $read($root.'/css/next/desktop_full_width.css');
$registry = $read($root.'/inc/asset_registry.php');
$version = $read($root.'/inc/asset_version.php');
$sw = $read($root.'/sw.js');
if (!str_contains($app, '--k-page-max:2400px;')) $fail[]='app_next page max';
foreach (['#k-page-outlet','> .k-page','.k-home-simple','.k-client-cabinet','.k-profile-page','.k-calendar-booking','.k-sto-workplace-page','@media (min-width: 901px)'] as $s) {
  if (!str_contains($wide,$s)) $fail[]='wide selector '.$s;
}
if (!str_contains($wide,'--k-page-max: 2400px')) $fail[]='wide variable';
if (!str_contains($registry,"css/next/desktop_full_width.css")) $fail[]='asset registration';
if (!str_contains($version,'r1885597-desktop-full-width-pages')) $fail[]='asset version';
if (!str_contains($sw,'r1885597-desktop-full-width-pages')) $fail[]='sw version';
if ($fail) { fwrite(STDERR,'R1885597 FAIL: '.implode(', ',$fail).PHP_EOL); exit(1); }
echo "R1885597 desktop full-width contract OK\n";
