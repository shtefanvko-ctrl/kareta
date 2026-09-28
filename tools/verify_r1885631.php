<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];$read=fn(string $p):string=>(string)file_get_contents($root.'/'.$p);
$work=$read('js/next/pages/master_workplace.js');$exchange=$read('js/next/pages/work_feed.js');$schedule=$read('js/next/pages/master_schedule.js');$css=$read('css/next/master_ui_exchange_schedule_flattening.css');$registry=$read('inc/asset_registry.php');
foreach(['k-master-native-states','k-master-native-head','РАБОЧЕЕ МЕСТО'] as $removed)if(str_contains($work,$removed))$fail[]='Removed workplace block remains: '.$removed;
foreach(['k-master-r71-toolbar','k-exchange-r71','k-exchange-card--r71','График рабочего дня','k-schedule-slot--r71'] as $required)if(!str_contains($work.$exchange.$schedule,$required))$fail[]='R71 contract missing '.$required;
if(!str_contains($registry,'css/next/master_ui_exchange_schedule_flattening.css'))$fail[]='R71 stylesheet not registered';
foreach(['#k-mobile-nav','#k-desktop-nav','#k-shell-header','.k-menu-drawer','.k-context-switch'] as $f)if(str_contains($css,$f))$fail[]='R71 CSS targets frozen shell '.$f;
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.71 master UI exchange/schedule flattening: OK\n";
