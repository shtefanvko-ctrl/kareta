<?php
$root=dirname(__DIR__);$errors=[];
$cli=(string)@file_get_contents($root.'/tools/identity_migrate.php');
$checks=[
 'migration'=>is_file($root.'/api/migrations/083_identity_migration_engine.php'),
 'service'=>is_file($root.'/api/identity/identity_migration_service.php'),
 'cli'=>is_file($root.'/tools/identity_migrate.php'),
 'docs'=>is_file($root.'/docs/identity/STAGE_14A_IDENTITY_MIGRATION_ENGINE.md'),
 'db version'=>preg_match("/KARETA_DB_VERSION',\\s*(8[3-9]|9[0-9]|[1-9][0-9]{2,})/",(string)@file_get_contents($root.'/config.php')),
 'asset version'=>preg_match('/(?:r186[5-9]|r18[7-9][0-9]*)-/',(string)@file_get_contents($root.'/inc/asset_version.php'))===1,
 'dry run default'=>str_contains($cli,"'dry-run'"),
 'fingerprint'=>str_contains((string)@file_get_contents($root.'/api/identity/identity_migration_service.php'),'identity_legacy_links'),
 'conflicts'=>str_contains((string)@file_get_contents($root.'/api/identity/identity_migration_service.php'),'identity_migration_conflicts'),
];
foreach($checks as $k=>$ok)if(!$ok)$errors[]=$k;
if($errors){fwrite(STDERR,'Stage 14A FAILED: '.implode(', ',$errors).PHP_EOL);exit(1);}echo "Stage 14A OK\n";
