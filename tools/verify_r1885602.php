<?php
declare(strict_types=1);
$root=dirname(__DIR__);$errors=[];
$core=file_get_contents($root.'/js/next/navigation_core.js')?:'';
$shell=file_get_contents($root.'/js/next/shell_nav.js')?:'';
$version=file_get_contents($root.'/inc/asset_version.php')?:'';
$sw=file_get_contents($root.'/sw.js')?:'';
foreach([
 "const DESKTOP_TEMPLATES = Object.freeze({",
 "personal: Object.freeze(['home','services','community','masters','parts','orders','chats','cabinet'])",
 "master: Object.freeze(['masterDashboard','masterExchange','orders','community','parts','serviceManagement','chats','cabinet'])",
 'function desktopItems(kind=contextKind())',
 'desktop:desktopItems()',
] as $needle){if(!str_contains($core,$needle))$errors[]='missing contextual desktop contract: '.$needle;}
foreach([
 "window.KaretaNavigationCore?.desktopItems?.()||navigation.items('desktop')",
 "personal:{orders:'Заявки',cabinet:'Аккаунт'}",
 "master:{masterDashboard:'Рабочее место',masterExchange:'Биржа',orders:'Заявки'",
] as $needle){if(!str_contains($shell,$needle))$errors[]='missing shell desktop contract: '.$needle;}
if(str_contains($shell,"const desktop=navigation.items('desktop');const mobile="))$errors[]='generic desktop navigation is still authoritative';
if(!str_contains($version,'r1885602-contextual-desktop-navigation'))$errors[]='asset version missing r1885602';
if(!str_contains($sw,'r1885602-contextual-desktop-navigation'))$errors[]='service worker missing r1885602';
if($errors){fwrite(STDERR,json_encode(['ok'=>false,'errors'=>$errors],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL);exit(1);}
echo json_encode(['ok'=>true,'release'=>'R188.5.5.6.42'],JSON_UNESCAPED_UNICODE).PHP_EOL;
