<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/inc/asset_version.php';
require_once __DIR__ . '/inc/asset_registry.php';
header('X-Kareta-Asset-Version: ' . KARETA_ASSET_VERSION);

$mode = isset($_GET['runtime_probe'])
    ? 'runtime-probe'
    : (isset($_GET['atomic_boot'])
        ? 'atomic-boot'
        : (isset($_GET['route_loader']) ? 'route-loader' : 'full'));

if ($mode === 'route-loader') {
    // The route manifest is immutable inside one versioned release. Allow the
    // browser/SW to reuse it instead of regenerating the complete filesystem
    // inventory on every document boot.
    header('Cache-Control: private, max-age=31536000, immutable');
    header('Vary: Accept-Encoding');
} else {
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('CDN-Cache-Control: no-store');
    header('Surrogate-Control: no-store');
}

$emit = static function (array $payload, int $status = 200): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
};

// Frozen-index watchdog only needs release parity. The previous implementation
// rebuilt and stat()'d the entire 100+ asset manifest during every probe.
if ($mode === 'runtime-probe') {
    $emit([
        'ok' => true,
        'mode' => $mode,
        'release' => KARETA_ASSET_VERSION,
        'generatedAt' => gmdate('c'),
        'assets' => [],
        'routeBundles' => [],
        'missing' => [],
    ]);
}

$registry = kareta_asset_registry();
$assetEntry = static function (string $group, int $order, string $path, bool $lazy = false, ?string $bundle = null): array {
    $absolute = kareta_asset_root() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path);
    $exists = is_file($absolute);
    return [
        'group' => $group,
        'order' => $order,
        'path' => '/' . $path,
        'url' => $exists ? asset_ver($path) : null,
        'exists' => $exists,
        'size' => $exists ? (filesize($absolute) ?: 0) : 0,
        'lazy' => $lazy,
        'bundle' => $bundle,
    ];
};

// Atomic boot only validates the 11 executable transport resources that the
// frozen index is about to inject. Optional images and route-lazy assets must
// never make the entire application fail before the first frame.
if ($mode === 'atomic-boot') {
    $entries = [];
    foreach (($registry['scripts'] ?? []) as $order => $path) {
        if (!is_string($path) || $path === '') continue;
        $entries[] = $assetEntry('scripts', (int)$order, $path, false, null);
    }
    $missing = array_values(array_map(
        static fn(array $entry): string => $entry['path'],
        array_filter($entries, static fn(array $entry): bool => !$entry['exists'])
    ));
    $emit([
        'ok' => $missing === [],
        'mode' => $mode,
        'release' => KARETA_ASSET_VERSION,
        'generatedAt' => gmdate('c'),
        'assets' => $entries,
        'assetMetrics' => [
            'scriptCount' => count($entries),
            'sourceScriptCount' => count($registry['scriptSources'] ?? ($registry['scripts'] ?? [])),
            'criticalOnly' => true,
        ],
        'routeBundles' => [],
        'missing' => $missing,
    ], $missing === [] ? 200 : 503);
}

$routeBundles = function_exists('kareta_route_asset_plan') ? kareta_route_asset_plan() : [];

// The browser route loader never consumes images, eager bootstrap resources or
// the private _meta/_sourceLayers records. Emit a compact release-scoped route
// contract and let the loader validate only the assets a route actually uses.
if ($mode === 'route-loader') {
    $publicBundles = [];
    $entries = [];
    $seen = [];
    foreach ($routeBundles as $bundleName => $bundle) {
        if (!is_array($bundle) || str_starts_with((string)$bundleName, '_') || empty($bundle['lazy'])) continue;
        $publicBundles[(string)$bundleName] = $bundle;
        foreach (['styles','scripts'] as $group) {
            foreach (($bundle[$group] ?? []) as $order => $path) {
                if (!is_string($path) || $path === '') continue;
                $key = $group . ':' . $path;
                if (isset($seen[$key])) continue;
                $seen[$key] = true;
                $entries[] = $assetEntry($group, (int)$order, $path, true, (string)$bundleName);
            }
        }
    }
    $missing = array_values(array_map(
        static fn(array $entry): string => $entry['path'],
        array_filter($entries, static fn(array $entry): bool => !$entry['exists'])
    ));
    $emit([
        // Keep transport 200 even when an unrelated lazy route is degraded.
        // route_asset_loader fails closed only when the requested asset is used.
        'ok' => $missing === [],
        'mode' => $mode,
        'release' => KARETA_ASSET_VERSION,
        'generatedAt' => gmdate('c'),
        'assets' => $entries,
        'assetMetrics' => [
            'lazyStyleCount' => count(array_filter($entries, static fn(array $entry): bool => $entry['group'] === 'styles')),
            'lazyScriptCount' => count(array_filter($entries, static fn(array $entry): bool => $entry['group'] === 'scripts')),
            'routeBundleCount' => count($publicBundles),
            'routeOnly' => true,
        ],
        'routeBundles' => $publicBundles,
        'missing' => $missing,
    ], 200);
}

// Full diagnostic/release manifest. This intentionally preserves the complete
// static inventory and strict missing-file status for deployment tooling.
$entries = [];
$seen = [];
foreach (['styles', 'scripts', 'images'] as $group) {
    foreach (($registry[$group] ?? []) as $order => $path) {
        if (!is_string($path) || $path === '') continue;
        $entry = $assetEntry($group, (int)$order, $path, false, null);
        $entries[] = $entry;
        $seen[$group . ':' . $path] = true;
    }
}

foreach ($routeBundles as $bundleName => $bundle) {
    if (!is_array($bundle) || str_starts_with((string)$bundleName, '_') || empty($bundle['lazy'])) continue;
    foreach (['styles','scripts'] as $group) {
        foreach (($bundle[$group] ?? []) as $order => $path) {
            if (!is_string($path) || $path === '' || isset($seen[$group . ':' . $path])) continue;
            $entries[] = $assetEntry($group, (int)$order, $path, true, (string)$bundleName);
            $seen[$group . ':' . $path] = true;
        }
    }
}

$missing = array_values(array_map(
    static fn(array $entry): string => $entry['path'],
    array_filter($entries, static fn(array $entry): bool => !$entry['exists'])
));

$emit([
    'ok' => $missing === [],
    'mode' => $mode,
    'release' => KARETA_ASSET_VERSION,
    'generatedAt' => gmdate('c'),
    'assets' => $entries,
    'assetMetrics' => [
        'styleCount' => count($registry['styles'] ?? []),
        'scriptCount' => count($registry['scripts'] ?? []),
        'sourceScriptCount' => count($registry['scriptSources'] ?? ($registry['scripts'] ?? [])),
        'imageCount' => count($registry['images'] ?? []),
        'lazyStyleCount' => count(array_filter($entries, static fn(array $entry): bool => $entry['group'] === 'styles' && !empty($entry['lazy']))),
        'lazyScriptCount' => count(array_filter($entries, static fn(array $entry): bool => $entry['group'] === 'scripts' && !empty($entry['lazy']))),
        'totalScriptCount' => count(array_filter($entries, static fn(array $entry): bool => $entry['group'] === 'scripts')),
    ],
    'routeBundles' => $routeBundles,
    'missing' => $missing,
], $missing === [] ? 200 : 503);
