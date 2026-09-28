<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
$required=[
    'css/next/master_business_runtime.css',
    'tools/test_r1885577_master_business_runtime.js',
    'docs/releases/changelog/CHANGELOG_R188_5_5_6_17.md',
    'docs/releases/deploy/DEPLOY_R188_5_5_6_17.md',
];
foreach($required as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;
$workplace=$read('api/master_workplace.php');
foreach(['KaretaIdentityContextService','legacy_entity_id','kareta_master_workplace_business','revenue_month','service_offers','master_exchange_responses','unread_master'] as $marker)if(!str_contains($workplace,$marker))$fail[]='workplace DB marker: '.$marker;
$schedule=$read('js/next/pages/master_schedule.js');
foreach(['const demos','demoItems','Режим предпросмотра','isDemo','ДЕМО'] as $marker)if(str_contains($schedule,$marker))$fail[]='schedule demo marker remained: '.$marker;
$registry=$read('inc/asset_registry.php');
if(!str_contains($registry,'css/next/master_business_runtime.css'))$fail[]='master business CSS unregistered';
foreach(['inc/asset_version.php','sw.js','index.php'] as $file)if(!str_contains($read($file),'r1885577-master-business-runtime'))$fail[]=$file.' asset marker';
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.17 verifier: OK\n";
