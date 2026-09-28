<?php
declare(strict_types=1);
$root = dirname(__DIR__);
$css = file_get_contents($root . '/css/next/client_cabinet.css');
$js = file_get_contents($root . '/js/next/pages/cabinet.js');
$version = file_get_contents($root . '/inc/asset_version.php');
$checks = [
  'release' => str_contains($version, '20260727-work-contexts-r176-guestfix4'),
  'overflow hardening' => str_contains($css, 'overflow-x:clip'),
  'social action cards' => str_contains($css, '.k-client-card-arrow'),
  'responsive one column' => str_contains($css, '.k-client-cabinet-grid{grid-template-columns:1fr}'),
  'profile stats markup' => str_contains($js, 'k-social-profile-stats'),
  'profile bio markup' => str_contains($js, 'k-social-profile-bio'),
];
foreach ($checks as $name => $ok) { echo ($ok ? '[OK] ' : '[FAIL] ') . $name . PHP_EOL; if (!$ok) exit(1); }
