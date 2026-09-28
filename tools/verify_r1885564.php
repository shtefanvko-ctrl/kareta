<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
$has=static function(string $file,string $needle)use($read,&$fail):void{if(!str_contains($read($file),$needle))$fail[]=$file.': missing '.$needle;};
foreach(['docs/releases/changelog/CHANGELOG_R188_5_5_6_4.md','docs/releases/deploy/DEPLOY_R188_5_5_6_4.md','tools/test_r1885564_schema_recovery.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;
$release='r1885565-serialized-schema-index-recovery';
foreach(['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'] as $file)$has($file,$release);
$has('index.php',"\$cacheEpoch = 'r1885565-serialized-schema-index-recovery'");
$migration=$root.'/api/migrations/098_role_workspaces_completion.php';
if(!is_file($migration)||hash_file('sha256',$migration)!=='02a2d591dbc6eb68733177da1b79283f0c0e2b44f66d11ae37f26dd7725c3a0d')$fail[]='migration_98_checksum';
$bootstrap=$read('api/bootstrap.php');
$start=strpos($bootstrap,'function kareta_prepare_migration_98_dashboard_layout_compatibility');
$end=$start===false?false:strpos($bootstrap,"\nfunction kareta_migrate",$start);
$helper=($start!==false&&$end!==false)?substr($bootstrap,$start,$end-$start):'';
foreach(['DROP FOREIGN KEY','dashboard_layout_preferences_recovery','migration_98_duplicate_scope','DROP INDEX `uq_dashboard_layout`','ADD CONSTRAINT','idx_dashboard_layout_account_fk','uq_dashboard_layout_scope'] as $needle)if(!str_contains($helper,$needle))$fail[]='recovery helper: '.$needle;
$fkDrop=strpos($helper,'DROP FOREIGN KEY');$legacyDrop=strpos($helper,'DROP INDEX `uq_dashboard_layout`');$fkAdd=strpos($helper,'ADD CONSTRAINT');
if($fkDrop===false||$legacyDrop===false||$fkAdd===false||!($fkDrop<$legacyDrop&&$legacyDrop<$fkAdd))$fail[]='recovery_order';
foreach(['failureStage','failedMigrationVersion','diagnosticCode'] as $needle){$has('api/runtime_diagnostics.php',$needle);$has('api/db.php',$needle);$has('js/next/runtime_logger.js',$needle);}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.4 verifier OK".PHP_EOL;
