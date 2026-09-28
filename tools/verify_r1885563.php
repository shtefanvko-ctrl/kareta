<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
$has=static function(string $file,string $needle)use($read,&$fail):void{if(!str_contains($read($file),$needle))$fail[]=$file.': missing '.$needle;};
foreach(['docs/releases/changelog/CHANGELOG_R188_5_5_6_3.md','docs/releases/deploy/DEPLOY_R188_5_5_6_3.md','tools/test_r1885563_migration_onboarding_recovery.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;
$release='r1885563-migration98-onboarding-recovery';
foreach(['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'] as $file)$has($file,$release);
$has('index.php', '$cacheEpoch = \'r1885565-serialized-schema-index-recovery\'');
$has('api/bootstrap.php','idx_dashboard_layout_account_fk');
$has('api/bootstrap.php',"'schema_or_migration_failed' => 'schema_initialization_failed'");
$has('api/auth_session.php',"'recoveryAction'=>kareta_db_public_recovery_action");
$has('api/db.php', "'databaseState'=>\$databaseState");
$has('js/next/onboarding/onboarding_api.js','function shouldUseDedicatedGateway');
$has('js/next/onboarding/onboarding_api.js','[404,405,501].includes(status)');
$has('js/next/runtime_logger.js','schema_initialization_failed');
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.3 verifier OK".PHP_EOL;
