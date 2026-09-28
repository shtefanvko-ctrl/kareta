<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$required=['api/migrations/105_master_aftercare_finance_inventory.php','api/master_order_aftercare.php','js/next/pages/work_order.js','js/next/work_orders/work_order_api.js','css/next/master_aftercare.css','docs/releases/changelog/CHANGELOG_R188_5_5_6_19.md','tools/test_r1885579_master_aftercare_finance_inventory.js'];
foreach($required as $f)if(!is_file($root.'/'.$f))$fail[]='missing:'.$f;
$version=(string)@file_get_contents($root.'/inc/asset_version.php');if(!str_contains($version,'r1885579-master-aftercare-finance-inventory'))$fail[]='asset version';
$config=(string)@file_get_contents($root.'/config.php');if(!preg_match("/KARETA_DB_VERSION',\s*(10[5-9]|1[1-9][0-9])/",$config))$fail[]='db version >=105';
$m=(string)@file_get_contents($root.'/api/migrations/105_master_aftercare_finance_inventory.php');if(!str_contains($m,"'version' => 105"))$fail[]='migration 105';
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.19 verifier OK\n";
