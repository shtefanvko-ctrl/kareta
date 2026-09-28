<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$read=static fn(string $f): string => (string)@file_get_contents($root.'/'.$f);
$fail=[];
foreach(['css/next/master_orders_dedup.css','tools/test_r1885587_master_mobile_orders_dedup.js','docs/releases/changelog/CHANGELOG_R188_5_5_6_27.md'] as $file){if(!is_file($root.'/'.$file))$fail[]='missing '.$file;}
if(!str_contains($read('js/next/navigation_core.js'),"master: Object.freeze(['masterDashboard','masterExchange','serviceManagement','parts','cabinet','__more__'])"))$fail[]='master mobile template';
if(!str_contains($read('js/next/navigation_core.js'),"master: Object.freeze({ key:'orders', label:'Открыть заявки', icon:'orders' })"))$fail[]='master side orders action';
if(!str_contains($read('js/next/role_access.js'),"mobile:['masterDashboard','masterExchange','serviceManagement','parts','cabinet','__more__']"))$fail[]='legacy master template';
if(!str_contains($read('js/next/mobile_back.js'),'function isOrdersSurface'))$fail[]='orders surface state';
foreach(['inc/asset_version.php','sw.js'] as $file)if(!str_contains($read($file),'r1885587-master-mobile-orders-dedup'))$fail[]=$file.' asset marker';
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "OK R188.5.5.6.27 master mobile orders dedup\n";
