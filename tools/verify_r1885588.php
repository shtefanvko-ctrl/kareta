<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$configSource=(string)file_get_contents($root.'/config.php');preg_match('/KARETA_DB_VERSION\',\s*(\d+)/',$configSource,$dbMatch);$dbVersion=(int)($dbMatch[1]??0);
$life=(string)file_get_contents($root.'/js/next/onboarding/onboarding_lifecycle.js');
$asset=(string)file_get_contents($root.'/inc/asset_version.php');
$sw=(string)file_get_contents($root.'/sw.js');
$checks=[
 'db version remains 108'=>$dbVersion>=108,
 'live session role helper'=>str_contains($life,'function sessionRole'),
 'completed reconcile preserves route'=>str_contains($life,"lastAction = 'stable-app-preserve-route'"),
 'completed app transition preserves current hash'=>str_contains($life,"lastAction = 'app-route-preserved'"),
 'completed session metadata sync'=>str_contains($life,'state.write({ role:confirmedRole, entryRole:confirmedRole, pending:false, stage:\'done\' })'),
 'asset version'=>str_contains($asset,'r1885588-tab-resume-route-authority'),
 'service worker version'=>str_contains($sw,'r1885588-tab-resume-route-authority'),
];
$bad=array_keys(array_filter($checks,fn($v)=>!$v));
if($bad){fwrite(STDERR,'FAIL '.implode(', ',$bad).PHP_EOL);exit(1);} echo "OK R188.5.5.6.28 tab resume route authority\n";
