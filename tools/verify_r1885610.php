<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$need=['docs/releases/changelog/CHANGELOG_R188_5_5_6_50.md','tools/test_r1885610_public_master_native_profile.js','tools/shell_freeze_manifest_r1885603.json'];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$js=@file_get_contents($root.'/js/next/pages/details.js')?:'';
$api=@file_get_contents($root.'/api/catalog_details.php')?:'';
$catalog=@file_get_contents($root.'/api/masters_catalog.php')?:'';
$css=@file_get_contents($root.'/css/next/details.css')?:'';
foreach(['k-provider-native-profile','data-provider-follow','data-provider-open="experience"','data-provider-open="services"','data-provider-open="works"','k-provider-wall-preview','k-master-wall-native-actions','data-provider-dialog="wall-filter"'] as $token)if(!str_contains($js,$token))$fail[]='public master profile missing '.$token;
$hasR53=str_contains($readVersion=(string)@file_get_contents($root.'/inc/asset_version.php'),'r1885613-master-reviews-social-contract');
if($hasR53){if(!str_contains($js,'#/masters/reviews/'))$fail[]='public master profile missing dedicated reviews route';}elseif(!str_contains($js,'data-provider-open="reviews"'))$fail[]='public master profile missing data-provider-open="reviews"';
$providerStart=strpos($js,'async function mountProvider');$providerEnd=strpos($js,'window.KaretaDetailPages',$providerStart?:0);$providerSlice=($providerStart!==false&&$providerEnd!==false)?substr($js,$providerStart,$providerEnd-$providerStart):'';
foreach(['window.Swiper','new window.Swiper','k-master-wall-tabs','<select'] as $token)if(str_contains($providerSlice,$token))$fail[]='provider native flow forbidden token '.$token;
foreach(['reviewSummary','socialState','socialCounts','profile_visible','quality_rating','communication_rating'] as $token)if(!str_contains($api,$token))$fail[]='provider API missing '.$token;
foreach(['primary_services','service_radius_km','profile_visible','resume'] as $token)if(!str_contains($catalog,$token))$fail[]='masters catalog missing '.$token;
foreach(['k-provider-native-primary-actions','k-provider-specialty-grid','k-provider-native-dialog','k-provider-review-breakdown','grid-template-columns:repeat(2,minmax(0,1fr))'] as $token)if(!str_contains($css,$token))$fail[]='provider native CSS missing '.$token;
foreach(['inc/asset_version.php','sw.js'] as $f){$d=@file_get_contents($root.'/'.$f)?:'';if(!str_contains($d,'r1885610-public-master-native-profile'))$fail[]=$f.' version missing';}
$manifest=json_decode((string)@file_get_contents($root.'/tools/shell_freeze_manifest_r1885603.json'),true);
foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.50 public master native profile + shell freeze: OK\n";
