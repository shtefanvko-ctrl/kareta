<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];$read=static fn(string $f)=>(string)@file_get_contents($root.'/'.$f);
$need=['docs/releases/changelog/CHANGELOG_R188_5_5_6_65.md','docs/releases/plans/PLAN_R188_5_5_6_65_MASTER_EXCHANGE_ACCEPTANCE_FLOW.md','docs/releases/plans/PLAN_R188_5_5_6_66_MASTER_ORDER_COMMUNICATION_SCHEDULING.md','css/next/master_exchange_acceptance_flow.css','api/migrations/118_master_exchange_acceptance_flow.php','tools/test_r1885625_master_exchange_acceptance_flow.js','tools/shell_freeze_manifest_r1885603.json'];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$config=$read('config.php');$migration=$read('api/migrations/118_master_exchange_acceptance_flow.php');$db=$read('api/db.php');$dispatch=$read('api/production_dispatch.php');$work=$read('js/next/pages/master_workplace.js');$feed=$read('js/next/pages/work_feed.js');$orders=$read('js/next/pages/orders.js');$css=$read('css/next/master_exchange_acceptance_flow.css');$registry=$read('inc/asset_registry.php');$asset=$read('inc/asset_version.php');$sw=$read('sw.js');
if(!preg_match("/KARETA_DB_VERSION',\s*(\d+)/",$config,$m)||(int)$m[1]!==118)$fail[]='R65 expected DB version 118';
foreach(['payload_hash','master_exchange_notification_receipts'] as $t)if(!str_contains($migration,$t))$fail[]='migration missing '.$t;
foreach(['LIMIT 1 FOR UPDATE','duplicate_response','exchange_response_limit_reached','nextAction'] as $t)if(!str_contains($db,$t))$fail[]='db R65 missing '.$t;
foreach(['service_scope','__baseline__','exchange.matching_request.new','chat_id'] as $t)if(!str_contains($dispatch,$t))$fail[]='dispatch R65 missing '.$t;
foreach(['data-exchange-scope="mine"','applyExchangeFocus','data-quick-duration','data-exchange-chat'] as $t)if(!str_contains($feed,$t))$fail[]='feed R65 missing '.$t;
foreach(['data-workplace-exchange-quick','data-workplace-lead-duration','#/master/exchange?focus='] as $t)if(!str_contains($work,$t))$fail[]='workplace R65 missing '.$t;
foreach(['acceptedExchangeNextAction','ЗАЯВКА ПРИНЯТА','Перейти в чат'] as $t)if(!str_contains($orders,$t))$fail[]='orders R65 missing '.$t;
foreach(['.k-exchange-service-scope','.k-exchange-card.is-focused','.k-master-native-lead__quick','.k-client-exchange-next'] as $t)if(!str_contains($css,$t))$fail[]='R65 CSS missing '.$t;
if(str_contains($css,'#k-mobile-nav')||str_contains($css,'#k-desktop-nav')||str_contains($css,'#k-menu-toggle'))$fail[]='R65 CSS alters Shell';
if(!str_contains($registry,'css/next/master_exchange_acceptance_flow.css'))$fail[]='R65 stylesheet not registered';
if(!str_contains($asset,'r1885625-master-exchange-acceptance-flow')||!str_contains($sw,'r1885625-master-exchange-acceptance-flow'))$fail[]='R65 asset suffix missing';
$manifest=json_decode($read('tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.65 master exchange acceptance flow + Shell Freeze 2: OK\n";
