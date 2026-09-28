<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];$read=static fn(string $f)=>(string)@file_get_contents($root.'/'.$f);
$need=['docs/releases/changelog/CHANGELOG_R188_5_5_6_64.md','docs/releases/plans/PLAN_R188_5_5_6_64_MASTER_REQUESTS_WORKPLACE_SERVICES.md','docs/releases/plans/PLAN_R188_5_5_6_65_MASTER_EXCHANGE_ACCEPTANCE_FLOW.md','css/next/master_requests_workplace_services.css','api/migrations/117_master_requests_workplace_services.php','tools/test_r1885624_master_requests_workplace_services.js','tools/shell_freeze_manifest_r1885603.json'];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$config=$read('config.php');$dispatch=$read('api/production_dispatch.php');$workApi=$read('api/master_workplace.php');$work=$read('js/next/pages/master_workplace.js');$cabinet=$read('js/next/pages/cabinet.js');$services=$read('js/next/pages/service_management.js');$css=$read('css/next/master_requests_workplace_services.css');$registry=$read('inc/asset_registry.php');$asset=$read('inc/asset_version.php');$sw=$read('sw.js');
if(!preg_match("/KARETA_DB_VERSION',\s*(\d+)/",$config,$m)||(int)$m[1]!==117)$fail[]='R64 expected DB version 117';
if(str_contains($dispatch,"if(empty(\$score['eligible'])&&\$tab==='new')continue"))$fail[]='R64 still hides unmatched exchange requests';
foreach(['serviceMatched','kareta_master_workplace_preferences_save','master_workplace_preferences'] as $t)if(!str_contains($workApi,$t))$fail[]='workplace API missing '.$t;
foreach(['ДОСТУПНЫЕ ЗАЯВКИ','Настроить окна','Мои услуги','autoRefreshSec'] as $t)if(!str_contains($work,$t))$fail[]='workplace UI missing '.$t;
foreach(['masterWorkplaceSettings','master_window_${key}','master_exchange_limit','master_compact_cards'] as $t)if(!str_contains($cabinet,$t))$fail[]='master settings missing '.$t;
foreach(['renderMasterServiceManagement','data-master-category-toggle','data-master-service-enabled','data-master-service-price','data-master-service-duration','Моя цена, ₸','Моё время, мин','priceTouched','keepPrice','keepDuration'] as $t)if(!str_contains($services,$t))$fail[]='My Services missing '.$t;
foreach(['.k-master-native-exchange','.k-master-workplace-settings','.k-master-services-matrix','.k-master-service-own-fields'] as $t)if(!str_contains($css,$t))$fail[]='R64 CSS missing '.$t;
if(str_contains($css,'#k-mobile-nav')||str_contains($css,'#k-desktop-nav')||str_contains($css,'#k-menu-toggle'))$fail[]='R64 CSS alters Shell';
if(!str_contains($registry,'css/next/master_requests_workplace_services.css'))$fail[]='R64 stylesheet not registered';
if(!str_contains($asset,'r1885624-master-requests-workplace-services')||!str_contains($sw,'r1885624-master-requests-workplace-services'))$fail[]='R64 asset suffix missing';
$manifest=json_decode($read('tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.64 master requests/workplace/services + Shell Freeze 2: OK\n";
