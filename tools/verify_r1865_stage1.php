<?php
declare(strict_types=1);
$root = dirname(__DIR__);
$errors = [];
$required = [
    'api/migrations/072_identity_core_stage1.php',
    'docs/identity/IDENTITY_CONTEXT_ROADMAP.md',
    'docs/identity/STAGE_01_IDENTITY_CORE.md',
    'docs/identity/implementation_status.json',
    'docs/releases/changelog/CHANGELOG_R186_5_STAGE1.md',
];
foreach ($required as $file) if (!is_file($root . '/' . $file)) $errors[] = 'missing:' . $file;
$migration = file_get_contents($root . '/api/migrations/072_identity_core_stage1.php') ?: '';
foreach (['accounts','persons','person_profiles','contexts','context_members','capability_sets','capabilities','auth_sessions','auth_challenges'] as $table) {
    if (!str_contains($migration, 'CREATE TABLE IF NOT EXISTS `' . $table . '`')) $errors[] = 'table:' . $table;
}
$config = file_get_contents($root . '/config.php') ?: '';
if (!preg_match("/define\('KARETA_DB_VERSION',\s*(7[2-9]|[89][0-9]|[1-9][0-9]{2,})\);/", $config)) $errors[] = 'db_version';
$asset = file_get_contents($root . '/inc/asset_version.php') ?: '';
if (!str_contains($asset, '20260803-r1865-stage')) $errors[] = 'asset_version';
$status = json_decode(file_get_contents($root . '/docs/identity/implementation_status.json') ?: '', true);
if (!is_array($status) || (int)($status['currentStage'] ?? 0) < 1) $errors[] = 'status_json';
if ($errors) { fwrite(STDERR, "R186.5 Stage 1 FAIL\n" . implode("\n", $errors) . "\n"); exit(1); }
echo "R186.5 Stage 1 OK\n";
