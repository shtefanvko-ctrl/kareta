<?php
$root=dirname(__DIR__);$checks=[
 'release'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'20260803-r1861-realtime-stability'),
 'migration'=>is_file($root.'/api/migrations/070_crm_analytics.php'),
 'api'=>str_contains((string)file_get_contents($root.'/api/domain.php'),"crm.view")&&str_contains((string)file_get_contents($root.'/api/domain.php'),"crm.note.create"),
 'route'=>str_contains((string)file_get_contents($root.'/js/next/route_registry.js'),"#/crm"),
 'page'=>is_file($root.'/js/next/pages/crm.js'),
 'style'=>is_file($root.'/css/next/crm.css'),
];foreach($checks as $k=>$ok)echo ($ok?'PASS ':'FAIL ').$k.PHP_EOL;exit(in_array(false,$checks,true)?1:0);
