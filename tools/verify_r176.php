<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$migration=(string)file_get_contents($root.'/api/migrations/062_work_contexts_capabilities.php');
$access=(string)file_get_contents($root.'/api/context_access.php');
$endpoint=(string)file_get_contents($root.'/api/organizations.php');
$manager=(string)file_get_contents($root.'/js/next/context_manager.js');
$menu=(string)file_get_contents($root.'/js/next/shell_menu.js');
$registry=(string)file_get_contents($root.'/inc/asset_registry.php');
$config=(string)file_get_contents($root.'/config.php');
$asset=(string)file_get_contents($root.'/inc/asset_version.php');
$checks=[
 'migration 62 exists'=>is_file($root.'/api/migrations/062_work_contexts_capabilities.php'),
 'context preferences table'=>strpos($migration,'user_context_preferences')!==false,
 'effective capability resolver'=>strpos($access,'kareta_context_effective_capabilities')!==false,
 'deny capability support'=>strpos($access,"=== 'deny'")!==false,
 'server capability guard'=>strpos($access,'kareta_require_capability')!==false,
 'persistent context selection'=>strpos($access,'kareta_context_save_selected')!==false,
 'context endpoint uses shared core'=>strpos($endpoint,"require_once __DIR__ . '/context_access.php'")!==false,
 'frontend context manager'=>is_file($root.'/js/next/context_manager.js') && strpos($manager,'kareta:context-changed')!==false,
 'menu context host'=>strpos($menu,'k-context-switcher')!==false,
 'context assets registered'=>strpos($registry,'context_manager.js')!==false && strpos($registry,'context_switcher.css')!==false,
 'db version 62'=>strpos($config,"KARETA_DB_VERSION', 62")!==false,
 'asset version R176'=>strpos($asset,'work-contexts-r176')!==false,
];
$failed=[];foreach($checks as $name=>$ok){echo($ok?'[OK] ':'[FAIL] ').$name.PHP_EOL;if(!$ok)$failed[]=$name;}exit($failed?1:0);
