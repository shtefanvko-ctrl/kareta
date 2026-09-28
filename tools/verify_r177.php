<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$asset=(string)file_get_contents($root.'/inc/asset_version.php');
$sw=(string)file_get_contents($root.'/sw.js');
$registry=(string)file_get_contents($root.'/inc/asset_registry.php');
$core=(string)file_get_contents($root.'/js/next/pages/core.js');
$component=(string)file_get_contents($root.'/js/next/social_cards.js');
$css=(string)file_get_contents($root.'/css/next/social_cards.css');
$checks=[
  'R177 asset version'=>str_contains($asset,'20260803-r1861-realtime-stability') || str_contains($asset,'20260803-r1861-realtime-stability') || str_contains($asset,'20260803-r1861-realtime-stability'),
  'R177 service worker version'=>str_contains($sw,"const RELEASE = '20260803-r1861-realtime-stability'") || str_contains($sw,"const RELEASE = '20260803-r1861-realtime-stability'") || str_contains($sw,"const RELEASE = '20260803-r1861-realtime-stability'"),
  'social CSS registered'=>str_contains($registry,"'css/next/social_cards.css'"),
  'social JS registered'=>str_contains($registry,"'js/next/social_cards.js'"),
  'shared renderer exported'=>str_contains($component,'window.KaretaSocialCards'),
  'home uses shared renderer'=>str_contains($core,'window.KaretaSocialCards'),
  'responsive 3/2/1 grid'=>str_contains($css,'repeat(3,minmax(0,1fr))') && str_contains($css,'repeat(2,minmax(0,1fr))') && str_contains($css,'grid-template-columns:1fr'),
  'overflow guards'=>str_contains($css,'overflow-wrap:anywhere') && str_contains($css,'max-width:100%'),
];
$failed=[];
foreach($checks as $name=>$ok){echo ($ok?'[OK] ':'[FAIL] ').$name.PHP_EOL;if(!$ok)$failed[]=$name;}
exit($failed?1:0);
