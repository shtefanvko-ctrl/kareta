<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
$root = dirname(__DIR__);
$catalog = '/assets/catalog/garage/service_maintenance.json';
require_once $root . '/inc/asset_version.php';

$manifest = static function (string $mode) use ($root): array {
    $code = '$_GET[' . var_export($mode, true) . ']=1; require ' . var_export($root . '/asset_manifest.php', true) . ';';
    $process = proc_open([PHP_BINARY, '-r', $code], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, $root);
    if (!is_resource($process)) throw new RuntimeException('manifest process failed');
    $body = stream_get_contents($pipes[1]);
    $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    if (proc_close($process) !== 0) throw new RuntimeException('manifest execution failed: ' . $errors);
    return json_decode($body, true, 512, JSON_THROW_ON_ERROR);
};
$expect = static function (bool $ok, string $message): void {
    if (!$ok) throw new RuntimeException($message);
};
$route = $manifest('route_loader');
$rows = array_values(array_filter($route['assets'], static fn(array $row): bool => $row['group'] === 'catalogs'));
$expect(count($rows) === 1, 'route inventory must contain one demand catalog');
$expect($rows[0]['path'] === $catalog && $rows[0]['exists'] === true && $rows[0]['lazy'] === true, 'catalog inventory must describe the existing lazy file');
$expect($rows[0]['url'] === $catalog . '?v=' . KARETA_ASSET_VERSION, 'catalog URL must be release scoped');
$expect($route['assetMetrics']['lazyCatalogCount'] === 1, 'catalog metric mismatch');
$expect($route['routeBundles']['cabinet']['catalogs'] === [ltrim($catalog, '/')], 'cabinet catalog ownership missing');
$expect($route['routeBundles']['masterWorkplaceApi']['routeKeys'] === ['masterDashboard', 'cabinetSettings'], 'canonical settings route regressed');
$atomic = $manifest('atomic_boot');
$expect(!array_filter($atomic['assets'], static fn(array $row): bool => $row['group'] === 'catalogs'), 'boot must not include catalog payload');
echo "CATALOG_ASSET_MANIFEST: PASS route inventory, release URL, canonical settings, zero boot catalogs\n";
