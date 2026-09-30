<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$fail = static function(string $message): void {
    fwrite(STDERR, "MIGRATION_COLLISION_BRIDGE: FAIL {$message}\n");
    exit(1);
};

for ($version = 130; $version <= 134; $version++) {
    $path = $root . '/api/migrations/' . $version . '_historical_collision_bridge.php';
    if (!is_file($path)) $fail("missing compatibility slot {$version}");
    $text = (string)file_get_contents($path);
    $migration = require $path;
    if (!is_array($migration) || (int)($migration['version'] ?? 0) !== $version || !is_callable($migration['run'] ?? null)) {
        $fail("invalid compatibility contract {$version}");
    }
    if (preg_match('/\$pdo\s*->\s*(?:exec|prepare|query)\s*\(/', $text)) {
        $fail("compatibility slot {$version} contains database side effects");
    }
}

$obdPath = $root . '/api/migrations/135_obd_elm327_diagnostics.php';
if (!is_file($obdPath)) $fail('migration 135 missing');
$obdText = (string)file_get_contents($obdPath);
$obd = require $obdPath;
if (!is_array($obd) || (int)($obd['version'] ?? 0) !== 135 || !is_callable($obd['run'] ?? null)) {
    $fail('migration 135 contract invalid');
}
if (!str_contains($obdText, 'CREATE TABLE IF NOT EXISTS obd_diagnostic_sessions')) {
    $fail('migration 135 does not own OBD schema');
}

$runtime = (string)file_get_contents($root . '/api/obd.php');
if (str_contains($runtime, 'CREATE TABLE IF NOT EXISTS obd_diagnostic_sessions')) {
    $fail('runtime OBD endpoint contains DDL');
}
if (!str_contains($runtime, 'OBD_SCHEMA_PENDING')) {
    $fail('runtime OBD endpoint lost schema readiness guard');
}

$historical = glob($root . '/api/migrations_pending/historical/*.php') ?: [];
if (count($historical) < 8) {
    $fail('historical collision archive is incomplete');
}

echo "MIGRATION_COLLISION_BRIDGE: PASS canonical=135 historical=" . count($historical) . PHP_EOL;
