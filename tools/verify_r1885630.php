<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$need=static function(bool $ok,string $message):void{if(!$ok){fwrite(STDERR,"FAIL: $message\n");exit(1);}};
$files=[
 'api/migrations/124_master_day_operations_auto_recovery.php',
 'api/master_day_operations.php',
 'css/next/master_day_operations_auto_recovery.css',
 'tools/test_r1885630_master_day_operations_auto_recovery.js',
 'docs/releases/plans/PLAN_R188_5_5_6_70_MASTER_DAY_OPERATIONS_AUTO_RECOVERY.md',
];
foreach($files as $file)$need(is_file($root.'/'.$file),'missing '.$file);
$need(str_contains((string)file_get_contents($root.'/config.php'),"KARETA_DB_VERSION', 124"),'DB version must be 124');
$need(str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'r1885630-master-day-operations-auto-recovery'),'asset version suffix');
echo "R188.5.5.6.70 verifier OK\n";
