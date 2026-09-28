<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$required=['api/migrations/107_client_exchange_production_scale.php','api/client_exchange_scale.php','css/next/client_exchange_scale.css','docs/releases/changelog/CHANGELOG_R188_5_5_6_21.md','tools/test_r1885581_client_exchange_scale.js'];
foreach($required as $f)if(!is_file($root.'/'.$f))$fail[]='missing:'.$f;
$v=(string)@file_get_contents($root.'/inc/asset_version.php');if(!str_contains($v,'r1885581-client-exchange-production-scale'))$fail[]='asset version';
$c=(string)@file_get_contents($root.'/config.php');$dbv=0;if(preg_match("/KARETA_DB_VERSION',\s*(\d+)/",$c,$mm))$dbv=(int)$mm[1];if($dbv<107)$fail[]='db version >=107';
$m=(string)@file_get_contents($root.'/api/migrations/107_client_exchange_production_scale.php');if(!str_contains($m,"'version' => 107"))$fail[]='migration 107';
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.21 verifier OK\n";
