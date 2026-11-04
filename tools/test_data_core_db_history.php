<?php
declare(strict_types=1);

/** Offline-only DB history fixtures; does not connect to MySQL. */
$root = dirname(__DIR__);
$manifest = require $root . '/api/migration_manifest.php';
$risks = json_decode((string)file_get_contents($root . '/docs/data_core_migration_risks.json'), true);
$risk138 = null;
foreach ($risks['entries'] as $entry) if ($entry['version'] === 138) $risk138 = $entry['sha256'];
if (!is_string($risk138)) throw new RuntimeException('Missing fixture checksum for 138');

$rows = [];
foreach ($manifest['files'] as $version => $meta) {
    $rows[] = ['version' => (int)$version, 'checksum' => $meta['checksum']];
}
$tmp = tempnam(sys_get_temp_dir(), 'kareta-mig-history-');
if ($tmp === false) throw new RuntimeException('Failed to create temporary file');
$script = __DIR__ . '/check_data_core_db_history.php';
$run = static function(string $name, array $fixture, bool $success, string $code = '') use ($tmp, $script): void {
    file_put_contents($tmp, json_encode(['migrations' => $fixture], JSON_THROW_ON_ERROR));
    $out = [];
    $exit = 0;
    exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($script) . ' ' . escapeshellarg('--snapshot=' . $tmp) . ' 2>&1', $out, $exit);
    $parsed = json_decode(implode("\n", $out), true);
    $codes = array_column($parsed['issues'] ?? [], 'code');
    if (!is_array($parsed) || $parsed['releaseReady'] !== false || ($exit === 0) !== $success
        || $parsed['historyStatus'] !== ($success ? 'PASS' : 'FAIL')
        || ($code !== '' && !in_array($code, $codes, true))) {
        throw new RuntimeException($name . ': ' . implode("\n", $out) . ' exit=' . $exit);
    }
    echo "PASS {$name}\n";
};
try {
    $run('matching applied 1-137 history does not grant release', $rows, true);

    $bad = $rows;
    $bad[6]['checksum'] = str_repeat('0', 64);
    $run('historical checksum mismatch blocked', $bad, false, 'APPLIED_CHECKSUM_MISMATCH');

    $bad = $rows;
    $bad[26]['checksum'] = '';
    $run('unverified empty checksum blocked', $bad, false, 'MISSING_APPLIED_CHECKSUM');

    $bad = $rows;
    unset($bad[20]);
    $run('history version gap blocked', array_values($bad), false, 'HISTORY_SEQUENCE_GAP');

    $bad = $rows;
    $bad[11]['version'] = '12garbage';
    $run('malformed version string blocked', $bad, false, 'INVALID_APPLIED_VERSION');

    $bad = $rows;
    $bad[] = $bad[9];
    $run('duplicate history version blocked', $bad, false, 'DUPLICATE_APPLIED_VERSION');

    $bad = $rows;
    $bad[] = ['version' => 138, 'checksum' => $risk138];
    $run('unreleased migration 138 blocked', $bad, false, 'APPLIED_NOT_IN_RELEASE_MANIFEST');

    $bad = $rows;
    $bad[] = ['version' => 145, 'checksum' => str_repeat('a', 64)];
    $run('unrecognized stacked migration 145 blocked', $bad, false, 'UNKNOWN_APPLIED_VERSION');

    $run('empty history blocked', [], false, 'HISTORY_EMPTY');

    file_put_contents($tmp, '{}');
    $out = [];
    $exit = 0;
    exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($script) . ' ' . escapeshellarg('--snapshot=' . $tmp) . ' 2>&1', $out, $exit);
    if ($exit === 0 || !in_array('INVALID_SNAPSHOT', array_column(json_decode(implode("\n", $out), true)['issues'] ?? [], 'code'), true)) {
        throw new RuntimeException('invalid snapshot was not denied');
    }
    echo "PASS invalid snapshot blocked\n";
} finally {
    @unlink($tmp);
}

require_once __DIR__ . '/data_core_audit_grants.php';
$checkGrants = static function (string $name, array $grants, bool $allowed): void {
    if (kareta_data_core_audit_grants_readonly($grants, 'kareta_qa') !== $allowed) {
        throw new RuntimeException('Grant check failed: ' . $name);
    }
    echo "PASS grants {$name}\n";
};
$quoteId = static fn(string $id): string => chr(96) . $id . chr(96);
$account = " TO 'audit'@'localhost'";
$usage = 'GRANT USAGE ON *.*' . $account;
$table = $quoteId('kareta_qa') . '.' . $quoteId('db_migrations');
$schema = $quoteId('kareta_qa') . '.*';
$checkGrants('table scoped SELECT', [$usage, 'GRANT SELECT ON ' . $table . $account], true);
$checkGrants('schema scoped SELECT', [$usage, 'GRANT SELECT ON ' . $schema . $account], true);
$checkGrants('no SELECT blocked', [$usage], false);
$checkGrants('global SELECT blocked', [$usage, 'GRANT SELECT ON *.*' . $account], false);
$checkGrants('wrong schema blocked', [$usage, 'GRANT SELECT ON ' . $quoteId('other') . '.' . $quoteId('db_migrations') . $account], false);
$checkGrants('write privileges blocked', [$usage, 'GRANT SELECT, INSERT ON ' . $schema . $account], false);
$checkGrants('delegation blocked', [$usage, 'GRANT SELECT ON ' . $schema . $account . ' WITH GRANT OPTION'], false);
$checkGrants('role grant blocked', [$usage, "GRANT 'audit_role'@'%' TO 'audit'@'localhost'"], false);
$checkGrants('DDL privileges blocked', [$usage, 'GRANT ALL PRIVILEGES ON ' . $schema . $account], false);
