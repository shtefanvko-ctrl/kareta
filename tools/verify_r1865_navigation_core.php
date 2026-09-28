<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$checks=[
 'version'=>preg_match('/(?:r186[5-9]|r18[7-9][0-9]*)-/',(string)@file_get_contents($root.'/inc/asset_version.php'))===1,
 'core'=>is_file($root.'/js/next/navigation_core.js'),
 'registry'=>str_contains((string)file_get_contents($root.'/inc/asset_registry.php'),'js/next/navigation_core.js'),
 'templates'=>str_contains((string)file_get_contents($root.'/js/next/navigation_core.js'),'CONTEXT_TEMPLATES'),
 'atomic_switch'=>str_contains((string)file_get_contents($root.'/js/next/navigation_core.js'),'switchContext'),
 'route_resolution'=>str_contains((string)file_get_contents($root.'/js/next/app_next.js'),'KaretaNavigationCore?.resolveRoute'),
 'mobile_primary'=>str_contains((string)file_get_contents($root.'/js/next/mobile_back.js'),'dataset.actionRoute'),
];
$failed=array_keys(array_filter($checks,static fn($ok)=>!$ok));
if($failed){fwrite(STDERR,'FAIL: '.implode(',',$failed).PHP_EOL);exit(1);} echo "R186.5 Navigation Core OK\n";
