<?php
$root=dirname(__DIR__);$checks=[
 'release'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'20260803-r1861-realtime-stability'),
 'migration'=>is_file($root.'/api/migrations/068_finance_payments.php'),
 'api'=>str_contains((string)file_get_contents($root.'/api/domain.php'),"estimate.create")&&str_contains((string)file_get_contents($root.'/api/domain.php'),"refund.create"),
 'page'=>is_file($root.'/js/next/pages/finance.js')&&is_file($root.'/css/next/finance.css'),
 'route'=>str_contains((string)file_get_contents($root.'/js/next/route_registry.js'),"#/finance"),
 'assets'=>str_contains((string)file_get_contents($root.'/inc/asset_registry.php'),'finance.css')&&str_contains((string)file_get_contents($root.'/inc/asset_registry.php'),'pages/finance.js'),
];foreach($checks as $k=>$ok)echo ($ok?'PASS ':'FAIL ').$k.PHP_EOL;exit(in_array(false,$checks,true)?1:0);
