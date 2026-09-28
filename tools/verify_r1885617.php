<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];$read=static fn(string $f)=>(string)@file_get_contents($root.'/'.$f);
$need=['docs/releases/changelog/CHANGELOG_R188_5_5_6_57.md','css/next/shell_burger_recovery.css','tools/test_r1885617_shell_burger_recovery.js','tools/shell_freeze_manifest_r1885603.json'];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$index=$read('index.php');$app=$read('css/next/app_next.css');$r24=$read('css/next/shell_session_stability.css');$css=$read('css/next/shell_burger_recovery.css');$registry=$read('inc/asset_registry.php');
foreach(['id="k-menu-toggle"','class="k-menu-toggle"','id="k-menu-drawer"','id="k-menu-backdrop"','class="k-shell-actions"'] as $t)if(!str_contains($index,$t))$fail[]='burger DOM missing '.$t;
if(!str_contains($r24,'@media (min-width:861px) and (max-width:1100px)')||!str_contains($r24,'grid-template-columns:minmax(138px,170px) minmax(0,1fr)'))$fail[]='historical 861-1100 two-column trigger missing';
foreach(['@media (min-width:861px) and (max-width:1100px)','grid-template-columns:minmax(138px,170px) minmax(0,1fr) auto','#k-shell-header > .k-shell-actions','grid-column:3','display:flex!important','#k-menu-toggle.k-menu-toggle','min-width:44px','@media (max-width:860px)','grid-column:2'] as $t)if(!str_contains($css,$t))$fail[]='burger recovery CSS missing '.$t;
$pos24=strpos($registry,"css/next/shell_session_stability.css");$pos57=strpos($registry,"css/next/shell_burger_recovery.css");if($pos24===false||$pos57===false||$pos57<$pos24)$fail[]='burger recovery CSS must load after R24';
foreach(['inc/asset_version.php','sw.js'] as $f)if(!str_contains($read($f),'r1885617-shell-burger-recovery'))$fail[]=$f.' release suffix missing';
$manifest=json_decode($read('tools/shell_freeze_manifest_r1885603.json'),true);foreach(['index.php','css/next/app_next.css','css/next/shell_burger_recovery.css'] as $f)if(empty($manifest['files'][$f]))$fail[]='Shell Freeze 2 manifest missing '.$f;
foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if(str_contains($css,'#k-mobile-nav')||str_contains($css,'.k-nav-link'))$fail[]='burger hotfix must not alter nav composition';
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.57 shell burger recovery + Shell Freeze 2: OK\n";
