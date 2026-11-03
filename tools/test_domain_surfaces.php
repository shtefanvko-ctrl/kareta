<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/domain_surface.php';
$expected = [
    'client.kareta.kz'=>['client','client','home'],
    'work.kareta.kz'=>['specialist','master','masterDashboard'],
    'works.kareta.kz'=>['sto','sto','stoDashboard'],
    'shop.kareta.kz'=>['shop','seller','seller'],
];
foreach ($expected as $host=>$parts) {
    $resolved = kareta_domain_surface_for_host($host);
    if ($resolved === null || [$resolved['surface'],$resolved['role'],$resolved['route']] !== $parts || ($resolved['host']??'')!==$host) throw new RuntimeException('Role domain mismatch: '.$host);
    if (kareta_domain_surface_for_host(strtoupper($host).':443') !== $resolved) throw new RuntimeException('Port/case normalization: '.$host);
}
foreach (['s.kareta.kz','m.kareta.kz','kareta.kz','www.kareta.kz','admin.kareta.kz','work.kareta.kz.evil.com','work.kareta.kz:443@evil.com','sub.work.kareta.kz','work.kareta.kz/evil', '','work.kareta.kz:abc'] as $other) {
    if (kareta_domain_surface_for_host($other) !== null) throw new RuntimeException('Host rejected incorrectly: '.$other);
}
$registry = file_get_contents(dirname(__DIR__) . '/inc/asset_registry.php');
$index = file_get_contents(dirname(__DIR__) . '/index.php');
$land = file_get_contents(dirname(__DIR__) . '/landing/index.html');
if (substr_count($registry, "'js/next/domain_surface.js'") !== 2 || strpos($registry, "'css/next/domain_surface.css'") === false) throw new RuntimeException('Domain assets not in atomic registry/source registry');
if (strpos($index, 'KARETA_DOMAIN_SURFACE') === false || strpos($index, 'kareta_domain_surface_for_host') === false) throw new RuntimeException('Domain config not injected into SPA');
if (substr_count($index, 'data-kareta-domain-app=') !== 1 || substr_count($index, 'window.KARETA_DOMAIN_SURFACE =') !== 1) throw new RuntimeException('Duplicate domain metadata or bootstrap configuration');
foreach (array_keys($expected) as $host) if (strpos($land, 'https://'.$host.'/') === false) throw new RuntimeException('Portal link missing: '.$host);
echo 'PASS: 4 domain mappings, 11 forbidden host variants, SPA assets and portal links'.PHP_EOL;
