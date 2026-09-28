<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];$read=static fn(string $f)=>(string)@file_get_contents($root.'/'.$f);
$need=[
 'docs/releases/changelog/CHANGELOG_R188_5_5_6_63.md',
 'docs/releases/plans/PLAN_R188_5_5_6_64_SELLER_OPERATIONS_POLISH.md',
 'css/next/seller_profile_storefront_native.css',
 'api/migrations/116_seller_storefront_profile.php',
 'tools/test_r1885623_seller_profile_storefront_native.js',
 'tools/shell_freeze_manifest_r1885603.json',
];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$config=$read('config.php');$page=$read('js/next/pages/seller.js');$details=$read('js/next/pages/details.js');$api=$read('api/seller_shop.php');$public=$read('api/catalog_details.php');$css=$read('css/next/seller_profile_storefront_native.css');$registry=$read('inc/asset_registry.php');$asset=$read('inc/asset_version.php');$sw=$read('sw.js');$routes=$read('js/next/route_registry.js');
if(!preg_match("/KARETA_DB_VERSION',\s*(\d+)/",$config,$m)||(int)$m[1]!==116)$fail[]='R63 expected DB version 116';
foreach(['data-seller-profile-form','data-seller-restore','data-seller-stock-delta','data-seller-order-search','openOrderChat','client_user_id'] as $t)if(!str_contains($page,$t))$fail[]='seller R63 missing '.$t;
if(preg_match('/<select\b/i',$page)||stripos($page,'swiper')!==false)$fail[]='seller R63 violates native UI contract';
foreach(['shop_storefront','seller_product_restore','seller_product_stock','archivedProducts','category_labels','moderation_reason'] as $t)if(!str_contains($api,$t))$fail[]='seller R63 API missing '.$t;
if(str_contains($public,'sp.contact_phone')||str_contains($public,'sp.email'))$fail[]='public product API exposes seller contacts';
foreach(['mountStore','data-storefront-chat','openSupportChat'] as $t)if(!str_contains($details,$t))$fail[]='storefront R63 missing '.$t;
if(!str_contains($routes,"^#\\/parts\\/store\\/[^/]+$/.test(hash)) return 'productDetail'"))$fail[]='storefront route must remain under productDetail';
foreach(['.k-seller-profile-summary','.k-seller-stock-quick','.k-seller-archive-card','.k-storefront-hero','.k-storefront-products','height:100dvh'] as $t)if(!str_contains($css,$t))$fail[]='R63 CSS missing '.$t;
if(str_contains($css,'#k-mobile-nav')||str_contains($css,'#k-desktop-nav')||str_contains($css,'#k-menu-toggle'))$fail[]='R63 CSS alters Shell';
if(!str_contains($registry,'css/next/seller_profile_storefront_native.css'))$fail[]='R63 stylesheet not registered';
if(!str_contains($asset,'r1885623-seller-profile-storefront-native')||!str_contains($sw,'r1885623-seller-profile-storefront-native'))$fail[]='R63 asset suffix missing';
$manifest=json_decode($read('tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.63 seller profile/storefront/archive/stock/order-chat + Shell Freeze 2: OK\n";
