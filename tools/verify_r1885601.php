<?php
declare(strict_types=1);
$root=dirname(__DIR__);$errors=[];
$dispatch=file_get_contents($root.'/api/production_dispatch.php')?:'';
$feed=file_get_contents($root.'/js/next/pages/work_feed.js')?:'';
$version=file_get_contents($root.'/inc/asset_version.php')?:'';
$sw=file_get_contents($root.'/sw.js')?:'';
foreach([
 'function kareta_master_exchange_feed_fallback',
 'MASTER_EXCHANGE_V2_DEGRADED',
 'MASTER_EXCHANGE_ITEM_METRICS',
 'exchange_status',
 'exchange_deadline_at',
 'estimated_duration_min',
 'SELECT * FROM masters WHERE BINARY id=BINARY ? LIMIT 1',
 'MASTER_EXCHANGE_LOAD',
] as $needle){if(!str_contains($dispatch,$needle))$errors[]='missing exchange fail-soft contract: '.$needle;}
foreach([
 'retriedIdentity=false',
 'window.KaretaIdentity?.load?.({force:true,allowLegacyBridge:true',
 'exchangeState.degraded=!!data.degraded',
 'Биржа доступна · метрики восстанавливаются',
 'Сервер Биржи временно не ответил. Данные страницы и фильтры сохранены.',
] as $needle){if(!str_contains($feed,$needle))$errors[]='missing frontend recovery contract: '.$needle;}
if(!str_contains($version,'r1885601-master-exchange-failsoft-recovery'))$errors[]='asset version missing r1885601';
if(!str_contains($sw,'r1885601-master-exchange-failsoft-recovery'))$errors[]='service worker missing r1885601';
if($errors){fwrite(STDERR,json_encode(['ok'=>false,'errors'=>$errors],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL);exit(1);}
echo json_encode(['ok'=>true,'release'=>'R188.5.5.6.41'],JSON_UNESCAPED_UNICODE).PHP_EOL;
