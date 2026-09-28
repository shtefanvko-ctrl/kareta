<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$configSource=(string)file_get_contents($root.'/config.php');preg_match('/KARETA_DB_VERSION\',\s*(\d+)/',$configSource,$dbMatch);$dbVersion=(int)($dbMatch[1]??0);
$checks=[
 'db version 108'=>$dbVersion>=108,
 'migration 108'=>is_file($root.'/api/migrations/108_production_dispatch_engine.php'),
 'dispatch runtime'=>is_file($root.'/api/production_dispatch.php'),
 'dispatch include'=>str_contains((string)file_get_contents($root.'/api/db.php'),"production_dispatch.php"),
 'exchange v2 route'=>str_contains((string)file_get_contents($root.'/api/db.php'),'kareta_master_exchange_feed_v2($pdo)'),
 'dispatch rebalance route'=>str_contains((string)file_get_contents($root.'/api/db.php'),"productionDispatch.rebalance"),
 'exchange four tabs'=>str_contains((string)file_get_contents($root.'/js/next/pages/work_feed.js'),'data-exchange-tab=\\"accepted\\"')||str_contains((string)file_get_contents($root.'/js/next/pages/work_feed.js'),'data-exchange-tab="accepted"'),
 'quick response'=>str_contains((string)file_get_contents($root.'/js/next/pages/work_feed.js'),'data-exchange-quick'),
 'sto dispatch board'=>str_contains((string)file_get_contents($root.'/js/next/pages/sto_workplace.js'),'Диспетчеризация производства'),
 'asset version'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'r1885583-production-dispatch-master-exchange'),
];
$bad=array_keys(array_filter($checks,fn($v)=>!$v));
if($bad){fwrite(STDERR,'FAIL '.implode(', ',$bad).PHP_EOL);exit(1);}echo "OK R188.5.5.6.23 production dispatch master exchange\n";
