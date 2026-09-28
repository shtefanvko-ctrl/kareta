<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$checks=[
 'dynamic navigation file'=>is_file($root.'/js/next/dynamic_navigation.js'),
 'asset registry'=>str_contains((string)@file_get_contents($root.'/inc/asset_registry.php'),'js/next/dynamic_navigation.js'),
 'capability catalog'=>str_contains((string)@file_get_contents($root.'/js/next/dynamic_navigation.js'),'KaretaDynamicNavigation'),
 'shell nav dynamic'=>str_contains((string)@file_get_contents($root.'/js/next/shell_nav.js'),'KaretaDynamicNavigation'),
 'shell menu dynamic'=>str_contains((string)@file_get_contents($root.'/js/next/shell_menu.js'),'menuSections'),
 'role-specific menu removed'=>!str_contains((string)@file_get_contents($root.'/js/next/shell_menu.js'),'MASTER_META'),
 'stage doc'=>is_file($root.'/docs/identity/STAGE_08_DYNAMIC_NAVIGATION.md'),
 'status stage 8'=>str_contains((string)@file_get_contents($root.'/docs/identity/implementation_status.json'),'"currentStage": 8'),
 'asset version'=>str_contains((string)@file_get_contents($root.'/inc/asset_version.php'),'20260803-r1865-stage8-dynamic-navigation'),
];
$ok=true;foreach($checks as $name=>$passed){echo ($passed?'[OK] ':'[FAIL] ').$name.PHP_EOL;$ok=$ok&&$passed;}exit($ok?0:1);
