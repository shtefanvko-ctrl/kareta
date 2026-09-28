<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
$has=static function(string $file,string $needle)use($read,&$fail):void{if(!str_contains($read($file),$needle))$fail[]=$file.': missing '.$needle;};
foreach(['docs/releases/changelog/CHANGELOG_R188_5_5_6_5.md','docs/releases/deploy/DEPLOY_R188_5_5_6_5.md','docs/releases/plans/PLAN_R188_5_5_6_6_POST_DEPLOY_DB_CONTRACT.md','tools/test_r1885565_schema_index_recovery.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;
$release='r1885565-serialized-schema-index-recovery';
foreach(['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'] as $file)$has($file,$release);
$has('index.php',"\$cacheEpoch = 'r1885565-serialized-schema-index-recovery'");
$bootstrap=$read('api/bootstrap.php');
foreach(['kareta_schema_bootstrap_','SELECT GET_LOCK(?, 30)','function kareta_relax_legacy_blank_unique_indexes','idx_clients_user_phone','idx_masters_user_phone','idx_parts_catalog_sku','db_migration_checksum_conflicts','function kareta_prepare_migration_99_more_menu_compatibility','function kareta_prepare_identity_collation_compatibility'] as $needle)if(!str_contains($bootstrap,$needle))$fail[]='bootstrap: '.$needle;
if(str_contains($bootstrap,"kareta_db_set_failure_context('bootstrap.ensure_schema.pre_migration')"))$fail[]='pre-migration ensure still enabled';
if(str_contains($bootstrap,"throw new RuntimeException('Applied migration checksum mismatch"))$fail[]='checksum mismatch still blocking';
$create=strpos($bootstrap,"kareta_db_set_failure_context('bootstrap.create_schema')");
$migrate=strpos($bootstrap,"kareta_db_set_failure_context('bootstrap.migrate')");
$post=strpos($bootstrap,"kareta_db_set_failure_context('bootstrap.ensure_schema.post_migration')");
if($create===false||$migrate===false||$post===false||!($create<$migrate&&$migrate<$post))$fail[]='bootstrap order';
foreach(['failureCategory','failureSqlState','failureDriverCode'] as $needle){$has('api/runtime_diagnostics.php',$needle);$has('api/auth_session.php',$needle);$has('api/onboarding_code.php',$needle);$has('js/next/onboarding/onboarding_api.js',$needle);$has('js/next/runtime_logger.js',$needle);}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.5 verifier OK".PHP_EOL;
