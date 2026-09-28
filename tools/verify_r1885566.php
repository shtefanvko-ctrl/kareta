<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
$has=static function(string $file,string $needle)use($read,&$fail):void{if(!str_contains($read($file),$needle))$fail[]=$file.': missing '.$needle;};
foreach(['docs/releases/changelog/CHANGELOG_R188_5_5_6_6.md','docs/releases/deploy/DEPLOY_R188_5_5_6_6.md','docs/security/SECURITY_R188_5_5_6_6_TEST_OTP.md','tools/test_r1885566_test_otp_transport.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;
$release='r1885566-test-otp-transport-recovery';
foreach(['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'] as $file)$has($file,$release);
$has('index.php',"\$cacheEpoch = 'r1885566-test-otp-transport-recovery'");
$config=$read('config.php');
if(str_contains($config,'Production lock: professional account types')||str_contains($config,'Never expose or fall back to a static OTP in production')){
  foreach(["\$kareta_is_production ? 'webhook' : 'test_static'","\$kareta_is_production ? '' : '0000'","\$kareta_otp_allow_test_fallback = false"] as $needle)$has('config.php',$needle);
  foreach(["'otp_transport' => 'webhook'","'otp_test_code' => ''","'otp_allow_test_fallback' => false"] as $needle)$has('config.private.example.php',$needle);
}else foreach(["'otp_transport', 'test_static'","'otp_test_code', '0000'","'otp_allow_test_fallback', true"] as $needle)$has('config.php',$needle);
foreach(['effectiveTransport','configuredTestCode','allow_test_fallback','deliveryMode','codeLength','testMode','testCode','random_int(100000,999999)','password_hash($code,PASSWORD_DEFAULT)'] as $needle)$has('api/identity/challenge_service.php',$needle);
foreach(['api/auth_session.php','api/onboarding_code.php','api/db.php'] as $file)foreach(['deliveryMode','codeLength','testMode','testCode'] as $needle)$has($file,$needle);
foreach(['otpDeliveryMode','otpCodeLength','otpTestMode','otpTestCode','Тестовый режим: SMS не отправляется. Введите код','maxlength="${codeLength}"'] as $needle)$has('js/next/onboarding/pages/role_page.js',$needle);
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.6 verifier OK".PHP_EOL;
