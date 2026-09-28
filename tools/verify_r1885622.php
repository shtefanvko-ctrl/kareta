<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];$read=static fn(string $f)=>(string)@file_get_contents($root.'/'.$f);
$need=['docs/releases/changelog/CHANGELOG_R188_5_5_6_62.md','docs/releases/plans/PLAN_R188_5_5_6_63_SELLER_PROFILE_STOREFRONT_NATIVE.md','css/next/seller_native_workplace.css','tools/test_r1885622_seller_native_workplace.js','tools/shell_freeze_manifest_r1885603.json'];foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$config=$read('config.php');$page=$read('js/next/pages/seller.js');$api=$read('api/seller_shop.php');$css=$read('css/next/seller_native_workplace.css');$registry=$read('inc/asset_registry.php');$asset=$read('inc/asset_version.php');$sw=$read('sw.js');
if(!preg_match("/KARETA_DB_VERSION',\s*(\d+)/",$config,$m)||(int)$m[1]!==115)$fail[]='R62 must keep DB version 115';
foreach(['data-seller-edit','data-seller-order-open','data-seller-order-dialog','data-seller-category-search','data-seller-attention','effectiveProductStatus','orderDetailContent','#/parts/item/'] as $t)if(!str_contains($page,$t))$fail[]='seller R62 missing '.$t;
if(preg_match('/<select\b/i',$page)||stripos($page,'swiper')!==false)$fail[]='seller R62 violates native UI contract';
foreach(['fitment_json','seller_order_items','delivery_address','delivery_price','comment'] as $t)if(!str_contains($api,$t))$fail[]='seller dashboard contract missing '.$t;
foreach(['.k-seller-attention-grid','.k-seller-quick-actions','.k-seller-category-search','.k-seller-order-dialog','height:100dvh'] as $t)if(!str_contains($css,$t))$fail[]='R62 CSS missing '.$t;
if(str_contains($css,'#k-mobile-nav')||str_contains($css,'#k-desktop-nav')||str_contains($css,'#k-menu-toggle'))$fail[]='R62 CSS alters Shell';
if(!str_contains($registry,'css/next/seller_native_workplace.css'))$fail[]='R62 stylesheet not registered';
if(!str_contains($asset,'r1885622-seller-native-workplace')||!str_contains($sw,'r1885622-seller-native-workplace'))$fail[]='R62 asset suffix missing';
$manifest=json_decode($read('tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.62 seller native workplace + product editor + order detail + Shell Freeze 2: OK\n";
