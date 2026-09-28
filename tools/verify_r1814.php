<?php
declare(strict_types=1);
$root=dirname(__DIR__);$errors=[];
$checks=[
 'js/next/core/state_manager.js'=>['entities:{byRef:{}','selectors=Object.freeze','setEntityGraph'],
 'js/next/core/ui_kit.js'=>['const skeleton=','const timeline=','const tabs='],
 'js/next/pages/core_platform.js'=>['R181.4 UNIFIED FRONTEND CORE','ui().skeleton','store().setEntityGraph'],
 'css/next/core_platform.css'=>['R181.4 unified frontend core','.k-ui-timeline','.k-ui-skeleton'],
 'inc/asset_version.php'=>['20260803-r1861-realtime-stability'],
];
foreach($checks as $file=>$needles){$path="$root/$file";if(!is_file($path)){$errors[]="missing:$file";continue;}$text=file_get_contents($path);foreach($needles as $n)if(!str_contains($text,$n))$errors[]="$file:$n";}
if($errors){fwrite(STDERR,implode("\n",$errors)."\n");exit(1);}echo "R181.4 OK\n";
