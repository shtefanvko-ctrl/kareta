<?php
declare(strict_types=1);
$root = dirname(__DIR__);
$errors = [];
$required = [
    'api/migrations/073_identity_context_engine.php',
    'api/identity/context_service.php',
    'api/context.php',
    'docs/identity/STAGE_02_CONTEXT_ENGINE.md',
    'docs/releases/changelog/CHANGELOG_R186_5_STAGE2.md',
];
foreach ($required as $file) if (!is_file($root . '/' . $file)) $errors[] = 'missing:' . $file;
$config = file_get_contents($root . '/config.php') ?: '';
$asset = file_get_contents($root . '/inc/asset_version.php') ?: '';
$service = file_get_contents($root . '/api/identity/context_service.php') ?: '';
$endpoint = file_get_contents($root . '/api/context.php') ?: '';
$roadmap = file_get_contents($root . '/docs/identity/IDENTITY_CONTEXT_ROADMAP.md') ?: '';
if (!preg_match("/define\('KARETA_DB_VERSION',\s*(7[3-9]|[89][0-9]|[1-9][0-9]{2,})\);/", $config)) $errors[] = 'db_version';
if (!str_contains($asset, 'r1865-stage')) $errors[] = 'asset_version';
foreach (['listContexts','currentContext','selectContext','current_context_id','context_switch_audit'] as $needle) if (!str_contains($service, $needle)) $errors[]='service:' . $needle;
foreach (["\$action === 'list'","\$action === 'current'","\$action === 'select'"] as $needle) if (!str_contains($endpoint, $needle)) $errors[]='endpoint:' . $needle;
if (!str_contains($roadmap, 'Этап 2 — Context Engine — IMPLEMENTED')) $errors[]='roadmap';
echo json_encode(['ok'=>!$errors,'errors'=>$errors],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT) . PHP_EOL;
exit($errors ? 1 : 0);
