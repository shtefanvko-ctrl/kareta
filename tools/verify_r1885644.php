<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$need=['js/next/native_dialogs.js','css/next/ux_cleanup.css','tools/test_r1885644_global_ux_cleanup_legacy_removal.js'];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
if(is_file($root.'/js/next/pages/role_dashboards.js'))$fail[]='dead role_dashboards still present';
if(is_file($root.'/js/next/master_surface_runtime.js'))$fail[]='legacy master surface injector still present';
$config=(string)@file_get_contents($root.'/config.php');if(!preg_match("~define\\('KARETA_DB_VERSION',\\s*(\\d+)\\)~",$config,$m)||((int)$m[1])<127)$fail[]='DB version must be 127 or newer';
$reg=(string)@file_get_contents($root.'/inc/asset_registry.php');foreach(['ux_cleanup.css','js/next/native_dialogs.js'] as $m)if(!str_contains($reg,$m))$fail[]='registry missing '.$m;if(str_contains($reg,'role_dashboards.js'))$fail[]='dead dashboard still registered';if(str_contains($reg,'master_surface_runtime.js'))$fail[]='legacy master surface injector still registered';
$asset=(string)@file_get_contents($root.'/inc/asset_version.php');$sw=(string)@file_get_contents($root.'/sw.js');$suffix='r1885643-seller-marketplace-window-architecture-r1885644-global-ux-cleanup-legacy-removal';if(!str_contains($asset,$suffix)||!str_contains($sw,$suffix))$fail[]='release version chain missing';
$migrations=glob($root.'/api/migrations/*.php')?:[];$versions=[];foreach($migrations as $f)if(preg_match('~/([0-9]{3})_~',str_replace('\\','/',$f),$m))$versions[]=(int)$m[1];sort($versions);if(!$versions||max($versions)<127||$versions!==range(min($versions),max($versions)))$fail[]='migration continuity/max invalid';
$manifest=json_decode((string)@file_get_contents($root.'/tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)||hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.84 verifier: UX-only DB127 + assets + migrations + Shell Freeze OK\n";
