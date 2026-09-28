<?php
declare(strict_types=1);
$root=dirname(__DIR__);$errors=[];
$must=[
 'api/migrations/076_identity_session_rotation.php',
 'api/identity/session_service.php',
 'api/identity_session.php',
 'docs/identity/STAGE_05_SESSION_ROTATION.md',
 'docs/releases/changelog/CHANGELOG_R186_5_STAGE5.md'
];
foreach($must as $f)if(!is_file($root.'/'.$f))$errors[]='missing '.$f;
$svc=(string)@file_get_contents($root.'/api/identity/session_service.php');
foreach(['ROTATE_AFTER_HOURS','GRACE_SECONDS','rotateCurrent','rotation_grace_until','absolute_expires_at','idle_expires_at'] as $x)if(!str_contains($svc,$x))$errors[]='session service '.$x;
$api=(string)@file_get_contents($root.'/api/identity_session.php');if(!str_contains($api,"action==='rotate'"))$errors[]='rotate endpoint';
$config=(string)@file_get_contents($root.'/config.php');if(!preg_match("/define\('KARETA_DB_VERSION',\s*(\d+)\);/",$config,$m)||((int)$m[1])<76)$errors[]='db version';
$asset=(string)@file_get_contents($root.'/inc/asset_version.php');if(!preg_match('/20260803-r1865-stage(?:[5-9]|1[0-5])|20260803-r186[6-9]/',$asset))$errors[]='asset version';
if($errors){fwrite(STDERR,"R186.5 stage5 FAIL\n- ".implode("\n- ",$errors)."\n");exit(1);}echo "R186.5 stage5 OK\n";
