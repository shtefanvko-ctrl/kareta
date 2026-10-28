<?php
declare(strict_types=1);
/** Offline source-only gate; never connects to DB or bootstraps KARETA runtime. */
$root = dirname(__DIR__);
foreach (array_slice($argv, 1) as $arg) {
    if (strpos($arg, '--root=') === 0) $root = (string)substr($arg, 7);
    else { fwrite(STDERR, "usage: php tools/check_data_core_migrations.php [--root=/path]\n"); exit(2); }
}
$root = rtrim($root, '/');
$errors = [];
$add = static function (string $code, array $details = []) use (&$errors): void {
    $errors[] = array_merge(['code' => $code], $details);
};
$phpPath = $root . '/api/migration_manifest.php';
$jsonPath = $root . '/api/migration_manifest.json';
$configPath = $root . '/config.php';
$phpManifest = is_file($phpPath) ? require $phpPath : null;
$json = is_file($jsonPath) ? json_decode((string)file_get_contents($jsonPath), true) : null;
$config = is_file($configPath) ? (string)file_get_contents($configPath) : '';
if (!is_array($phpManifest) || !isset($phpManifest['version'], $phpManifest['files']) || !is_array($phpManifest['files'])) $add('PHP_MANIFEST_INVALID');
if (!is_array($json) || !isset($json['targetDbVersion'], $json['migrations']) || !is_array($json['migrations'])) $add('JSON_MANIFEST_INVALID');
if (!preg_match('/define\s*\(\s*[\'\"]KARETA_DB_VERSION[\'\"]\s*,\s*(\d+)\s*\)/', $config, $mm)) $add('CONFIG_VERSION_UNREADABLE');
$declared = isset($mm[1]) ? (int)$mm[1] : null;
$phpVersion = (int)($phpManifest['version'] ?? 0);
$jsonVersion = (int)($json['targetDbVersion'] ?? 0);
if ($declared !== null && ($declared !== $phpVersion || $declared !== $jsonVersion)) {
    $add('VERSION_DRIFT', ['configured' => $declared, 'php' => $phpVersion, 'json' => $jsonVersion]);
}
$phpEntries = is_array($phpManifest['files'] ?? null) ? $phpManifest['files'] : [];
$jsonEntries = is_array($json['migrations'] ?? null) ? $json['migrations'] : [];
if ($phpVersion < 1 || array_keys($phpEntries) !== range(1, max($phpVersion, 1))) $add('PHP_SEQUENCE_INVALID');
if ($jsonVersion < 1 || count($jsonEntries) !== $jsonVersion) $add('JSON_SEQUENCE_INVALID');
$jsonByVersion = [];
foreach ($jsonEntries as $entry) {
    $version = (int)($entry['version'] ?? 0);
    if ($version <= 0 || isset($jsonByVersion[$version])) $add('JSON_DUPLICATE_OR_INVALID_VERSION', ['version' => $version]);
    $jsonByVersion[$version] = $entry;
}
if ($jsonVersion > 0 && array_keys($jsonByVersion) !== range(1, $jsonVersion)) $add('JSON_ORDER_INVALID');
$listedFiles = [];
foreach ($phpEntries as $version => $entry) {
    $name = (string)($entry['file'] ?? '');
    $hash = (string)($entry['checksum'] ?? '');
    if (!preg_match('/^\d{3}_[a-zA-Z0-9_]+\.php$/', $name) || (int)substr($name, 0, 3) !== (int)$version) {
        $add('BAD_MIGRATION_NAME', ['version' => $version]);
        continue;
    }
    if (isset($listedFiles[$name])) $add('PHP_DUPLICATE_FILE', ['file' => $name]);
    $listedFiles[$name] = true;
    $file = $root . '/api/migrations/' . $name;
    if (!is_file($file)) $add('FILE_MISSING', ['version' => $version, 'file' => $name]);
    elseif (!preg_match('/^[a-f0-9]{64}$/', $hash) || !hash_equals($hash, hash_file('sha256', $file))) {
        $add('PHP_FILE_HASH_MISMATCH', ['version' => $version, 'file' => $name]);
    }
    $other = $jsonByVersion[$version] ?? [];
    if ($name !== ($other['file'] ?? null)) $add('JSON_PHP_FILENAME_DRIFT', ['version' => $version]);
    if ($hash !== ($other['sha256'] ?? null)) $add('JSON_PHP_HASH_DRIFT', ['version' => $version, 'file' => $name]);
}
foreach ($jsonByVersion as $version => $other) {
    if (!isset($phpEntries[$version])) $add('JSON_VERSION_NOT_IN_PHP', ['version' => $version]);
}
$disk = glob($root . '/api/migrations/*.php') ?: [];
$diskVersions = [];
foreach ($disk as $file) {
    $name = basename($file);
    if (!preg_match('/^(\d+)_/', $name, $m)) { $add('DISK_BAD_FILENAME', ['file' => $name]); continue; }
    $version = (int)$m[1];
    if (isset($diskVersions[$version])) $add('DISK_DUPLICATE_VERSION', ['version' => $version]);
    $diskVersions[$version] = $name;
    if (!isset($listedFiles[$name])) $add('UNLISTED_MIGRATION', ['version' => $version, 'file' => $name]);
}
if ($diskVersions && count($diskVersions) !== max(array_keys($diskVersions))) $add('DISK_VERSION_GAP');
$result = [
    'status' => $errors ? 'FAIL' : 'PASS',
    'configuredVersion' => $declared,
    'phpManifestVersion' => $phpVersion,
    'jsonManifestVersion' => $jsonVersion,
    'onDiskCount' => count($disk),
    'issues' => $errors,
    'scope' => 'source only; no DB access or migrations executed'
];
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL;
exit($errors ? 1 : 0);
