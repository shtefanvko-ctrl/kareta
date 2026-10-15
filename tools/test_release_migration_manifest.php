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

$jsonPath = $root . '/api/migration_manifest.json';
$json = is_file($jsonPath) ? json_decode((string)file_get_contents($jsonPath), true) : null;
if (!is_array($json) || (int)($json['targetDbVersion'] ?? 0) !== $version || !is_array($json['migrations'] ?? null)) {
    fwrite(STDERR, "migration JSON mirror shape/version invalid\n");
    exit(1);
}
if (count($json['migrations']) !== $version) {
    fwrite(STDERR, "migration JSON mirror count invalid\n");
    exit(1);
}
foreach ($json['migrations'] as $index => $row) {
    $number = $index + 1;
    $canonical = $files[$number] ?? null;
    if ((int)($row['version'] ?? 0) !== $number
        || (string)($row['file'] ?? '') !== (string)($canonical['file'] ?? '')
        || !hash_equals((string)($canonical['checksum'] ?? ''), strtolower((string)($row['sha256'] ?? '')))) {
        fwrite(STDERR, "migration JSON mirror mismatch at version {$number}\n");
        exit(1);
    }
}
echo "MIGRATION_MANIFEST: OK version={$version} files=" . count($files) . " json_mirror=OK" . PHP_EOL;
