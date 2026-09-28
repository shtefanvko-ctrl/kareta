<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$checks=[
 'asset version'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'r1885582-master-mobile-nav-six-surfaces'),
 'css registered'=>str_contains((string)file_get_contents($root.'/inc/asset_registry.php'),'master_mobile_nav.css'),
 'master exchange route'=>str_contains((string)file_get_contents($root.'/js/next/route_registry.js'),"masterExchange:Object.freeze({ path:'#/master/exchange'"),
 'community route'=>str_contains((string)file_get_contents($root.'/js/next/route_registry.js'),"community:Object.freeze({ path:'#/community'"),
 'master current template'=>str_contains((string)file_get_contents($root.'/js/next/navigation_core.js'),"['masterDashboard','masterExchange','serviceManagement','parts','cabinet','__more__']"),
];
$bad=array_keys(array_filter($checks,fn($v)=>!$v));
if($bad){fwrite(STDERR,'FAIL '.implode(', ',$bad).PHP_EOL);exit(1);}
echo "OK R188.5.5.6.22 master mobile nav
";
