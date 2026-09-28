<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$need=['tools/test_r1885605_vehicle_native_passport.js','docs/releases/changelog/CHANGELOG_R188_5_5_6_45.md','tools/shell_freeze_manifest_r1885603.json'];
foreach($need as $f) if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$page=@file_get_contents($root.'/js/next/pages/vehicle.js')?:'';$css=@file_get_contents($root.'/css/next/vehicle.css')?:'';$api=@file_get_contents($root.'/api/vehicle_passport.php')?:'';$db=@file_get_contents($root.'/api/db.php')?:'';
foreach(['k-vehicle-identity-card','k-vehicle-native-actions','k-vehicle-native-layout','data-vehicle-action="mileage"','data-vehicle-open-section="parts"','data-vehicle-create-request'] as $n)if(!str_contains($page,$n))$fail[]='vehicle page missing '.$n;
foreach(['k-vehicle-tabs','data-vehicle-tab','<select'] as $n)if(str_contains($page,$n))$fail[]='legacy/non-native vehicle control remains '.$n;
foreach(['installedParts','kareta_vehicle_mileage_save','VEHICLE_PARTS_READ_FAIL'] as $n)if(!str_contains($api,$n))$fail[]='vehicle backend missing '.$n;
if(!str_contains($db,"case 'vehicles.mileage.save'"))$fail[]='db mileage action missing';
foreach(['grid-template-columns:repeat(2,minmax(0,1fr))','@media(max-width:760px)','.k-vehicle-modal'] as $n)if(!str_contains($css,$n))$fail[]='vehicle css missing '.$n;
foreach(['k-mobile-nav','k-desktop-nav','k-shell-header','k-menu-drawer','k-context-switch'] as $forbidden)if(str_contains($css,$forbidden))$fail[]='vehicle css targets frozen shell: '.$forbidden;
$manifest=json_decode((string)@file_get_contents($root.'/tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
foreach(['inc/asset_version.php','sw.js'] as $f){$d=@file_get_contents($root.'/'.$f)?:'';if(!str_contains($d,'r1885605-vehicle-native-passport'))$fail[]=$f.' version missing';}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.45 vehicle native passport + shell freeze: OK\n";
