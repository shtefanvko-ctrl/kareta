<?php
declare(strict_types=1);

/**
 * P0 Data Core: read-only inspection of db_migrations history.
 * No KARETA bootstrap, DB migrations, writes, auto-repair, or release approval.
 * Explicit --snapshot=file for offline tests OR --mysql with explicit audit credentials.
 */
if (PHP_SAPI !== 'cli') { exit(2); }
$mode = null;
$snapshotPath = null;
foreach (array_slice($argv, 1) as $arg) {
    if (str_starts_with($arg, '--snapshot=') && $mode === null) {
        $mode = 'snapshot';
        $snapshotPath = substr($arg, strlen('--snapshot='));
    } elseif ($arg === '--mysql' && $mode === null) {
        $mode = 'mysql-read-only';
    } else {
        fwrite(STDERR, "Usage: php tools/check_data_core_db_history.php --snapshot=/path/file.json | --mysql\n");
        exit(2);
    }
}
if ($mode === null) {
    fwrite(STDERR, "An explicit read-only source is required. No default database connection.\n");
    exit(2);
}
$root = dirname(__DIR__);
require_once __DIR__ . '/data_core_audit_grants.php';
$manifest = require $root . '/api/migration_manifest.php';
$risks = json_decode((string)file_get_contents($root . '/docs/data_core_migration_risks.json'), true);
$manifestRows = is_array($manifest['files'] ?? null) ? $manifest['files'] : [];
$riskRows = [];
foreach (($risks['entries'] ?? []) as $entry) {
    if (is_array($entry) && is_int($entry['version'] ?? null)) $riskRows[$entry['version']] = $entry;
}
$errors = [];
$add = static function (string $code, array $details = []) use (&$errors): void {
    $errors[] = array_merge(['code' => $code], $details);
};
$rows = null;
if ($mode === 'snapshot') {
    $decoded = ($snapshotPath !== '' && is_file((string)$snapshotPath))
        ? json_decode((string)file_get_contents((string)$snapshotPath), true)
        : null;
    if (is_array($decoded) && isset($decoded['migrations']) && is_array($decoded['migrations'])) {
        $rows = $decoded['migrations'];
    } else {
        $add('INVALID_SNAPSHOT');
    }
} else {
    $dsn = getenv('KARETA_MIGRATION_AUDIT_DSN');
    $user = getenv('KARETA_MIGRATION_AUDIT_USER');
    $password = getenv('KARETA_MIGRATION_AUDIT_PASSWORD');
    $schema = (is_string($dsn) && preg_match('/(?:^|;)dbname=([^;]+)/', $dsn, $found)) ? $found[1] : '';
    if (!is_string($dsn) || !str_starts_with($dsn, 'mysql:') || $schema === '' || !is_string($user) || $user === '' || !is_string($password)) {
        $add('READ_ONLY_CONNECTION_NOT_CONFIGURED');
    } elseif (!extension_loaded('pdo_mysql')) {
        $add('PDO_MYSQL_NOT_AVAILABLE');
    } else {
        try {
            $pdo = new PDO($dsn, $user, $password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 5,
            ]);
            // Refuse elevated and role-derived privileges before inspecting DB metadata.
            $grants = $pdo->query('SHOW GRANTS')->fetchAll(PDO::FETCH_COLUMN);
            if (!kareta_data_core_audit_grants_readonly($grants, $schema)) {
                $add('AUDIT_USER_NOT_SELECT_ONLY');
            } else {
                // Server-enforced read-only transaction; only SELECT statements below.
                $pdo->exec('START TRANSACTION READ ONLY');
                try {
                    $rows = $pdo->query('SELECT version, checksum FROM db_migrations ORDER BY version')->fetchAll();
                } finally {
                    // PDO::rollBack() does not recognize transactions started by raw SQL.
                    // SQL ROLLBACK closes the explicitly started read-only transaction.
                    $pdo->exec('ROLLBACK');
                }
            }
        } catch (Throwable $e) {
            $add('READ_ONLY_INVENTORY_FAILED'); // Never reveal DSN, DB errors or credentials.
        }
    }
}
$seen = [];
if (is_array($rows)) {
    if (!$rows) $add('HISTORY_EMPTY');
    foreach ($rows as $row) {
        if (!is_array($row)) { $add('INVALID_HISTORY_ROW'); continue; }
        $raw = $row['version'] ?? null;
        $version = is_int($raw) ? $raw : ((is_string($raw) && preg_match('/^[1-9][0-9]*$/D', $raw)) ? (int)$raw : 0);
        if ($version <= 0 || $version > 1000000) { $add('INVALID_APPLIED_VERSION'); continue; }
        if (isset($seen[$version])) { $add('DUPLICATE_APPLIED_VERSION', ['version' => $version]); continue; }
        $seen[$version] = true;
        $checksum = $row['checksum'] ?? null;
        if (!is_string($checksum) || $checksum === '') {
            $add('MISSING_APPLIED_CHECKSUM', ['version' => $version]);
        }
        if (isset($manifestRows[$version])) {
            $expected = (string)$manifestRows[$version]['checksum'];
        } elseif (isset($riskRows[$version])) {
            $expected = (string)$riskRows[$version]['sha256'];
            $add('APPLIED_NOT_IN_RELEASE_MANIFEST', ['version' => $version]);
        } else {
            $expected = null;
            $add('UNKNOWN_APPLIED_VERSION', ['version' => $version]);
        }
        if ($expected !== null && is_string($checksum) && $checksum !== '' && !hash_equals($expected, $checksum)) {
            $add('APPLIED_CHECKSUM_MISMATCH', ['version' => $version]);
        }
    }
    $max = $seen ? max(array_keys($seen)) : 0;
    $missing = $max ? array_values(array_diff(range(1, min($max, 1000000)), array_keys($seen))) : [];
    if ($missing) $add('HISTORY_SEQUENCE_GAP', ['count' => count($missing), 'firstVersions' => array_slice($missing, 0, 20)]);
} else {
    $max = 0;
}
echo json_encode([
    'scope' => 'db_migrations metadata only; no bootstrap, writes or migration execution',
    'mode' => $mode,
    'historyStatus' => $errors ? 'FAIL' : 'PASS',
    'releaseReady' => false,
    'releaseManifestVersion' => (int)($manifest['version'] ?? 0),
    'recordedVersions' => count($seen),
    'maxRecordedVersion' => $max,
    'manualReviewRequired' => true,
    'issues' => $errors,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
exit($errors ? 1 : 0);
