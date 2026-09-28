<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
$root = dirname(__DIR__);
require_once $root . '/inc/asset_version.php';
require_once $root . '/inc/asset_registry.php';

$errors = [];
$registry = kareta_asset_registry();
$registeredJs = array_fill_keys($registry['scripts'] ?? [], true);
$registeredCss = array_fill_keys($registry['styles'] ?? [], true);
$routePlan = function_exists('kareta_route_asset_plan') ? kareta_route_asset_plan() : [];
$lazyJs = [];
$lazyCss = [];
foreach ($routePlan as $bundleName => $bundle) {
    if (!is_array($bundle) || str_starts_with((string)$bundleName, '_') || empty($bundle['lazy'])) continue;
    foreach (($bundle['scripts'] ?? []) as $file) if (is_string($file) && $file !== '') $lazyJs[$file] = true;
    foreach (($bundle['styles'] ?? []) as $file) if (is_string($file) && $file !== '') $lazyCss[$file] = true;
}
$allRegisteredJs = $registeredJs + $lazyJs;
$allRegisteredCss = $registeredCss + $lazyCss;
$sourceCss = array_fill_keys(is_array($routePlan['_sourceLayers'] ?? null) ? $routePlan['_sourceLayers'] : [], true);

$scan = static function(string $base, string $ext) use ($root): array {
    $out = [];
    $dir = $root . '/' . $base;
    if (!is_dir($dir)) return [];
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $file) {
        if (!$file->isFile() || strtolower($file->getExtension()) !== $ext) continue;
        $out[] = str_replace('\\','/', substr($file->getPathname(), strlen($root) + 1));
    }
    sort($out);
    return $out;
};

foreach ($scan('js','js') as $file) if (!isset($allRegisteredJs[$file])) $errors[] = "unregistered JS runtime: {$file}";
foreach ($scan('css','css') as $file) if (!isset($allRegisteredCss[$file]) && !isset($sourceCss[$file])) $errors[] = "unregistered CSS runtime: {$file}";

$legacy = [
    'js/app.js','js/chat.js','js/db.js','js/master_modals.js','js/modules.js','js/onboarding_live.js',
    'js/order_lifecycle.js','js/orders.js','js/rbac.js','js/receipt.js','js/route_style.js','js/security.js',
    'js/submit_guard.js','js/ui_icon_helper.js','css/app_core_bundle.css','css/client_app_bundle.css',
    'css/legacy_responsive_bundle.css','css/staff_ui_bundle.css',
];
foreach ($legacy as $file) if (is_file($root . '/' . $file)) $errors[] = "legacy runtime returned: {$file}";

$runtimeCss = array_values(array_filter($scan('css','css'), static fn(string $file): bool => !isset($sourceCss[$file])));
$runtimeFiles = array_merge($scan('js','js'), $runtimeCss);
$hashes = [];
foreach ($runtimeFiles as $rel) {
    $hash = hash_file('sha256', $root . '/' . $rel) ?: '';
    if ($hash === '') continue;
    $hashes[$hash][] = $rel;
}
foreach ($hashes as $group) if (count($group) > 1) $errors[] = 'duplicate runtime content: ' . implode(', ', $group);

foreach ($runtimeFiles as $rel) {
    $base = basename($rel);
    if (preg_match('/(?:\([0-9]+\)|(?:^|[-_.])(copy|backup|bak|old|tmp)(?:[-_.]|$)|~$)/i', $base)) {
        $errors[] = "suspicious runtime filename: {$rel}";
    }
}

$apiText = '';
foreach (glob($root . '/api/*.php') ?: [] as $file) $apiText .= "\n" . (string)file_get_contents($file);
foreach ($legacy as $file) if (str_contains($apiText, $file)) $errors[] = "diagnostics still require legacy runtime: {$file}";

if (strlen((string)KARETA_ASSET_VERSION) > 32) $errors[] = 'asset version token too long';

if ($errors) {
    fwrite(STDERR, "RUNTIME FILE HYGIENE FAIL\n - " . implode("\n - ", $errors) . "\n");
    exit(1);
}

echo json_encode([
    'ok' => true,
    'version' => KARETA_ASSET_VERSION,
    'registeredJs' => count($registeredJs),
    'lazyJs' => count($lazyJs),
    'registeredCss' => count($registeredCss),
    'lazyCss' => count($lazyCss),
    'unregisteredJs' => 0,
    'unregisteredCss' => 0,
    'consolidatedSourceCss' => count($sourceCss),
    'legacyRuntimeFiles' => 0,
    'duplicateRuntimeContentGroups' => 0,
    'assetsIncluded' => is_dir($root . '/assets'),
], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) . PHP_EOL;
