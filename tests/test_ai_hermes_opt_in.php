<?php
declare(strict_types=1);
/** Negative/positive opt-in tests; never sends an OTP or connects to WhatsApp. */
if(($argv[1]??'')==='case'){
  $variant=(string)($argv[2]??'disabled');
  $allow=in_array($variant,['enabled_public','enabled_www','enabled_admin','enabled_stagehost'],true);
  define('KARETA_ENVIRONMENT','production');
  define('KARETA_OTP',[
    'transport'=>$variant==='disabled'?'webhook':'whatsapp_hermes',
    'hermes_production_enabled'=>$allow,
    'temporary_static'=>false,'allow_test_fallback'=>false,'webhook_url'=>'','test_code'=>''
  ]);
  $_SERVER['HTTP_HOST']=match($variant){
    'enabled_admin'=>'chat.kareta.kz',
    'enabled_stagehost'=>'s.kareta.kz',
    'enabled_www'=>'www.kareta.kz',
    default=>'kareta.kz'
  };
  require dirname(__DIR__).'/api/identity/challenge_service.php';
  $obj=new KaretaChallengeService(new PDO('sqlite::memory:'));
  $method=new ReflectionMethod(KaretaChallengeService::class,'effectiveTransport');
  try{echo 'RESULT='.$method->invoke($obj).PHP_EOL;}
  catch(Throwable $e){echo 'ERROR='.$e->getMessage().PHP_EOL;}
  exit;
}
$expected=[
  'disabled'=>'ERROR=otp_delivery_unavailable',
  'fake_opt_in'=>'ERROR=otp_delivery_unavailable',
  'enabled_public'=>'RESULT=whatsapp_hermes',
  'enabled_www'=>'RESULT=whatsapp_hermes',
  'enabled_admin'=>'ERROR=otp_delivery_unavailable',
  'enabled_stagehost'=>'ERROR=otp_delivery_unavailable'
];
$pass=0;
foreach($expected as $variant=>$want){
  $cmd=escapeshellarg(PHP_BINARY).' '.escapeshellarg(__FILE__).' case '.escapeshellarg($variant);
  $out=trim((string)shell_exec($cmd));
  $ok=$out===$want;
  echo ($ok?'PASS':'FAIL').' '.$variant.' '.$out.PHP_EOL;
  if($ok)$pass++;
}
echo "RESULT ".$pass."/".count($expected).PHP_EOL;
exit($pass===count($expected)?0:1);
