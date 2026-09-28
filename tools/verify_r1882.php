<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$need=['api/migrations/095_admin_operations_moderation.php','api/admin_operations.php','js/next/pages/admin_workspaces.js','docs/releases/changelog/CHANGELOG_R188_2.md'];foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing:'.$f;
$config=(string)@file_get_contents($root.'/config.php');if(!preg_match("/KARETA_DB_VERSION',\s*(9[5-9]|[1-9][0-9]{2,})/",$config))$fail[]='db_version';
$api=(string)@file_get_contents($root.'/api/admin_operations.php');foreach(['setAccountStatus','revokeSessions','setProfileStatus','setContextStatus','setOrganizationStatus','setMembershipStatus','createModerationCase','resolveModerationCase','admin_operation_audit'] as $x)if(!str_contains($api,$x))$fail[]='api:'.$x;
$js=(string)@file_get_contents($root.'/js/next/pages/admin_workspaces.js');foreach(['data-admin-page="users"','data-admin-page="organizations"','data-admin-page="monitoring"','data-admin-page="management"','createModerationCase'] as $x)if(!str_contains($js,$x))$fail[]='ui:'.$x;
if($fail){fwrite(STDERR,implode("\n",$fail)."\n");exit(1);}echo "R188.2 admin operations verifier OK\n";
