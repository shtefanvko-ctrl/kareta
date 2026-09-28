<?php
declare(strict_types=1);
$root=dirname(__DIR__);$errors=[];
$checks=[
 'version'=>preg_match('/2026080[5-9]-(?:r186[6-9]|r18[7-9][0-9]*)-[a-z0-9-]+/',(string)@file_get_contents($root.'/inc/asset_version.php'))===1,
 'db88'=>preg_match("/KARETA_DB_VERSION',\s*(8[8-9]|9[0-9]|[1-9][0-9]{2,})/",(string)@file_get_contents($root.'/config.php'))===1,
 'migration'=>is_file($root.'/api/migrations/088_identity_production_hardening.php'),
 'health'=>is_file($root.'/api/identity_health.php'),
 'guard'=>is_file($root.'/js/next/production_guard.js'),
 'registry'=>str_contains((string)@file_get_contents($root.'/inc/asset_registry.php'),'js/next/production_guard.js'),
 'read_only_get'=>str_contains((string)@file_get_contents($root.'/api/identity_session.php'),'current(false)'),
 'device_cookie'=>str_contains((string)@file_get_contents($root.'/api/identity/session_service.php'),"DEVICE_COOKIE='kareta_device'"),
];
foreach($checks as $k=>$ok)if(!$ok)$errors[]=$k;
if($errors){fwrite(STDERR,'R186.6 verifier failed: '.implode(', ',$errors).PHP_EOL);exit(1);}echo "R186.6 verifier OK\n";
