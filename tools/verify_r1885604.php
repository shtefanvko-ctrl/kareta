<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$need=['tools/test_r1885604_client_home_native.js','tools/shell_freeze_manifest_r1885603.json','docs/releases/changelog/CHANGELOG_R188_5_5_6_44.md'];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$core=(string)@file_get_contents($root.'/js/next/pages/core.js');$registry=(string)@file_get_contents($root.'/inc/asset_registry.php');
foreach(['k-home-reference','k-home-ref-hero','k-home-ref-actions','data-home-nearby'] as $n)if(!str_contains($core,$n))$fail[]='reference home missing '.$n;
if(is_file($root.'/css/next/client_home_native.css')||str_contains($registry,'client_home_native.css'))$fail[]='legacy client_home_native.css returned';
$manifest=json_decode((string)@file_get_contents($root.'/tools/shell_freeze_manifest_r1885603.json'),true);
foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){if(str_starts_with($file,'assets/'))continue;$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.44 verifier OK (reference-home override)\n";
