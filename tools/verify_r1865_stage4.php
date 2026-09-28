<?php
$root=dirname(__DIR__);$errors=[];
$need=['api/migrations/075_identity_session_core.php','api/identity/account_service.php','api/identity/profile_service.php','api/identity/session_service.php','api/identity/challenge_service.php','api/identity_session.php','docs/identity/STAGE_04_SESSION_CORE.md'];
foreach($need as $f)if(!is_file($root.'/'.$f))$errors[]='missing:'.$f;
$config=(string)@file_get_contents($root.'/config.php');if(!preg_match("/define\('KARETA_DB_VERSION',\s*(\d+)\);/",$config,$m)||((int)$m[1])<75)$errors[]='db_version';
$asset=(string)@file_get_contents($root.'/inc/asset_version.php');if(!str_contains($asset,'20260803-r1865-stage'))$errors[]='asset_version';
$api=(string)@file_get_contents($root.'/api/identity_session.php').(string)@file_get_contents($root.'/api/identity/session_service.php');foreach(['requestCode','verifyCode','ensureClient','httponly'] as $x)if(!str_contains($api,$x))$errors[]='api:'.$x;
echo $errors?"FAIL\n".implode("\n",$errors)."\n":"OK R186.5 Stage 4\n";exit($errors?1:0);
