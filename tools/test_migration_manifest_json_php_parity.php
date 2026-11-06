<?php
declare(strict_types=1);

/**
 * Read-only release gate: PHP runtime migration manifest must match JSON
 * provenance mirror. Never rewrite historical checksums automatically.
 */
$root = dirname(__DIR__);
$php = require $root . '/api/migration_manifest.php';
$json = json_decode((string)file_get_contents($root . '/api/migration_manifest.json'), true, 512, JSON_THROW_ON_ERROR);
$version = (int)($php['version'] ?? 0);
$rows = $php['files'] ?? [];
$mirror = $json['migrations'] ?? [];
$issues = [];

if ($version < 1 || !is_array($rows) || array_keys($rows) !== range(1, $version)) {
    $issues[] = 'PHP manifest sequence invalid';
}
if (($json['targetDbVersion'] ?? null) !== $version || count($mirror) !== count($rows)) {
    $issues[] = 'manifest version/count mismatch';
}
$seen = [];
foreach ($mirror as $item) {
    $id = $item['version'] ?? null;
    if (!is_int($id) || isset($seen[$id]) || !isset($rows[$id])) {
        $issues[] = 'unexpected/duplicate JSON version ' . (string)$id;
        continue;
    }
    $seen[$id] = true;
    $name = $item['file'] ?? null;
    $hash = $item['sha256'] ?? null;
    $expected = $rows[$id];
    if ($name !== ($expected['file'] ?? null)) {
        $issues[] = "migration {$id} filename mismatch";
        continue;
    }
    if (!is_string($hash) || !preg_match('/^[a-f0-9]{64}$/D', $hash)
        || !hash_equals((string)($expected['checksum'] ?? ''), $hash)) {
        $issues[] = "migration {$id} checksum mismatch";
    }
}
foreach (array_keys($rows) as $id) {
    if (!isset($seen[$id])) {
        $issues[] = "migration {$id} missing in JSON";
    }
}
if ($issues !== []) {
    foreach ($issues as $issue) {
        fwrite(STDERR, "MIGRATION_PARITY_FAIL: {$issue}\n");
    }
    exit(1);
}
echo "MIGRATION_PARITY_PASS version={$version} entries=" . count($rows) . PHP_EOL;
