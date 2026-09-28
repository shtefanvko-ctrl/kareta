<?php
declare(strict_types=1);
$root=dirname(__DIR__);$errors=[];
$asset=(string)@file_get_contents($root.'/inc/asset_version.php');
$sw=(string)@file_get_contents($root.'/sw.js');
$config=(string)@file_get_contents($root.'/config.php');
$css=(string)@file_get_contents($root.'/css/next/app_next.css');
$migCss=(string)@file_get_contents($root.'/css/next/identity_migration.css');
$migJs=(string)@file_get_contents($root.'/js/next/pages/identity_migration.js');
$checks=[
 'release'=>preg_match('/2026080[4-9]-(?:r186[5-9]|r18[7-9][0-9]*)-[a-z0-9-]+/',$asset)===1,
 'sw sync'=>preg_match("/KARETA_ASSET_VERSION = '([^']+)'/",$asset,$a)&&preg_match("/const RELEASE = '([^']+)'/",$sw,$b)&&($a[1]??'')===($b[1]??''),
 'db >=84'=>preg_match("/KARETA_DB_VERSION',\s*(8[4-9]|9[0-9]|[1-9][0-9]{2,})/",$config)===1,
 'mobile navigation slots'=>(str_contains($css,'nth-child(n+6)')||str_contains($css,'nth-child(n+7)'))&&str_contains($css,'--k-mobile-nav-count: 5'),
 'safe area'=>str_contains($css,'safe-area-inset-bottom'),
 'overflow contract'=>str_contains($css,'Global overflow contract'),
 'migration responsive'=>str_contains($migCss,'Stage 14B stability'),
 'migration json guard'=>str_contains($migJs,'migration_invalid_content_type'),
 'migration busy state'=>str_contains($migJs,"setAttribute('aria-busy'"),
];
foreach($checks as $name=>$ok){if(!$ok)$errors[]=$name;}
if($errors){fwrite(STDERR,'System stability FAILED: '.implode(', ',$errors).PHP_EOL);exit(1);}echo "R186.5 System Stability OK\n";
