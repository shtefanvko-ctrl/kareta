<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$required=['api/migrations/106_operational_finance_payroll_receivables.php','api/operational_finance.php','js/next/pages/finance.js','css/next/operational_finance.css','docs/releases/changelog/CHANGELOG_R188_5_5_6_20.md','tools/test_r1885580_operational_finance.js'];
foreach($required as $f)if(!is_file($root.'/'.$f))$fail[]='missing:'.$f;
$version=(string)@file_get_contents($root.'/inc/asset_version.php');if(!str_contains($version,'r1885580-operational-finance-payroll-receivables'))$fail[]='asset version';
$config=(string)@file_get_contents($root.'/config.php');if(!preg_match("/define\('KARETA_DB_VERSION',\s*(\d+)\);/",$config,$m)||((int)$m[1])<106)$fail[]='db version >=106';
$m=(string)@file_get_contents($root.'/api/migrations/106_operational_finance_payroll_receivables.php');if(!str_contains($m,"'version' => 106"))$fail[]='migration 106';
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.20 verifier OK\n";
