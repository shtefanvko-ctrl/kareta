<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
foreach(['docs/releases/changelog/CHANGELOG_R188_5_5_6_14.md','docs/releases/deploy/DEPLOY_R188_5_5_6_14.md','tools/test_r1885574_home_service_categories.js'] as $file){if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;}
$core=(string)@file_get_contents($root.'/js/next/pages/core.js');
$registry=(string)@file_get_contents($root.'/inc/asset_registry.php');
foreach(['k-home-ref-chips','Замена масла','Диагностика','Шиномонтаж'] as $needle)if(!str_contains($core,$needle))$fail[]='reference home popular services missing '.$needle;
if(str_contains($core,'homeServiceCategories()')||str_contains($core,'k-home-service-categories__grid'))$fail[]='legacy category renderer returned';
if(is_file($root.'/css/next/home_service_categories.css')||str_contains($registry,'home_service_categories.css'))$fail[]='legacy home_service_categories.css returned';
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.14 verifier: OK (reference-home override)\n";
