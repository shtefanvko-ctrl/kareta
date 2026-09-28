<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$manifestPath = $root . '/api/migration_manifest.php';
if (!is_file($manifestPath)) {
    fwrite(STDERR, "migration manifest missing\n");
    exit(1);
}
$manifest = require $manifestPath;
$version = (int)($manifest['version'] ?? 0);
$files = $manifest['files'] ?? null;
if ($version < 1 || !is_array($files) || count($files) !== $version) {
    fwrite(STDERR, "migration manifest shape invalid\n");
    exit(1);
}
if (array_keys($files) !== range(1, $version)) {
    fwrite(STDERR, "migration manifest sequence invalid\n");
    exit(1);
}
foreach ($files as $number => $meta) {
    $name = (string)($meta['file'] ?? '');
    $checksum = (string)($meta['checksum'] ?? '');
    $path = $root . '/api/migrations/' . $name;
    if ($name === '' || $checksum === '' || !is_file($path)) {
        fwrite(STDERR, "migration {$number} missing: {$name}\n");
        exit(1);
    }
    if (!hash_equals($checksum, hash_file('sha256', $path))) {
        fwrite(STDERR, "migration {$number} checksum mismatch: {$name}\n");
        exit(1);
    }
}
echo "MIGRATION_MANIFEST: OK version={$version} files=" . count($files) . PHP_EOL;
