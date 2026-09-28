<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
$has=static function(string $file,string $needle)use($read,&$fail):void{if(!str_contains($read($file),$needle))$fail[]=$file.': missing '.$needle;};
foreach(['docs/releases/changelog/CHANGELOG_R188_5_5_6_12.md','docs/releases/deploy/DEPLOY_R188_5_5_6_12.md','docs/releases/plans/PLAN_R188_5_5_6_13_POST_RECOVERY_ACCEPTANCE.md'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;
$release='r1885572-private-db-config-recovery';
foreach(['inc/asset_version.php','sw.js','js/next/core/realtime_client.js','index.php'] as $file)$has($file,$release);
foreach(['KARETA_PRIVATE_CONFIG_FILE','parent_private_file','parent_kareta_private_file','DB_DATABASE','MYSQL_DATABASE','DB_USERNAME','MYSQL_USER','kareta_db_missing_config_fields','KARETA_DB_CONFIG_SOURCE','KARETA_DB_CONFIGURED'] as $needle)$has('config.php',$needle);
foreach(['Database configuration missing fields','configuration_missing','missingFields','kareta_db_missing_config_fields'] as $needle)$has('api/bootstrap.php',$needle);
foreach(['configurationSource','missingConfigurationFields'] as $needle)$has('api/runtime_diagnostics.php',$needle);
foreach(['databaseConfigurationPresent','databaseConfiguration','missingFields'] as $needle)$has('api/post_deploy_check.php',$needle);
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.12 verifier OK".PHP_EOL;
