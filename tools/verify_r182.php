<?php
$root=dirname(__DIR__);$checks=[
 'release'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'20260803-r1861-realtime-stability'),
 'migration'=>is_file($root.'/api/migrations/067_calendar_booking.php')&&str_contains((string)file_get_contents($root.'/api/migrations/067_calendar_booking.php'),"'version'=>67"),
 'api'=>str_contains((string)file_get_contents($root.'/api/domain.php'),'booking.availability')&&str_contains((string)file_get_contents($root.'/api/domain.php'),'booking.create')&&str_contains((string)file_get_contents($root.'/api/domain.php'),'booking.cancel'),
 'page'=>is_file($root.'/js/next/pages/calendar_booking.js'),
 'style'=>is_file($root.'/css/next/calendar_booking.css'),
 'route'=>str_contains((string)file_get_contents($root.'/js/next/route_registry.js'),"#/calendar"),
 'registry'=>str_contains((string)file_get_contents($root.'/inc/asset_registry.php'),'calendar_booking.js')&&str_contains((string)file_get_contents($root.'/inc/asset_registry.php'),'calendar_booking.css'),
];$ok=!in_array(false,$checks,true);foreach($checks as $k=>$v)echo ($v?'[OK] ':'[FAIL] ').$k.PHP_EOL;exit($ok?0:1);
