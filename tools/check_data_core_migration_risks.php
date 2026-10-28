<?php
declare(strict_types=1);
/** Source-only guard for potentially active migrations. No SQL connection, no runtime bootstrap. */
$root = dirname(__DIR__);
foreach (array_slice($argv, 1) as $arg) {
    if (strpos($arg, '--root=') === 0) $root = substr($arg, 7);
    elseif ($arg !== '--check') { fwrite(STDERR, "usage: php tools/check_data_core_migration_risks.php [--check] [--root=/path]\n"); exit(2); }
}
$root = rtrim($root, '/');
$failures = [];
$fail = static function (string $code, array $details = []) use (&$failures): void { $failures[] = array_merge(['code' => $code], $details); };
$registryPath = $root . '/docs/data_core_migration_risks.json';
$registry = is_file($registryPath) ? json_decode((string)file_get_contents($registryPath), true) : null;
if (!is_array($registry) || (int)($registry['schemaVersion'] ?? 0) !== 1 || !is_array($registry['entries'] ?? null)) {
    $fail('REGISTRY_MISSING_OR_INVALID'); $registry = ['entries' => []];
}
$phpPath = $root . '/api/migration_manifest.php';
$manifest = is_file($phpPath) ? require $phpPath : null;
if (!is_array($manifest) || !is_array($manifest['files'] ?? null)) {
    $fail('PHP_MANIFEST_MISSING_OR_INVALID'); $manifest = ['version'=>0, 'files'=>[]];
}
$active = (int)($manifest['version'] ?? 0);
$files = glob($root . '/api/migrations/*.php') ?: [];
$pending = [];
foreach ($files as $path) {
    $filename = basename($path);
    if (preg_match('/^(\d+)_/', $filename, $m) && (int)$m[1] > $active) $pending[(int)$m[1]] = $filename;
}
ksort($pending);
$registered = [];
foreach ($registry['entries'] as $entry) {
    $version = (int)($entry['version'] ?? 0);
    $name = (string)($entry['file'] ?? '');
    $digest = (string)($entry['sha256'] ?? '');
    $risk = (string)($entry['risk'] ?? '');
    if ($version < 1 || isset($registered[$version])) { $fail('REGISTRY_DUPLICATE_OR_INVALID_VERSION', ['version'=>$version]); continue; }
    $registered[$version] = $entry;
    if ($name !== ($pending[$version] ?? null)) $fail('REGISTERED_MIGRATION_NOT_PENDING', ['version'=>$version]);
    $path = $root . '/api/migrations/' . $name;
    if (!is_file($path)) $fail('SOURCE_FILE_MISSING', ['version'=>$version]);
    elseif (!preg_match('/^[a-f0-9]{64}$/', $digest) || !hash_equals($digest, hash_file('sha256', $path))) $fail('SOURCE_CHANGED_REQUIRE_REVIEW', ['version'=>$version]);
    if (!in_array($risk, ['CRITICAL','HIGH','MEDIUM','LOW'], true) || ($entry['manualReviewRequired'] ?? null) !== true || empty($entry['reason']) || !is_array($entry['tables'] ?? null) || !$entry['tables']) {
        $fail('RISK_ENTRY_INCOMPLETE', ['version'=>$version]);
    }
}
foreach ($pending as $version => $name) {
    if (!isset($registered[$version])) $fail('UNREVIEWED_PENDING_MIGRATION', ['version'=>$version, 'file'=>$name]);
}
// Distinct executable evidence: migration 140 deliberately invokes four earlier procedures.
if (isset($registered[140])) {
    $source = @file_get_contents($root . '/api/migrations/' . $registered[140]['file']) ?: '';
    foreach (['072_identity_core_stage1.php','128_master_first_entry_onboarding.php','129_client_first_entry_state.php','138_account_type_profile_lifecycle.php'] as $dependency) {
        if (strpos($source, $dependency) === false) $fail('REPLAY_DEPENDENCY_CHANGED', ['file'=>$dependency]);
    }
}
// Mapping in migration 142: applying it more than once changes an already normalized step.
$map = static function(int $step): int { return $step >= 4 ? 3 : ($step === 3 ? 2 : ($step === 2 ? 1 : 1)); };
$nonIdempotent = [];
foreach ([1,2,3,4] as $step) {
    $first = $map($step); $second = $map($first);
    if ($first !== $second) $nonIdempotent[] = ['original'=>$step,'first'=>$first,'second'=>$second];
}
if (!isset($registered[142]) || !$nonIdempotent) $fail('STEP_REPLAY_ASSESSMENT_MISSING');
$result = [
    'sourceGate' => $failures ? 'FAIL' : 'PASS',
    'releaseReady' => false, // Source inspection NEVER authorizes execution of data migrations.
    'runtimeManifestVersion' => $active,
    'pendingVersions' => array_keys($pending),
    'reviewedSourceEntries' => count($registered),
    'migration140ReplayDependencies' => [72,128,129,138],
    'migration142NonIdempotentExamples' => $nonIdempotent,
    'manualReviewRequired' => true,
    'errors' => $failures,
    'scope' => 'source-only; no database access or migration execution'
];
echo json_encode($result, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT) . PHP_EOL;
exit($failures ? 1 : 0);
