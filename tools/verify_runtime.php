<?php
declare(strict_types=1);
$root = dirname(__DIR__);
$noAssets = in_array('--no-assets', $argv ?? [], true);
require_once $root . '/inc/asset_registry.php';
$missing = $noAssets ? [] : kareta_asset_missing();
$errors = [];
$verifyAssetsOutput = []; $verifyAssetsCode = 0;
if (!$noAssets) {
    exec('timeout 30s php ' . escapeshellarg($root . '/tools/verify_assets.php') . ' 2>&1', $verifyAssetsOutput, $verifyAssetsCode);
    if ($verifyAssetsCode !== 0) $errors[] = 'verify_assets.php: ' . implode(' ', $verifyAssetsOutput);
}
$verifyConnectivityOutput = []; $verifyConnectivityCode = 0;
exec('timeout 30s php ' . escapeshellarg($root . '/tools/verify_connectivity.php') . ' 2>&1', $verifyConnectivityOutput, $verifyConnectivityCode);
if ($verifyConnectivityCode !== 0) $errors[] = 'verify_connectivity.php: ' . implode(' ', $verifyConnectivityOutput);
$bootstrapSource = @file_get_contents($root . '/api/bootstrap.php') ?: '';
$dbSource = @file_get_contents($root . '/api/db.php') ?: '';
foreach (['kareta_ensure_catalog_content', 'kareta_ensure_public_content'] as $fn) {
    $definitions = preg_match_all('/function\s+' . preg_quote($fn, '/') . '\s*\(/', $bootstrapSource . "\n" . $dbSource);
    if ($definitions !== 1) $errors[] = 'API function ownership violation: ' . $fn . ' definitions=' . $definitions;
}
foreach (['asset_ver', 'kareta_render_styles', 'kareta_render_scripts'] as $functionName) {
    if (!function_exists($functionName)) $errors[] = 'asset_registry.php: missing function ' . $functionName;
}
$migrationFiles = glob($root . '/api/migrations/*.php') ?: [];
sort($migrationFiles, SORT_NATURAL);
$versions = [];
foreach ($migrationFiles as $migrationFile) {
    $loadedMigration = require $migrationFile;
    if (is_callable($loadedMigration) && preg_match('/^(\d+)_/', basename($migrationFile), $migrationNameMatch)) {
        $version = (int)$migrationNameMatch[1];
    } elseif (is_array($loadedMigration) && isset($loadedMigration['version'], $loadedMigration['run']) && is_callable($loadedMigration['run'])) {
        $version = (int)$loadedMigration['version'];
    } else {
        $errors[] = 'invalid migration: ' . basename($migrationFile);
        continue;
    }
    if (isset($versions[$version])) $errors[] = 'duplicate migration version: ' . $version;
    $versions[$version] = basename($migrationFile);
}
if ($versions) {
    ksort($versions);
    $expected = 1;
    foreach (array_keys($versions) as $version) {
        if ($version !== $expected) $errors[] = 'migration sequence gap: expected=' . $expected . ' got=' . $version;
        $expected++;
    }
    $configSource = @file_get_contents($root . '/config.php') ?: '';
    preg_match('/define\(\'KARETA_DB_VERSION\',\s*(\d+)\)/', $configSource, $dbVersionMatch);
    $declaredVersion = (int)($dbVersionMatch[1] ?? 0);
    $latestVersion = max(array_keys($versions));
    if ($declaredVersion !== $latestVersion) $errors[] = 'KARETA_DB_VERSION mismatch: declared=' . $declaredVersion . ' latest=' . $latestVersion;
}
$configSource = @file_get_contents($root . '/config.php') ?: '';
if (preg_match("/'password'\\s*=>\\s*'[^']{8,}'/", $configSource)) $errors[] = 'config.php contains a hard-coded database password';
if (!is_file($root . '/inc/web_guard.php')) $errors[] = 'missing inc/web_guard.php';
$index = @file_get_contents($root . '/index.php') ?: '';
if (strpos($index, "inc/asset_registry.php") === false) $errors[] = 'index.php: asset registry is not loaded';
if (strpos($index, "inc/web_guard.php") === false) $errors[] = 'index.php: web guard is not loaded';
$manifest = @file_get_contents($root . '/asset_manifest.php') ?: '';
if (strpos($manifest, "inc/asset_registry.php") === false) $errors[] = 'asset_manifest.php: asset registry is not loaded';
foreach (['index.php', 'asset_manifest.php'] as $entrypoint) {
    $output = []; $code = 0;
    exec('timeout 15s php ' . escapeshellarg($root . '/' . $entrypoint) . ' > /dev/null 2>&1', $output, $code);
    if ($code !== 0) $errors[] = $entrypoint . ': execution failed with code ' . $code;
}

$phpLintOutput=[];$phpLintCode=0;
$phpLintCommand='timeout 120s sh -c '.escapeshellarg('find '.escapeshellarg($root).' -type f -name "*.php" -print0 | xargs -0 -n1 -P8 php -l');
exec($phpLintCommand.' 2>&1',$phpLintOutput,$phpLintCode);
if($phpLintCode!==0)$errors[]='PHP lint batch failed: '.implode(' ',array_slice($phpLintOutput,-20));
$jsLintOutput=[];$jsLintCode=0;
$jsLintCommand='timeout 120s sh -c '.escapeshellarg('find '.escapeshellarg($root.'/js').' -type f -name "*.js" -print0 | xargs -0 -n1 -P8 node --check');
exec($jsLintCommand.' 2>&1',$jsLintOutput,$jsLintCode);
if($jsLintCode!==0)$errors[]='JavaScript lint batch failed: '.implode(' ',array_slice($jsLintOutput,-20));
$community = @file_get_contents($root . '/js/next/pages/community.js') ?: '';
if (strpos($community, 'g=groups.find(') !== false) $errors[] = 'community.js: stale undefined groups reference';
$runtime = @file_get_contents($root . '/js/next/runtime_integrity.js') ?: '';
if (strpos($runtime, 'let healthPromise = null') === false) $errors[] = 'runtime_integrity.js: missing health single-flight guard';
$app = @file_get_contents($root . '/js/next/app_next.js') ?: '';
if (strpos($app, 'let bootPromise = null') === false) $errors[] = 'app_next.js: missing boot single-flight guard';
$onboardingApi = @file_get_contents($root . '/js/next/onboarding/onboarding_api.js') ?: '';
if (strpos($onboardingApi, 'let verifyCodeFlight = null') === false) $errors[] = 'onboarding_api.js: missing verify single-flight guard';
if (strpos($onboardingApi, 'let confirmFlight = null') === false) $errors[] = 'onboarding_api.js: missing confirm single-flight guard';
if (strpos($onboardingApi, 'CODE_FAILURE_COOLDOWN_MS') === false) $errors[] = 'onboarding_api.js: missing failure cooldown guard';
$rolePage = @file_get_contents($root . '/js/next/onboarding/pages/role_page.js') ?: '';
if (strpos($rolePage, 'const boundOverlays = new WeakSet()') === false) $errors[] = 'role_page.js: missing idempotent bind guard';
$logger = @file_get_contents($root . '/js/next/runtime_logger.js') ?: '';
if (strpos($logger, "[KARETA][api.failure]") === false) $errors[] = 'runtime_logger.js: missing visible API failure diagnostics';
echo json_encode(['ok' => !$missing && !$errors, 'missing_assets' => $missing, 'errors' => $errors], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
exit(($missing || $errors) ? 1 : 0);
