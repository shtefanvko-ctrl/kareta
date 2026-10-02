<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$root = dirname(__DIR__);
$allowUnconfigured = in_array('--allow-unconfigured', $argv ?? [], true);
$checks = [];
$add = static function(string $id, bool $ok, string $detail='') use (&$checks): void {
    $checks[] = ['id'=>$id,'ok'=>$ok,'detail'=>$detail];
};

$add('php_version_8_1', PHP_VERSION_ID >= 80100, PHP_VERSION);
foreach (['json','session','hash','filter','pdo'] as $ext) {
    $add('ext_' . $ext, extension_loaded($ext), extension_loaded($ext) ? 'loaded' : 'missing');
}
$pdoMysql = class_exists('PDO') && in_array('mysql', PDO::getAvailableDrivers(), true);
$add('pdo_mysql', $pdoMysql, implode(',', class_exists('PDO') ? PDO::getAvailableDrivers() : []));

foreach ([
    '.htaccess','index.php','config.php','manifest.json','sw.js','asset_manifest.php',
    'api/bootstrap.php','api/provenance.php','inc/asset_version.php',
    'storage/deployment_manifest.json'
] as $rel) {
    $add('file_' . str_replace(['/', '.'], '_', $rel), is_file($root . '/' . $rel), $rel);
}

require_once $root . '/config.php';
require_once $root . '/inc/deployment_provenance.php';

$add('private_config_loaded', $allowUnconfigured || (defined('KARETA_PRIVATE_CONFIG_LOADED') && KARETA_PRIVATE_CONFIG_LOADED),
    defined('KARETA_PRIVATE_CONFIG_SOURCE') ? (string)KARETA_PRIVATE_CONFIG_SOURCE : 'none');
$add('db_configured', $allowUnconfigured || (defined('KARETA_DB_CONFIGURED') && KARETA_DB_CONFIGURED),
    defined('KARETA_DB_CONFIG_SOURCE') ? (string)KARETA_DB_CONFIG_SOURCE : 'none');

$storage = defined('KARETA_STORAGE_ROOT') ? KARETA_STORAGE_ROOT : ($root . '/storage');
if (!is_dir($storage)) @mkdir($storage, 0775, true);
$add('storage_writable', is_dir($storage) && is_writable($storage), $storage);

$add('db_auto_create_off', !defined('KARETA_DB_AUTO_CREATE') || KARETA_DB_AUTO_CREATE === false);
$add('db_auto_migrate_off', !defined('KARETA_DB_AUTO_MIGRATE') || KARETA_DB_AUTO_MIGRATE === false);

$environment = defined('KARETA_ENVIRONMENT') ? KARETA_ENVIRONMENT : 'unknown';
$temporaryStatic = defined('KARETA_OTP') ? (bool)(KARETA_OTP['temporary_static'] ?? false) : false;
$add('production_static_otp_off', $environment !== 'production' || !$temporaryStatic,
    'environment=' . $environment . '; temporary_static=' . ($temporaryStatic ? '1' : '0'));

$asset = defined('KARETA_ASSET_VERSION') ? KARETA_ASSET_VERSION : '';
$prov = kareta_provenance_read($root . '/storage/deployment_manifest.json', (string)$asset);
$add('deployment_provenance', (bool)($prov['ok'] ?? false),
    ($prov['status'] ?? 'unknown') . '; sha=' . (string)($prov['manifest']['gitSha'] ?? ''));

$failed = array_values(array_filter($checks, static fn(array $c): bool => !$c['ok']));
foreach ($checks as $check) {
    echo ($check['ok'] ? '[PASS] ' : '[FAIL] ') . $check['id'];
    if ($check['detail'] !== '') echo ' — ' . $check['detail'];
    echo PHP_EOL;
}
echo 'SERVER_PREFLIGHT: ' . ($failed ? 'FAIL' : 'PASS') . PHP_EOL;
exit($failed ? 1 : 0);
