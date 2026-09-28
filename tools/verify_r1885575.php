<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$required=[
    'api/migrations/103_person_profile_legacy_id_string.php',
    'tools/test_r1885575_profile_legacy_id_mobile_nav.js',
    'docs/releases/changelog/CHANGELOG_R188_5_5_6_15.md',
    'docs/releases/deploy/DEPLOY_R188_5_5_6_15.md',
];
foreach($required as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
if(!preg_match("/define\('KARETA_DB_VERSION',\s*(\d+)\);/", $read('config.php'), $m) || (int)$m[1] < 103)$fail[]='db version';
if(!str_contains($read('api/migrations/103_person_profile_legacy_id_string.php'),'VARCHAR(64) NULL'))$fail[]='legacy id type repair';
$nav=$read('js/next/navigation_core.js');
$mobileNav=explode('// Desktop navigation', $nav, 2)[0];
if(!str_contains($mobileNav,"personal: Object.freeze(['home','services','works','masters','parts','__more__'])"))$fail[]='personal mobile nav';
if(!str_contains($mobileNav,"personal: Object.freeze(['home','services'"))$fail[]='services missing from personal mobile nav';
if(str_contains($mobileNav,"master: Object.freeze(['home','orders','serviceManagement'"))$fail[]='services remains in master mobile nav';
if(str_contains($mobileNav,"organization_service: Object.freeze(['stoDashboard','orders','masters','serviceManagement'"))$fail[]='services remains in STO mobile nav';
foreach(['inc/asset_version.php','sw.js','index.php'] as $file)if(!str_contains($read($file),'r1885575-profile-legacy-id-mobile-nav-recovery'))$fail[]=$file.' asset marker';
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.15 verifier: OK\n";
