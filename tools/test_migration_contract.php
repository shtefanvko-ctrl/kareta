<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }
$root = dirname(__DIR__);
$files = glob($root . '/api/migrations/*.php') ?: [];
sort($files, SORT_NATURAL);
$versions = [];
$errors = [];
foreach ($files as $file) {
    $base = basename($file);
    if (!preg_match('/^(\d+)_/', $base, $m)) {
        $errors[] = "$base: filename has no numeric version";
        continue;
    }
    $filenameVersion = (int)$m[1];
    try { $loaded = require $file; }
    catch (Throwable $e) { $errors[] = "$base: require failed: {$e->getMessage()}"; continue; }
    if (is_callable($loaded)) {
        $version = $filenameVersion;
    } elseif (is_array($loaded) && isset($loaded['version'], $loaded['run']) && is_callable($loaded['run'])) {
        $version = (int)$loaded['version'];
    } else {
        $keys = is_array($loaded) ? implode(',', array_keys($loaded)) : gettype($loaded);
        $errors[] = "$base: invalid contract ($keys); expected callable or array with version + run";
        continue;
    }
    if ($version !== $filenameVersion) $errors[] = "$base: declared version $version differs from filename $filenameVersion";
    if (isset($versions[$version])) $errors[] = "$base: duplicate version $version with {$versions[$version]}";
    $versions[$version] = $base;
}
ksort($versions);
if ($versions) {
    $expected = range(1, max(array_keys($versions)));
    $actual = array_keys($versions);
    if ($actual !== $expected) {
        $missing = array_values(array_diff($expected, $actual));
        $errors[] = 'migration sequence gap: ' . implode(',', $missing);
    }
}
if ($errors) {
    foreach ($errors as $e) fwrite(STDERR, "[FAIL] $e\n");
    exit(1);
}
echo 'KARETA migration contract: OK (' . count($versions) . ' migrations, max=' . (max(array_keys($versions)) ?: 0) . ")\n";
