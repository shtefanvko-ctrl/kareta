<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$need=['css/next/client_account_native.css','tools/test_r1885608_home_restore_client_account.js','docs/releases/changelog/CHANGELOG_R188_5_5_6_48.md','tools/shell_freeze_manifest_r1885603.json'];foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$core=(string)@file_get_contents($root.'/js/next/pages/core.js');$cabinet=(string)@file_get_contents($root.'/js/next/pages/cabinet.js');$css=(string)@file_get_contents($root.'/css/next/client_account_native.css');$registry=(string)@file_get_contents($root.'/inc/asset_registry.php');
$start=strpos($core,'function renderHome(context)');$end=strpos($core,'function mountHome(context',$start===false?0:$start);$home=($start!==false&&$end!==false)?substr($core,$start,$end-$start):'';
foreach(['k-home-reference','data-home-greeting','k-home-ref-search','k-home-ref-hero','k-home-ref-actions','data-home-nearby','k-home-ref-chips'] as $token)if(!str_contains($home,$token))$fail[]='reference home missing '.$token;
if(str_contains($home,'Константин'))$fail[]='hard-coded home name returned';
foreach(['problemSlider()','homeServiceCategories()',"homeSliderShell('news'","homeSliderShell('products'","homeSliderShell('works'"] as $token)if(str_contains($core,$token))$fail[]='legacy home renderer returned '.$token;
foreach(['k-client-account-native','k-client-account-overview','k-account-vehicles-grid','РАЗДЕЛЫ АККАУНТА'] as $token)if(!str_contains($cabinet,$token))$fail[]='client account missing '.$token;
foreach(['data-account-vehicles-slider','demoCabinetVehicles','new window.Swiper'] as $token)if(str_contains($cabinet,$token))$fail[]='client account forbidden token '.$token;
if(!str_contains($registry,'css/next/client_account_native.css'))$fail[]='account css not registered';
foreach(['k-mobile-nav','k-desktop-nav','k-shell-header','k-menu-drawer','k-context-switch'] as $forbidden)if(str_contains($css,$forbidden))$fail[]='page css targets frozen shell '.$forbidden;
$manifest=json_decode((string)@file_get_contents($root.'/tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){if(str_starts_with($file,'assets/'))continue;$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.48 reference client home + native client account: OK\n";
