<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$need=['docs/releases/changelog/CHANGELOG_R188_5_5_6_51.md','tools/test_r1885611_master_owner_native_profile.js','js/next/pages/master_profile_owner.js','css/next/master_owner_profile.css','tools/shell_freeze_manifest_r1885603.json'];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$route=@file_get_contents($root.'/js/next/route_registry.js')?:'';$app=@file_get_contents($root.'/js/next/app_next.js')?:'';$page=@file_get_contents($root.'/js/next/pages/master_profile_owner.js')?:'';$api=@file_get_contents($root.'/api/master_workplace.php')?:'';$db=@file_get_contents($root.'/api/db.php')?:'';$catalog=@file_get_contents($root.'/api/masters_catalog.php')?:'';$css=@file_get_contents($root.'/css/next/master_owner_profile.css')?:'';$work=@file_get_contents($root.'/js/next/pages/master_workplace.js')?:'';$registry=@file_get_contents($root.'/inc/asset_registry.php')?:'';
foreach(['masterProfileOwner','#/master/profile'] as $t)if(!str_contains($route,$t))$fail[]='route missing '.$t;
foreach(['KaretaMasterProfileOwnerPages','renderMasterProfileOwner','mountMasterProfileOwner'] as $t)if(!str_contains($app,$t))$fail[]='app mount missing '.$t;
foreach(["sectionCard('basic'","sectionCard('specialties'","sectionCard('experience'","sectionCard('expertise'","sectionCard('publicity'",'data-owner-dialog','profileVisible','primaryServices','certificates','equipment','Посмотреть как клиент'] as $t)if(!str_contains($page,$t))$fail[]='owner page missing '.$t;
foreach(['window.Swiper','new window.Swiper','<select','k-master-wall-tabs'] as $t)if(str_contains($page,$t))$fail[]='owner native forbidden '.$t;
foreach(['kareta_master_owner_profile_get','kareta_master_owner_profile_save','kareta_assert_master_owns_profile','primary_services','profile_visible','resume'] as $t)if(!str_contains($api,$t))$fail[]='owner API missing '.$t;
foreach(['masterProfile.get','masterProfile.save'] as $t)if(!str_contains($db,$t))$fail[]='db route missing '.$t;
if(!str_contains($catalog,'avatar_url'))$fail[]='public catalog avatar missing';
foreach(['k-master-owner-hero','k-master-owner-sections','k-master-owner-dialog','@media (max-width:600px)'] as $t)if(!str_contains($css,$t))$fail[]='owner CSS missing '.$t;
if(!str_contains($work,"NATIVE_WORKPLACE_CONTRACT='R188.5.5.6.55'")&&!str_contains($work,"#/master/profile"))$fail[]='legacy workplace owner profile link missing';
foreach(['js/next/pages/master_profile_owner.js','css/next/master_owner_profile.css'] as $t)if(!str_contains($registry,$t))$fail[]='asset registry missing '.$t;
foreach(['inc/asset_version.php','sw.js'] as $f){$d=@file_get_contents($root.'/'.$f)?:'';if(!str_contains($d,'r1885611-master-owner-native-profile'))$fail[]=$f.' version missing';}
$manifest=json_decode((string)@file_get_contents($root.'/tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.51 master owner native profile + shell freeze: OK\n";
