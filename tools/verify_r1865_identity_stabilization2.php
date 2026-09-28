<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$frontend=(string)file_get_contents($root.'/js/next/identity_frontend.js');
$app=(string)file_get_contents($root.'/js/next/app_next.js');
$challenge=(string)file_get_contents($root.'/api/identity/challenge_service.php');
$checks=[
 'version'=>preg_match('/(?:r186[5-9]|r18[7-9][0-9]*)-/',(string)@file_get_contents($root.'/inc/asset_version.php'))===1,
 'direct identity endpoint'=>str_contains($frontend,'/api/identity_session.php?action=current'),
 'direct context endpoint'=>str_contains($frontend,'/api/context.php?action=list'),
 'identity first boot'=>strpos($app,'KaretaIdentity?.load') < strpos($app,'apiClient.getSession'),
 'OTP challenge generator present'=>str_contains($challenge, '$code=\'0000\'') || str_contains($challenge, 'random_int(100000,999999)'),
];
$ok=true;foreach($checks as $name=>$pass){echo ($pass?'[OK] ':'[FAIL] ').$name.PHP_EOL;$ok=$ok&&$pass;}exit($ok?0:1);
