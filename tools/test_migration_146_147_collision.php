<?php
declare(strict_types=1);
// Offline regression: preserve both distinct migration operations and their canonical hashes.
$root = dirname(__DIR__);
$manifest = require $root . '/api/migration_manifest.php';
$json = json_decode((string) file_get_contents($root . '/api/migration_manifest.json'), true, 512, JSON_THROW_ON_ERROR);
$expected = [146 => ['146_parts_request_offers_readiness.php', 'parts_request_offers'], 147 => ['147_order_workflow_updated_at.php', 'updated_at']];
foreach ($expected as $number => [$filename, $operation]) {
    $row = $manifest['files'][$number] ?? null;
    $mirror = $json['migrations'][$number - 1] ?? null;
    $file = $root . '/api/migrations/' . $filename;
    $hash = is_file($file) ? hash_file('sha256', $file) : false;
    $source = is_file($file) ? file_get_contents($file) : false;
    $migration = is_file($file) ? require $file : null;
    if (!is_array($row) || !is_array($mirror) || !is_array($migration)
        || ($row['file'] ?? null) !== $filename
        || ($row['checksum'] ?? null) !== $hash
        || ($mirror['file'] ?? null) !== $filename
        || ($mirror['version'] ?? null) !== $number
        || ($mirror['sha256'] ?? null) !== $hash
        || ($migration['version'] ?? null) !== $number
        || !is_callable($migration['run'] ?? null)
        || !is_string($source) || !str_contains($source, $operation)) {
        fwrite(STDERR, "FAIL migration {$number} provenance/operation contract\n");
        exit(1);
    }
}
if (($manifest['version'] ?? null) !== 147 || ($json['targetDbVersion'] ?? null) !== 147) {
    fwrite(STDERR, "FAIL target migration version\n");
    exit(1);
}
echo "PASS migration 146/147 provenance and distinct operations\n";
