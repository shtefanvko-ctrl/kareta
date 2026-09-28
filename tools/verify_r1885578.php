<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$required=['api/migrations/104_master_order_full_lifecycle.php','api/master_order_lifecycle.php','api/sto_workflow_engine.php','js/next/pages/work_order.js','css/next/master_order_lifecycle.css','docs/releases/changelog/CHANGELOG_R188_5_5_6_18.md','tools/test_r1885578_master_order_lifecycle.js'];
foreach($required as $f)if(!is_file($root.'/'.$f))$fail[]='missing:'.$f;
$version=(string)@file_get_contents($root.'/inc/asset_version.php');if(!str_contains($version,'r1885578-master-order-full-lifecycle'))$fail[]='asset version';
$m=(string)@file_get_contents($root.'/api/migrations/104_master_order_full_lifecycle.php');if(!str_contains($m,"'version' => 104"))$fail[]='migration 104';
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.18 verifier OK\n";
