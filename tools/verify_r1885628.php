<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];$need=function(bool $ok,string $m)use(&$fail){if(!$ok)$fail[]=$m;};
$config=file_get_contents($root.'/config.php');preg_match("~define\\('KARETA_DB_VERSION',\\s*(\\d+)\\)~",$config,$m);$need((int)($m[1]??0)===121,'DB version must be 121');
$files=['api/account_tariffs.php','api/migrations/121_account_tariffs_master_capacity.php','css/next/account_tariffs_master_capacity.css','docs/releases/changelog/CHANGELOG_R188_5_5_6_68.md','docs/releases/plans/PLAN_R188_5_5_6_68_ACCOUNT_TARIFFS_MASTER_CAPACITY.md'];foreach($files as $f)$need(is_file($root.'/'.$f),'missing '.$f);
$migrations=glob($root.'/api/migrations/*.php')?:[];$versions=[];foreach($migrations as $f)if(preg_match('~/([0-9]{3})_~',str_replace('\\','/',$f),$x))$versions[]=(int)$x[1];sort($versions);$need($versions===range(min($versions),max($versions)),'migration gap detected');$need(max($versions)===121,'latest migration must be 121');
require_once $root.'/inc/asset_version.php';require_once $root.'/inc/asset_registry.php';$missing=kareta_asset_missing();$need(!$missing,'missing assets: '.implode(',',$missing));
$sw=file_get_contents($root.'/sw.js');$need(str_contains($sw,KARETA_ASSET_VERSION),'service worker release mismatch');
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.68 verifier OK\n";
