<?php
declare(strict_types=1);
$root = dirname(__DIR__);
$errors = [];
$warnings = [];
$read = static fn(string $file): string => (string)(@file_get_contents($file) ?: '');

$config = $read($root . '/config.php');
$bootstrap = $read($root . '/api/bootstrap.php');
$client = $read($root . '/js/next/api_client.js');
$db = $read($root . '/api/db.php');
$assetVersion = $read($root . '/inc/asset_version.php');
$sw = $read($root . '/sw.js');

foreach (['KARETA_DB_AUTO_CREATE','KARETA_DB_AUTO_MIGRATE','KARETA_RUNTIME_MAINTENANCE_INTERVAL','KARETA_API_MAX_BODY_BYTES'] as $constant) {
    if (strpos($config, $constant) === false) $errors[] = 'Missing runtime configuration: ' . $constant;
}
if (strpos($bootstrap, 'kareta_safe_step($pdo, \'BOOTSTRAP\', static function(PDO $pdo): void { kareta_migrate($pdo);') !== false) {
    $errors[] = 'Migration errors are still swallowed by kareta_safe_step';
}
if (strpos($bootstrap, 'kareta_migrate($pdo);') === false) $errors[] = 'Migration runner is not connected to bootstrap';
if (strpos($bootstrap, 'kareta_runtime_maintenance_due()') === false) $errors[] = 'Heavy bootstrap maintenance is not throttled';
if (strpos($bootstrap, 'KARETA_DB_AUTO_CREATE') === false) $errors[] = 'Automatic database creation is not guarded';
if (strpos($bootstrap, 'PAYLOAD_TOO_LARGE') === false) $errors[] = 'API body-size guard is missing';
if (strpos($bootstrap, 'METHOD_NOT_ALLOWED') === false) $errors[] = 'API method allow-list is missing';

preg_match("/KARETA_ASSET_VERSION = '([^']+)'/", $assetVersion, $m1);
preg_match("/const RELEASE = '([^']+)'/", $sw, $m2);
if (($m1[1] ?? '') === '' || ($m1[1] ?? '') !== ($m2[1] ?? '')) $errors[] = 'Asset version and service worker release are out of sync';

preg_match_all("/action\s*:\s*['\"]([^'\"]+)['\"]/", $client, $clientMatches);
$actions = array_values(array_unique($clientMatches[1] ?? []));
$serverSources = $db;
foreach (glob($root . '/api/*.php') ?: [] as $file) $serverSources .= "\n" . $read($file);
foreach ($actions as $action) {
    if (strpos($serverSources, "'{$action}'") === false && strpos($serverSources, '"' . $action . '"') === false) {
        $errors[] = 'Frontend action has no server registration: ' . $action;
    }
}

preg_match_all("~['\"]((?:api|inc|js|css|assets)/[^'\"?#]+\.php)['\"]~", $client . "\n" . $read($root . '/index.php'), $pathMatches);
foreach (array_unique($pathMatches[1] ?? []) as $relative) {
    if (!is_file($root . '/' . $relative)) $errors[] = 'Referenced local endpoint/file is missing: ' . $relative;
}

if (strpos($bootstrap, 'kareta_rebuild_user_stats($pdo);') !== false && strpos($bootstrap, 'kareta_runtime_maintenance_due()') === false) {
    $warnings[] = 'User statistics rebuild may execute on every request';
}

$result = [
    'ok' => !$errors,
    'frontend_actions_checked' => count($actions),
    'errors' => $errors,
    'warnings' => $warnings,
];
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
exit($errors ? 1 : 0);
