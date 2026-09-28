<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$need=['css/next/client_orders_native.css','tools/test_r1885606_client_orders_native.js','docs/releases/changelog/CHANGELOG_R188_5_5_6_46.md','tools/shell_freeze_manifest_r1885603.json'];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$page=@file_get_contents($root.'/js/next/pages/orders.js')?:'';$css=@file_get_contents($root.'/css/next/client_orders_native.css')?:'';$registry=@file_get_contents($root.'/inc/asset_registry.php')?:'';
foreach(['k-client-orders-native','data-client-order-status-filter="offers"','data-client-orders-filter-open','data-client-order-offers','data-client-order-actions','data-client-bid-confirm','data-client-bid-decline'] as $n)if(!str_contains($page,$n))$fail[]='orders native missing '.$n;
$start=strpos($page,'function renderClientOrders');$end=$start===false?false:strpos($page,'function renderOrders',$start+10);$client=($start!==false&&$end!==false)?substr($page,$start,$end-$start):'';
foreach(['k-client-exchange-board','<select','swiper'] as $n)if($client!==''&&str_contains($client,$n))$fail[]='client orders legacy control remains '.$n;
foreach(['grid-template-columns:repeat(2,minmax(0,1fr))','@media(max-width:760px)','.k-client-orders-dialog'] as $n)if(!str_contains($css,$n))$fail[]='orders css missing '.$n;
foreach(['#k-mobile-nav','#k-desktop-nav','#k-shell-header','.k-menu-drawer','.k-context-switch'] as $n)if(str_contains($css,$n))$fail[]='orders css targets frozen shell '.$n;
if(!str_contains($registry,'client_orders_native.css'))$fail[]='asset registry missing client orders css';
$manifest=json_decode((string)@file_get_contents($root.'/tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
foreach(['inc/asset_version.php','sw.js'] as $f){$d=@file_get_contents($root.'/'.$f)?:'';if(!str_contains($d,'r1885606-client-orders-native'))$fail[]=$f.' version missing';}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.46 client orders native + shell freeze: OK\n";
