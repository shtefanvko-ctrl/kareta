<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$fail=[];
$index=file_get_contents($root.'/index.php');
$sw=file_get_contents($root.'/sw.js');
$ver=require $root.'/inc/asset_version.php';
if(!str_contains($index,'https://cdn.jsdelivr.net')) $fail[]='CSP CDN allowance missing';
if(!str_contains($sw,'20260726-used-market-runtime-r170')) $fail[]='SW version mismatch';
if(!str_contains(file_get_contents($root.'/api/seller_shop.php'),'SHOP_CATALOG_FATAL_RECOVERY')) $fail[]='shop fallback missing';
if(!str_contains(file_get_contents($root.'/api/db.php'),'DEGRADED_SNAPSHOT')) $fail[]='pull degraded response missing';
if($fail){fwrite(STDERR,implode("\n",$fail)."\n");exit(1);} echo "R170 runtime checks: OK\n";
