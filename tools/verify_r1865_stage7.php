<?php
declare(strict_types=1);
$root=dirname(__DIR__);$errors=[];
$checks=[
 'identity frontend'=>is_file($root.'/js/next/identity_frontend.js'),
 'identity loaded before route'=>str_contains((string)@file_get_contents($root.'/js/next/app_next.js'),'KaretaIdentity?.load'),
 'new context api'=>str_contains((string)@file_get_contents($root.'/js/next/identity_frontend.js'),'/api/context/'),
 'capability route access'=>str_contains((string)@file_get_contents($root.'/js/next/role_access.js'),'KaretaDynamicNavigation'),
 'capability event navigation'=>str_contains((string)@file_get_contents($root.'/js/next/shell_nav.js'),'kareta:capabilities-changed'),
 'asset registry'=>str_contains((string)@file_get_contents($root.'/inc/asset_registry.php'),'js/next/identity_frontend.js'),
 'stage docs'=>is_file($root.'/docs/identity/STAGE_07_FRONTEND_IDENTITY.md'),
 'asset version'=>str_contains((string)@file_get_contents($root.'/inc/asset_version.php'),'r1865-stage'),
];
foreach($checks as $name=>$ok)if(!$ok)$errors[]=$name;
if($errors){fwrite(STDERR,"R186.5 Stage 7 FAILED: ".implode(', ',$errors).PHP_EOL);exit(1);}echo "R186.5 Stage 7 OK\n";
