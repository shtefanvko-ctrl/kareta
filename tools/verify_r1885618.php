<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];$read=static fn(string $f)=>(string)@file_get_contents($root.'/'.$f);
$need=[
 'docs/releases/changelog/CHANGELOG_R188_5_5_6_58.md',
 'api/migrations/114_parts_native_marketplace.php',
 'css/next/parts_native_marketplace.css',
 'tools/test_r1885618_parts_native_marketplace.js',
 'tools/shell_freeze_manifest_r1885603.json'
];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$config=$read('config.php');$migration=$read('api/migrations/114_parts_native_marketplace.php');$page=$read('js/next/pages/parts.js');$used=$read('api/used_market.php');$seller=$read('api/seller_shop.php');$order=$read('js/next/pages/work_order.js');$css=$read('css/next/parts_native_marketplace.css');$registry=$read('inc/asset_registry.php');$r59=str_contains($read('inc/asset_version.php'),'r1885619-parts-window-lists-product-detail');
if(!preg_match("/KARETA_DB_VERSION',\s*(\d+)/",$config,$m)||((int)$m[1])<114)$fail[]='db version must be >=114';
foreach(["'version' => 114",'condition_code','exchange_available','exchange_note','listing_type','source_vehicle_id'] as $t)if(!str_contains($migration,$t))$fail[]='migration 114 missing '.$t;
foreach(["new:{label:'Новые'","used:{label:'БУ'","restored:{label:'Восстановленные'","exchange:{label:'Обмен'",'data-parts-filter-dialog','data-parts-vehicle-dialog','data-used-form-dialog','data-parts-categories','clientCabinet.get'] as $t)if(!str_contains($page,$t))$fail[]='parts native page missing '.$t;if($r59){if(!str_contains($page,'data-parts-market-list-dialog'))$fail[]='R59 list window missing';if(str_contains($page,'data-parts-types'))$fail[]='R59 main type selector must be removed';}elseif(!str_contains($page,'data-parts-types'))$fail[]='R58 type selector missing';
if(preg_match('/<select\b/i',$page))$fail[]='active parts page must not contain select';
if(stripos($page,'swiper')!==false)$fail[]='active parts page must not contain Swiper';
foreach(['listing_type','source_vehicle_id','exchange_note','parts.browse','kareta_require_api_capability'] as $t)if(!str_contains($used,$t))$fail[]='used market server missing '.$t;
foreach(['condition_code','exchange_available','exchange_note'] as $t)if(!str_contains($seller,$t))$fail[]='seller catalog missing '.$t;
if(!str_contains($order,'#/parts?orderId=')||!str_contains($order,'Найти в Marketplace'))$fail[]='work order marketplace bridge missing';
foreach(['grid-template-columns:repeat(2,minmax(0,1fr))','grid-template-columns:1fr','height:100dvh'] as $t)if(!str_contains($css,$t))$fail[]='parts native CSS missing '.$t;
if(str_contains($css,'#k-mobile-nav')||str_contains($css,'#k-desktop-nav')||str_contains($css,'#k-menu-toggle'))$fail[]='parts CSS must not alter Shell';
if(!str_contains($registry,'css/next/parts_native_marketplace.css'))$fail[]='R58 CSS not registered';
foreach(['inc/asset_version.php','sw.js'] as $f)if(!str_contains($read($f),'r1885618-parts-native-marketplace'))$fail[]=$f.' release suffix missing';
$manifest=json_decode($read('tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.58 parts native marketplace + migration 114 + Shell Freeze 2: OK\n";
