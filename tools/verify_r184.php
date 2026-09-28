<?php
$root=dirname(__DIR__);$checks=[
 'release'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'20260803-r1861-realtime-stability'),
 'db_version'=>str_contains((string)file_get_contents($root.'/config.php'),"KARETA_DB_VERSION', 71"),
 'migration'=>is_file($root.'/api/migrations/069_marketplace_warehouse.php'),
 'api'=>str_contains((string)file_get_contents($root.'/api/domain.php'),'market.checkout'),
 'page'=>is_file($root.'/js/next/pages/market.js'),
 'style'=>is_file($root.'/css/next/market.css'),
 'route'=>str_contains((string)file_get_contents($root.'/js/next/route_registry.js'),"#/market"),
];foreach($checks as $n=>$ok)echo ($ok?'OK ':'FAIL ').$n.PHP_EOL;exit(in_array(false,$checks,true)?1:0);
