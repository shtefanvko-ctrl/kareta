<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

$args = $argv;
array_shift($args);
$root = '';
$expectedSha = '';
foreach ($args as $arg) {
    if (str_starts_with($arg, '--root=')) $root = substr($arg, 7);
    if (str_starts_with($arg, '--expected-sha=')) $expectedSha = strtolower(substr($arg, 15));
}
$root = rtrim($root, "/\\");
if ($root === '' || !is_dir($root)) { fwrite(STDERR, "missing --root\n"); exit(2); }
if ($expectedSha !== '' && preg_match('/^[a-f0-9]{40}$/', $expectedSha) !== 1) {
    fwrite(STDERR, "invalid expected sha\n"); exit(3);
}

$errors = [];
$required = [
    '.htaccess',
    'index.php',
    'config.php',
    'config.private.example.php',
    'config.server-test.example.php',
    'manifest.json',
    'sw.js',
    'asset_manifest.php',
    'api/bootstrap.php',
    'api/provenance.php',
    'api/migration_manifest.php',
    'api/migration_manifest.json',
    'inc/asset_version.php',
    'inc/deployment_provenance.php',
    'storage/.htaccess',
    'storage/uploads/.htaccess',
    'storage/deployment_manifest.json',
    'tools/server_preflight.php',
    'tools/verify_runtime.php',
    '_SERVER_UPLOAD_README.md',
    '_SERVER_PACKAGE_MANIFEST.json',
];
foreach ($required as $rel) if (!is_file($root . '/' . $rel)) $errors[] = 'missing:' . $rel;

$forbidden = [
    '.git',
    '.github',
    'harness',
    'ai',
    'config.private.php',
    '.env',
    'node_modules',
    'storage/logs',
    'storage/backups',
    'storage/runtime',
];
foreach ($forbidden as $rel) if (file_exists($root . '/' . $rel)) $errors[] = 'forbidden:' . $rel;

$manifestPath = $root . '/_SERVER_PACKAGE_MANIFEST.json';
$manifest = is_file($manifestPath) ? json_decode((string)file_get_contents($manifestPath), true) : null;
if (!is_array($manifest) || ($manifest['schema'] ?? '') !== 'kareta.server-package.v1') {
    $errors[] = 'package_manifest_invalid';
} else {
    if (($manifest['privateConfigIncluded'] ?? true) !== false) $errors[] = 'private_config_manifest_flag';
    if ($expectedSha !== '' && strtolower((string)($manifest['sourceSha'] ?? '')) !== $expectedSha) {
        $errors[] = 'package_sha_mismatch';
    }
    foreach (($manifest['checksums'] ?? []) as $rel => $expected) {
        $path = $root . '/' . $rel;
        if (!is_file($path)) { $errors[] = 'checksum_missing:' . $rel; continue; }
        $actual = hash_file('sha256', $path);
        if (!hash_equals((string)$expected, (string)$actual)) $errors[] = 'checksum_mismatch:' . $rel;
    }
}

require_once $root . '/inc/asset_version.php';
require_once $root . '/inc/deployment_provenance.php';
$release = defined('KARETA_ASSET_VERSION') ? KARETA_ASSET_VERSION : '';
$prov = kareta_provenance_read($root . '/storage/deployment_manifest.json', (string)$release);
if (!($prov['ok'] ?? false)) $errors[] = 'deployment_provenance:' . implode(',', $prov['errors'] ?? []);
elseif ($expectedSha !== '' && strtolower((string)($prov['manifest']['gitSha'] ?? '')) !== $expectedSha) {
    $errors[] = 'deployment_provenance_sha_mismatch';
}

$sw = (string)@file_get_contents($root . '/sw.js');
if (!preg_match('/const\s+RELEASE\s*=\s*[\'\"]([^\'\"]+)/', $sw, $m) || ($m[1] ?? '') !== $release) {
    $errors[] = 'service_worker_release_mismatch';
}

$prodExample = (string)@file_get_contents($root . '/config.private.example.php');
if (strpos($prodExample, "'otp_temp_static_enabled' => false") === false) {
    $errors[] = 'production_example_static_otp_not_fail_closed';
}
$testExample = (string)@file_get_contents($root . '/config.server-test.example.php');
foreach ([
    "'environment' => 'staging'",
    "'otp_transport' => 'test_static'",
    "'otp_test_code' => '0000'",
    "'otp_temp_static_enabled' => false",
    "'db_auto_migrate' => false",
] as $needle) {
    if (strpos($testExample, $needle) === false) $errors[] = 'server_test_template:' . $needle;
}

$phpFiles = [];
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
foreach ($it as $file) {
    if ($file->isFile() && strtolower($file->getExtension()) === 'php') $phpFiles[] = $file->getPathname();
}
sort($phpFiles);
foreach ($phpFiles as $file) {
    $out = []; $code = 0;
    exec(escapeshellarg(PHP_BINARY) . ' -l ' . escapeshellarg($file) . ' 2>&1', $out, $code);
    if ($code !== 0) { $errors[] = 'php_lint:' . substr($file, strlen($root)+1); break; }
}

echo json_encode([
    'ok' => $errors === [],
    'release' => $release,
    'expectedSha' => $expectedSha,
    'phpFiles' => count($phpFiles),
    'errors' => $errors,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . PHP_EOL;
exit($errors === [] ? 0 : 1);
