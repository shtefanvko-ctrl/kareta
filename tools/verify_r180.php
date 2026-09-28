<?php
declare(strict_types=1);
$root = dirname(__DIR__);
$errors = [];
$required = [
  'js/next/platform_search.js',
  'js/next/pages/platform.js',
  'css/next/platform.css',
  'docs/releases/changelog/CHANGELOG_R180.md',
];
foreach ($required as $path) {
  if (!is_file($root . '/' . $path)) $errors[] = "Missing: {$path}";
}
$checks = [
  'docs/releases/changelog/CHANGELOG_R180.md' => '20260728-r180-platform-1',
  'js/next/route_registry.js' => "#/platform",
  'js/next/app_next.js' => 'KaretaPlatformPages',
  'inc/asset_registry.php' => 'js/next/pages/platform.js',
];
foreach ($checks as $path => $needle) {
  $body = @file_get_contents($root . '/' . $path);
  if ($body === false || !str_contains($body, $needle)) $errors[] = "Check failed: {$path} -> {$needle}";
}
if ($errors) {
  fwrite(STDERR, implode(PHP_EOL, $errors) . PHP_EOL);
  exit(1);
}
echo "R180 verification passed." . PHP_EOL;
