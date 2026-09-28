<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
$has=static function(string $file,string $needle)use($read,&$fail):void{if(!str_contains($read($file),$needle))$fail[]=$file.': missing '.$needle;};
foreach(['docs/releases/changelog/CHANGELOG_R188_5_5_6_7.md','docs/releases/deploy/DEPLOY_R188_5_5_6_7.md','docs/releases/plans/PLAN_R188_5_5_6_8_REAL_SMS.md','tools/test_r1885567_otp_length_resend_cooldown.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;
$release='r1885567-otp-length-resend-cooldown';
foreach(['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'] as $file)$has($file,$release);
$has('index.php',"\$cacheEpoch = 'r1885567-otp-length-resend-cooldown'");
foreach(["verifyCode(phone, code, expectedLength = 6, entryRole = 'client')",'slice(0,codeLength)','error.retryAfter = retryAfter'] as $needle)$has('js/next/onboarding/onboarding_api.js',$needle);
if(str_contains($read('js/next/onboarding/onboarding_api.js'),'Введите шесть цифр кода.'))$fail[]='hard-coded six digit validation remains';
foreach(['otpResendAt','startResendTimer','api.verifyCode(flow.phone, code, codeLength,',"error?.code === 'challenge_rate_limited'"] as $needle)$has('js/next/onboarding/pages/role_page.js',$needle);
foreach(['KaretaChallengeRateLimitException','kareta_challenge_error_payload',"'resendAfter'=>60",'TIMESTAMPDIFF(SECOND,MAX(created_at),NOW())'] as $needle)$has('api/identity/challenge_service.php',$needle);
foreach(['api/auth_session.php','api/onboarding_code.php','api/db.php'] as $file)foreach(['resendAfter','kareta_challenge_error_payload'] as $needle)$has($file,$needle);
$has('api/identity_session.php','kareta_challenge_error_payload');
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.7 verifier OK".PHP_EOL;
