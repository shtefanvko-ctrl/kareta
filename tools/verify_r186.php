<?php
$root=dirname(__DIR__);$checks=[
 'release'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'20260803-r1861-realtime-stability'),
 'migration'=>is_file($root.'/api/migrations/071_realtime_platform.php'),
 'endpoint'=>is_file($root.'/api/realtime.php')&&str_contains((string)file_get_contents($root.'/api/realtime.php'),'text/event-stream'),
 'client'=>is_file($root.'/js/next/core/realtime_client.js')&&str_contains((string)file_get_contents($root.'/js/next/core/realtime_client.js'),'BroadcastChannel'),
 'style'=>is_file($root.'/css/next/realtime.css'),
 'registry'=>str_contains((string)file_get_contents($root.'/inc/asset_registry.php'),'realtime_client.js'),
];foreach($checks as $k=>$ok)echo ($ok?'PASS ':'FAIL ').$k.PHP_EOL;exit(in_array(false,$checks,true)?1:0);
