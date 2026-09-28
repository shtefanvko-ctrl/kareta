<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];$read=static fn(string $f)=>(string)@file_get_contents($root.'/'.$f);
$need=['docs/releases/changelog/CHANGELOG_R188_5_5_6_56.md','api/migrations/113_master_service_pricing_native.php','css/next/master_service_pricing_native.css','tools/test_r1885616_master_service_pricing_native.js','tools/shell_freeze_manifest_r1885603.json'];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$config=$read('config.php');$migration=$read('api/migrations/113_master_service_pricing_native.php');$page=$read('js/next/pages/service_management.js');$api=$read('api/catalog/service_catalog.php');$db=$read('api/db.php');$client=$read('js/next/services/service_offers_api.js');$details=$read('js/next/pages/details.js');$css=$read('css/next/master_service_pricing_native.css');$registry=$read('inc/asset_registry.php');
if(!preg_match("/KARETA_DB_VERSION',\s*(\d+)/",$config,$m)||((int)$m[1])<113)$fail[]='db version must be >=113';
foreach(["'version' => 113",'price_type','price_max','duration_max_min'] as $t)if(!str_contains($migration,$t))$fail[]='migration 113 missing '.$t;
foreach(["NATIVE_SERVICE_CONTRACT = 'R188.5.5.6.56'",'k-service-native-summary','k-service-native-specialties','data-service-open-add','data-service-open-filter','data-service-edit-dialog','data-service-remove-dialog','data-service-choice="priceType"','Фиксированная','По договорённости','Сферы работы'] as $t)if(!str_contains($page,$t))$fail[]='Native services UI missing '.$t;
if(str_contains($page,'<select')||str_contains($page,'Swiper'))$fail[]='Native services select/Swiper violation';
foreach(['priceType','priceMax','durationMaxMin','agreement','range'] as $t)if(!str_contains($api,$t))$fail[]='service API contract missing '.$t;
if(!str_contains($api,'kareta_resolve_api_actor'))$fail[]='service actor is not Identity-aware';
foreach(["'services.manageOwn'",'serviceOffers.mine','serviceOffers.save','serviceOffers.delete'] as $t)if(!str_contains($db,$t))$fail[]='service capability/API action missing '.$t;
foreach(['priceType','priceMax','durationMaxMin'] as $t)if(!str_contains($client,$t))$fail[]='frontend offer normalization missing '.$t;
foreach(['servicePriceLabel','serviceDurationLabel','service_category_name'] as $t)if(!str_contains($details,$t))$fail[]='public profile pricing/specialization missing '.$t;
if(!str_contains($css,'height:100dvh')||!str_contains($css,'@media(max-width:700px)'))$fail[]='mobile full-screen modal contract missing';
if(str_contains($css,'scroll-snap-type'))$fail[]='horizontal slider CSS forbidden';
if(!str_contains($registry,'css/next/master_service_pricing_native.css'))$fail[]='R56 CSS unregistered';
foreach(['inc/asset_version.php','sw.js'] as $f)if(!str_contains($read($f),'r1885616-master-service-pricing-native'))$fail[]=$f.' release suffix missing';
$manifest=json_decode($read('tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.56 Native service pricing + Identity capability + shell freeze: OK\n";
