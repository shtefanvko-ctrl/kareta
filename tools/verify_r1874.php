<?php
declare(strict_types=1);
$root=dirname(__DIR__);$errors=[];
$need=[
 'js/next/ui_icons.js'=>['heart','chevronRight','settings','community'],
 'css/next/icon_standard.css'=>['--k-icon-touch','aria-pressed'],
 'js/next/smart_action_hub.js'=>["icon:'chats'","icon:'settings'"],
 'docs/ui/ICON_SYSTEM_STANDARD.md'=>['grid','44×44'],
];
foreach($need as $file=>$tokens){$p="$root/$file";if(!is_file($p)){$errors[]="missing $file";continue;}$c=file_get_contents($p);foreach($tokens as $token)if(strpos($c,$token)===false)$errors[]="$file missing $token";}
$hub=file_get_contents("$root/js/next/smart_action_hub.js");foreach(['✉','🔔','🚗','★','☻','⚙'] as $glyph)if(strpos($hub,$glyph)!==false)$errors[]="legacy glyph in smart hub: $glyph";
$nav=file_get_contents("$root/js/next/navigation_core.js");foreach(['🧰','🛒','＋','⚙'] as $glyph)if(strpos($nav,$glyph)!==false)$errors[]="legacy glyph in navigation actions: $glyph";
$asset=file_get_contents("$root/inc/asset_registry.php");if(substr_count($asset,"js/next/ui_icons.js")!==1)$errors[]='ui_icons must be registered exactly once';
if(strpos($asset,"css/next/icon_standard.css")===false)$errors[]='icon standard css not registered';
if($errors){fwrite(STDERR,implode("\n",$errors)."\n");exit(1);}echo "R187.4 icon standard verifier OK\n";
