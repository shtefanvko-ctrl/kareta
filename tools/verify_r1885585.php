<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$configSource=(string)file_get_contents($root.'/config.php');preg_match('/KARETA_DB_VERSION\',\s*(\d+)/',$configSource,$dbMatch);$dbVersion=(int)($dbMatch[1]??0);
$nav=(string)file_get_contents($root.'/js/next/navigation_core.js');
$checks=[
 'db version remains 108'=>$dbVersion>=108,
 'route preservation helper'=>str_contains($nav,'preserveRouteAfterContextChange'),
 'context switch preserves route'=>str_contains($nav,"preserveRouteAfterContextChange(previousRoute, previousHash, 'account-context-switch')"),
 'cross tab preserves local route'=>str_contains($nav,"preserveRouteAfterContextChange(localRoute, localHash, 'cross-tab-context-sync')"),
 'rollback preserves previous hash'=>str_contains($nav,"restorePrevious(previous, previousRoute, previousHash)"),
 'asset version'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'r1885585-route-session-position-preservation'),
 'service worker version'=>str_contains((string)file_get_contents($root.'/sw.js'),'r1885585-route-session-position-preservation'),
];
$bad=array_keys(array_filter($checks,fn($v)=>!$v));
if($bad){fwrite(STDERR,'FAIL '.implode(', ',$bad).PHP_EOL);exit(1);}
echo "OK R188.5.5.6.25 route/session position preservation\n";
