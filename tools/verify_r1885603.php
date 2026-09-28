<?php
declare(strict_types=1);
$root=dirname(__DIR__);$errors=[];
$core=file_get_contents($root.'/js/next/navigation_core.js')?:'';
$shell=file_get_contents($root.'/js/next/shell_nav.js')?:'';
$menu=file_get_contents($root.'/js/next/shell_menu.js')?:'';
$version=file_get_contents($root.'/inc/asset_version.php')?:'';
$sw=file_get_contents($root.'/sw.js')?:'';
foreach([
 "organization_service: Object.freeze(['stoDashboard','orders','masters','workflow','serviceManagement','finance','parts','chats','cabinet'])",
 "seller: Object.freeze(['seller','sellerProducts','sellerOrders','market','finance','parts','chats','cabinet'])",
 "organization_store: Object.freeze(['seller','sellerProducts','sellerOrders','market','finance','parts','chats','cabinet'])",
 "organization: Object.freeze(['orders','workflow','calendarBooking','finance','crm','chats','cabinet'])",
] as $needle){if(!str_contains($core,$needle))$errors[]='missing role desktop contract: '.$needle;}
foreach([
 "workflow:'Производство'",
 "finance:'Выручка / KPI'",
 "market:'Склад'",
] as $needle){if(!str_contains($shell,$needle))$errors[]='missing contextual label: '.$needle;}
foreach([
 "desktopPrimary=new Set(window.KaretaNavigationCore?.desktopItems?.()||[])",
 "section.keys.filter(key=>!desktopPrimary.has(key))",
] as $needle){if(!str_contains($menu,$needle))$errors[]='missing drawer de-dup: '.$needle;}
if(!str_contains($version,'r1885603-role-desktop-menu-completion'))$errors[]='asset version missing r1885603';
if(!str_contains($sw,'r1885603-role-desktop-menu-completion'))$errors[]='service worker missing r1885603';
if($errors){fwrite(STDERR,json_encode(['ok'=>false,'errors'=>$errors],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL);exit(1);}
echo json_encode(['ok'=>true,'release'=>'R188.5.5.6.43'],JSON_UNESCAPED_UNICODE).PHP_EOL;
