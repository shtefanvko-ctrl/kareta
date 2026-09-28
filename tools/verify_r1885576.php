<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$required=[
    'css/next/master_surfaces.css',
    'tools/test_r1885576_master_work_surfaces.js',
    'docs/releases/changelog/CHANGELOG_R188_5_5_6_16.md',
];
foreach($required as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
$registry=$read('inc/asset_registry.php');
$version=$read('inc/asset_version.php');$r84=str_contains($version,'r1885644-global-ux-cleanup-legacy-removal');
if(!str_contains($registry,'css/next/master_surfaces.css'))$fail[]='unregistered asset: css/next/master_surfaces.css';
if($r84){if(is_file($root.'/js/next/master_surface_runtime.js'))$fail[]='R84 legacy master surface injector still exists';if(str_contains($registry,'master_surface_runtime.js'))$fail[]='R84 legacy master surface injector still registered';}else{if(!is_file($root.'/js/next/master_surface_runtime.js'))$fail[]='missing file: js/next/master_surface_runtime.js';if(!str_contains($registry,'js/next/master_surface_runtime.js'))$fail[]='unregistered asset: js/next/master_surface_runtime.js';}
$workplace=$read('js/next/pages/master_workplace.js');
if(str_contains($workplace,"NATIVE_WORKPLACE_CONTRACT='R188.5.5.6.55'")){
    $r81=str_contains($workplace,"MASTER_WORKSPACE_R81_CONTRACT='R188.5.5.6.81'");
    $markers=$r81?['k-master-r81-commandbar','k-master-r81-attention','data-master-workspace-settings-dialog','data-master-status-dialog','catch(error)']:['k-master-native-actions','k-master-native-attention','data-master-status-dialog','catch(error)'];
    foreach($markers as $marker)if(!str_contains($workplace,$marker))$fail[]='native master workplace marker: '.$marker;if(str_contains($workplace,'k-master-schedule-embedded'))$fail[]='native workplace must not embed full schedule';}else{foreach(['k-master-workplace-actions','k-master-operational-alerts','catch(error)'] as $marker)if(!str_contains($workplace,$marker))$fail[]='master workplace marker: '.$marker;}
foreach(['inc/asset_version.php','sw.js','index.php'] as $file)if(!str_contains($read($file),'r1885576-master-work-surfaces'))$fail[]=$file.' asset marker';
$nav=$read('js/next/navigation_core.js');
if(str_contains($nav,"master: Object.freeze(['home','orders','serviceManagement'"))$fail[]='services returned to master mobile nav';
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.16 verifier: OK\n";
