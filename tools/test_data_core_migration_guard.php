<?php
declare(strict_types=1);
/** Offline positive and negative cases. Creates disposable local fixtures only. */
$guard = __DIR__ . '/check_data_core_migrations.php';
$root = sys_get_temp_dir() . '/kareta-migration-guard-' . getmypid() . '-' . bin2hex(random_bytes(4));
@mkdir($root . '/api/migrations', 0700, true);
$cleanup = static function (string $dir) use (&$cleanup): void {
    foreach (scandir($dir) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $path = $dir . '/' . $entry;
        if (is_dir($path)) $cleanup($path);
        else unlink($path);
    }
    rmdir($dir);
};
$records = [];
for ($version = 1; $version <= 2; ++$version) {
    $file = sprintf('%03d_test_migration.php', $version);
    file_put_contents($root . '/api/migrations/' . $file, "<?php\nreturn static function (): void {};\n");
    $hash = hash_file('sha256', $root . '/api/migrations/' . $file);
    $records[] = ['version' => $version, 'file' => $file, 'sha256' => $hash];
}
$write = static function (array $jsonRows, int $jsonVersion, array $phpRows, int $phpVersion, int $configured) use ($root): void {
    $phpFiles = [];
    foreach ($phpRows as $item) $phpFiles[$item['version']] = ['file' => $item['file'], 'checksum' => $item['sha256']];
    file_put_contents($root . '/api/migration_manifest.php', "<?php\nreturn " . var_export(['version'=>$phpVersion,'files'=>$phpFiles], true) . ";\n");
    file_put_contents($root . '/api/migration_manifest.json', json_encode(['schemaVersion'=>1,'targetDbVersion'=>$jsonVersion,'migrations'=>$jsonRows],JSON_PRETTY_PRINT)."\n");
    file_put_contents($root . '/config.php', "<?php\ndefine('KARETA_DB_VERSION', {$configured});\n");
};
$assert = static function (string $case, string $wantedStatus, string $wantedCode = '') use ($guard, $root): void {
    $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($guard) . ' ' . escapeshellarg('--root=' . $root);
    $lines = []; $exitCode = 0;
    exec($command . ' 2>&1', $lines, $exitCode);
    $response = json_decode(implode("\n", $lines), true);
    $codes = array_column($response['issues'] ?? [], 'code');
    if (!is_array($response) || ($response['status'] ?? '') !== $wantedStatus || ($wantedCode !== '' && !in_array($wantedCode, $codes, true)) || ($wantedStatus === 'PASS' && $exitCode !== 0) || ($wantedStatus === 'FAIL' && $exitCode === 0)) {
        throw new RuntimeException("FAIL {$case}: " . implode("\n", $lines));
    }
    echo "PASS {$case}\n";
};
try {
    $write($records, 2, $records, 2, 2);
    $assert('aligned manifests', 'PASS');
    $bad = $records; $bad[0]['sha256'] = str_repeat('0',64);
    $write($bad,2,$records,2,2);
    $assert('json drift detected', 'FAIL', 'JSON_PHP_HASH_DRIFT');
    $write($records,2,$records,2,3);
    $assert('runtime version drift detected', 'FAIL', 'VERSION_DRIFT');
    $write($records,2,$records,2,2);
    file_put_contents($root . '/api/migrations/003_extra.php', "<?php\nreturn null;\n");
    $assert('unlisted migration detected', 'FAIL', 'UNLISTED_MIGRATION');
    unlink($root . '/api/migrations/003_extra.php');
    $dup = [$records[0], $records[0]];
    $write($dup,2,$records,2,2);
    $assert('duplicate version detected', 'FAIL', 'JSON_DUPLICATE_OR_INVALID_VERSION');
    $write($records,2,$records,2,2);
    file_put_contents($root . '/api/migrations/001_test_migration.php', "<?php\nreturn null;\n");
    $assert('migration edit detected', 'FAIL', 'PHP_FILE_HASH_MISMATCH');
} finally {
    $cleanup($root);
}
