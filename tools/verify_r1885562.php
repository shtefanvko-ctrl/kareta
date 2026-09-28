<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
$has=static function(string $file,string $needle)use($read,&$fail):void{if(!str_contains($read($file),$needle))$fail[]=$file.': missing '.$needle;};
foreach(['docs/releases/changelog/CHANGELOG_R188_5_5_6_2.md','docs/releases/deploy/DEPLOY_R188_5_5_6_2.md','tools/test_r1885562_identity_db_recovery.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;
$release='r1885562-identity-db-recovery';
foreach(['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'] as $file)$has($file,$release);
$has('js/next/production_guard.js','action=ping&identity_probe=');
$has('js/next/production_guard.js','ping.dbReady!==true');
$has('js/next/app_next.js',"if(!state.user && !state.identity?.authenticated)");
$has('api/bootstrap.php',"'configuration_missing'");
$has('api/bootstrap.php',"'pdo_mysql_missing'");
$has('api/bootstrap.php',"'connection_failed'");
$has('js/next/runtime_logger.js','Date.now()-diagnosticLastAt<30000');
$has('index.php', '$cacheEpoch = \'r188556');
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.2 verifier OK".PHP_EOL;
