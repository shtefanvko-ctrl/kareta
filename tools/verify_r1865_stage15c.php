<?php
declare(strict_types=1);
$root=dirname(__DIR__);$errors=[];
$role=(string)@file_get_contents($root.'/js/next/role_access.js');
$app=(string)@file_get_contents($root.'/js/next/app_next.js');
$css=(string)@file_get_contents($root.'/css/next/app_next.css');
$checks=[
 'version'=>str_contains((string)@file_get_contents($root.'/inc/asset_version.php'),'20260805-r1865-stage15c-frontend-legacy-removal'),
 'identity active'=>str_contains($role,"snapshot.authenticated === true && snapshot.mode === 'identity'"),
 'forced isolated'=>str_contains($role,'forced role is intentionally ignored while Identity is authoritative'),
 'clear override'=>str_contains($role,'clearLegacyOverride'),
 'app identity authority'=>str_contains($app,'Identity Context is authoritative'),
 'legacy css isolated'=>str_contains($css,'data-identity-mode="legacy-fallback"'),
 'docs'=>is_file($root.'/docs/identity/STAGE_15C_FRONTEND_LEGACY_REMOVAL.md'),
];
foreach($checks as $name=>$ok) if(!$ok)$errors[]=$name;
if($errors){fwrite(STDERR,"Stage15C FAIL: ".implode(', ',$errors).PHP_EOL);exit(1);}echo "R186.5 Stage15C verifier OK\n";
