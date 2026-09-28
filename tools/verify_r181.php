<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$checks=[
 'asset_version'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'20260803-r1861-realtime-stability'),
 'db_version'=>str_contains((string)file_get_contents($root.'/config.php'),"KARETA_DB_VERSION', 71"),
 'migration'=>is_file($root.'/api/migrations/063_domain_platform_core.php'),
 'api'=>is_file($root.'/api/domain.php'),
 'domain_model'=>is_file($root.'/js/next/core/domain_model.js'),
 'event_bus'=>is_file($root.'/js/next/core/event_bus.js'),
 'state_manager'=>is_file($root.'/js/next/core/state_manager.js'),
 'ui_kit'=>is_file($root.'/js/next/core/ui_kit.js'),
 'page'=>is_file($root.'/js/next/pages/core_platform.js'),
 'css'=>is_file($root.'/css/next/core_platform.css'),
];
foreach($checks as $name=>$ok){echo ($ok?'[OK] ':'[FAIL] ').$name.PHP_EOL;}
exit(in_array(false,$checks,true)?1:0);
