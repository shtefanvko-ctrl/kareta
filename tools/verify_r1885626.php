<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];$read=static fn(string $f)=>(string)@file_get_contents($root.'/'.$f);
$need=['docs/releases/changelog/CHANGELOG_R188_5_5_6_66.md','docs/releases/plans/PLAN_R188_5_5_6_66_MASTER_ORDER_COMMUNICATION_SCHEDULING.md','docs/releases/plans/PLAN_R188_5_5_6_67_MASTER_CAPACITY_RESCHEDULE.md','css/next/master_order_communication_scheduling.css','api/migrations/119_master_order_communication_scheduling.php','tools/test_r1885626_master_order_communication_scheduling.js','tools/shell_freeze_manifest_r1885603.json'];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$config=$read('config.php');$migration=$read('api/migrations/119_master_order_communication_scheduling.php');$db=$read('api/db.php');$workApi=$read('api/master_workplace.php');$dispatch=$read('api/production_dispatch.php');$work=$read('js/next/pages/master_workplace.js');$orders=$read('js/next/pages/orders.js');$css=$read('css/next/master_order_communication_scheduling.css');$registry=$read('inc/asset_registry.php');$asset=$read('inc/asset_version.php');$sw=$read('sw.js');
if(!preg_match("/KARETA_DB_VERSION',\s*(\d+)/",$config,$m)||(int)$m[1]!==119)$fail[]='R66 expected DB version 119';
foreach(['accepted_at','response_sla_min','source','conflict_override'] as $t)if(!str_contains($migration,$t))$fail[]='migration missing '.$t;
foreach(['clientExchange.schedulePreview','masterSchedule.orderPlan.save','confirmScheduleConflict','schedule_conflict'] as $t)if(!str_contains($db,$t))$fail[]='db R66 missing '.$t;
foreach(['kareta_master_schedule_conflicts','INSERT IGNORE','newAccepted','replySlaMin'] as $t)if(!str_contains($workApi,$t))$fail[]='workplace API R66 missing '.$t;
foreach(['exchange_accept','master_adjustment','preservedSchedule'] as $t)if(!str_contains($dispatch,$t))$fail[]='dispatch R66 missing '.$t;
foreach(['MASTER_SCHEDULING_R66_CONTRACT','Новые принятые','data-master-plan-force','saveOrderPlan'] as $t)if(!str_contains($work,$t))$fail[]='workplace UI R66 missing '.$t;
foreach(['Есть пересечение в расписании','previewExchangeSchedule','data-schedule-conflict'] as $t)if(!str_contains($orders,$t))$fail[]='orders R66 missing '.$t;
foreach(['.k-master-r66-accepted-section','.k-client-r66-schedule'] as $t)if(!str_contains($css,$t))$fail[]='R66 CSS missing '.$t;
if(str_contains($css,'#k-mobile-nav')||str_contains($css,'#k-desktop-nav')||str_contains($css,'#k-menu-toggle'))$fail[]='R66 CSS alters Shell';
if(!str_contains($registry,'css/next/master_order_communication_scheduling.css'))$fail[]='R66 stylesheet not registered';
if(!str_contains($asset,'r1885626-master-order-communication-scheduling')||!str_contains($sw,'r1885626-master-order-communication-scheduling'))$fail[]='R66 asset suffix missing';
$manifest=json_decode($read('tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.66 master order communication scheduling + Shell Freeze 2: OK\n";
