<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
foreach(['js/next/dashboard_engine.js','js/next/dashboard_widgets.js','css/next/dashboard_engine.css','api/dashboard_preferences.php','api/migrations/096_universal_dashboard_engine.php','docs/releases/changelog/CHANGELOG_R188_3.md'] as $f)if(!is_file($root.'/'.$f))$fail[]='missing:'.$f;
$config=(string)@file_get_contents($root.'/config.php');if(!preg_match("/KARETA_DB_VERSION',\s*(9[6-9]|[1-9][0-9]{2,})/",$config))$fail[]='db_version';
$assets=(string)@file_get_contents($root.'/inc/asset_registry.php');foreach(['dashboard_engine.css','dashboard_engine.js','dashboard_widgets.js'] as $x)if(substr_count($assets,$x)!==1)$fail[]='asset:'.$x;
$engine=(string)@file_get_contents($root.'/js/next/dashboard_engine.js');foreach(['register','render','saveLayout','contextKinds','kareta:dashboard-ready'] as $x)if(!str_contains($engine,$x))$fail[]='engine:'.$x;
$sto=(string)@file_get_contents($root.'/js/next/pages/sto_workplace.js');$r82=str_contains($sto,"STO_WORKSPACE_R82_CONTRACT='R188.5.5.6.82'");if(!$r82&&!str_contains($sto,"'sto.main'"))$fail[]='sto_dashboard';
$admin=(string)@file_get_contents($root.'/js/next/pages/admin_workspaces.js');if(!str_contains($admin,"'admin.main'"))$fail[]='admin_dashboard';
if($fail){fwrite(STDERR,implode("\n",$fail)."\n");exit(1);}echo "R188.3 verifier OK\n";
