<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$errors=[];
$bootstrap=(string)@file_get_contents($root.'/api/bootstrap.php');
$m90=(string)@file_get_contents($root.'/api/migrations/090_context_members_status_hotfix.php');
$config=(string)@file_get_contents($root.'/config.php');
$asset=(string)@file_get_contents($root.'/inc/asset_version.php');
if(!str_contains($bootstrap,'kareta_prepare_migration_82_context_member_compatibility'))$errors[]='compat helper';
if(!str_contains($bootstrap,'`status`=`membership_status`'))$errors[]='status backfill';
if(!str_contains($m90,'DROP COLUMN `status`'))$errors[]='cleanup';
if(!preg_match("/KARETA_DB_VERSION',\s*(\d+)/",$config,$m)||((int)($m[1]??0))<90)$errors[]='db version';
if(!preg_match('/r(?:187(?:1-context-members-hotfix|[2-9][0-9]*-[a-z0-9-]+)|18[8-9][0-9]*-[a-z0-9-]+)/i',$asset))$errors[]='asset version';
if($errors){fwrite(STDERR,'R187.1 verifier failed: '.implode(', ',$errors).PHP_EOL);exit(1);}
echo "R187.1 verifier OK\n";
