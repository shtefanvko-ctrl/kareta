<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];$read=static fn(string $f)=>(string)@file_get_contents($root.'/'.$f);
$need=['docs/releases/changelog/CHANGELOG_R188_5_5_6_55.md','tools/test_r1885615_master_workplace_native.js','css/next/master_workplace_native.css','tools/shell_freeze_manifest_r1885603.json'];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$page=$read('js/next/pages/master_workplace.js');$css=$read('css/next/master_workplace_native.css');$api=$read('api/master_workplace.php');$registry=$read('inc/asset_registry.php');
$r71=str_contains($page,"MASTER_UI_R71_CONTRACT='R188.5.5.6.71'");$r81=str_contains($page,"MASTER_WORKSPACE_R81_CONTRACT='R188.5.5.6.81'");
$tokens=$r81?["NATIVE_WORKPLACE_CONTRACT='R188.5.5.6.55'",'k-master-r81-toolbar','k-master-r81-commandbar','k-master-r81-operations','k-master-r81-operation-list','data-master-workspace-settings-dialog','data-master-status-dialog']:($r71?["NATIVE_WORKPLACE_CONTRACT='R188.5.5.6.55'",'k-master-r71-toolbar','k-master-native-next','k-master-native-actions','k-master-native-queue','k-master-native-upcoming','data-master-status-dialog']:["NATIVE_WORKPLACE_CONTRACT='R188.5.5.6.55'",'k-master-native-head','k-master-native-states','k-master-native-next','k-master-native-actions','k-master-native-queue','k-master-native-upcoming','data-master-status-dialog']);
foreach($tokens as $t)if(!str_contains($page,$t))$fail[]='native workplace missing '.$t;
if($r71&&(str_contains($page,'k-master-native-head')||str_contains($page,'k-master-native-states')))$fail[]='R71 removed workplace blocks returned';
foreach(['k-master-business-metrics','k-master-exchange-panel','data-master-response-form','k-master-schedule-embedded','Мой профиль','Мои публикации','Мои работы','Готовность профиля','Выручка за месяц'] as $t)if(str_contains($page,$t))$fail[]='workplace mixed surface remained '.$t;
foreach(['#/master/exchange','#/calendar','#/parts','#/chats','#/orders/new','#/orders'] as $t)if(!str_contains($page,$t))$fail[]='work action link missing '.$t;
if(str_contains($page,'<select')||str_contains($page,'Swiper'))$fail[]='Native workplace select/Swiper violation';
foreach(["'todayOrders'=>\$todayOrders","'activeOrders'=>\$active","'waitingOrders'=>\$waiting","'completedToday'=>\$completedToday","'timers'=>\$timers"] as $t)if(!str_contains($api,$t))$fail[]='shift API missing '.$t;
if(!str_contains($css,'@media(max-width:600px)')||!str_contains($css,'height:100dvh'))$fail[]='mobile status modal contract missing';
if(str_contains($css,'scroll-snap-type'))$fail[]='horizontal slider CSS forbidden';
if(!str_contains($registry,'css/next/master_workplace_native.css'))$fail[]='R55 CSS unregistered';
foreach(['inc/asset_version.php','sw.js'] as $f)if(!str_contains($read($f),'r1885615-master-workplace-native'))$fail[]=$f.' version missing';
$manifest=json_decode($read('tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.55 Master workplace Native UI + shell freeze: OK\n";
