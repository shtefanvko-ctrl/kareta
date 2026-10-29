'use strict';
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const php=`
$_SERVER['HTTP_HOST']=getenv('QA_HOST');
require getenv('QA_ROOT').'/config.php';
require_once getenv('QA_ROOT').'/api/identity/challenge_service.php';
$c=new ReflectionClass(KaretaChallengeService::class);
$s=$c->newInstanceWithoutConstructor();
try {$mode=$c->getMethod('effectiveTransport')->invoke($s);$error='';}
catch(KaretaOtpDeliveryException $e) {$mode='blocked';$error=$e->deliveryCategory();}
$valid=$c->getMethod('validCodeFormat');
$badPhone='not-a-phone';
try{$c->getMethod('deliverViaKaretaSupport')->invokeArgs($s,[$badPhone,'1234','login']);$reject=false;}
catch(KaretaOtpDeliveryException $e){$reject=true;}
echo json_encode(['host'=>getenv('QA_HOST'),'environment'=>KARETA_ENVIRONMENT,'transport'=>$mode,'error'=>$error,'publicFlag'=>KARETA_OTP['hermes_public_enabled']??false,'testFallback'=>KARETA_OTP['allow_test_fallback']??null,'static'=>KARETA_OTP['temporary_static']??null,'fourDigits'=>$valid->invoke($s,'1234'),'sixDigits'=>$valid->invoke($s,'123456'),'static0000Accepted'=>$valid->invoke($s,'0000'),'approval'=>KARETA_ACCOUNT_TYPE_APPROVAL_MODE,'invalidPhoneRejected'=>$reject]);`;
const scenarios=[
 {name:'staging allowed without public flag',host:'s.kareta.kz',env:'staging',publicFlag:'0',transport:'whatsapp_hermes',approval:'test_auto'},
 {name:'main default disabled',host:'kareta.kz',env:'staging',publicFlag:'0',transport:'disabled',approval:'admin_review'},
 {name:'main opted in',host:'kareta.kz',env:'staging',publicFlag:'1',transport:'whatsapp_hermes',approval:'admin_review'},
 {name:'www opted in',host:'www.kareta.kz',env:'staging',publicFlag:'1',transport:'whatsapp_hermes',approval:'admin_review'},
 {name:'other hostname refused',host:'attacker.example',env:'staging',publicFlag:'1',transport:'disabled',approval:'admin_review'},
 {name:'production remains webhook only',host:'kareta.kz',env:'production',publicFlag:'1',transport:'blocked',approval:'admin_review'},
];
for (const s of scenarios) {
 const proc=spawnSync('php',['-r',php],{encoding:'utf8',env:{...process.env,QA_HOST:s.host,QA_ROOT:root,KARETA_ENVIRONMENT:s.env,KARETA_OTP_HERMES_PUBLIC_ENABLED:s.publicFlag,KARETA_OTP_TEMP_STATIC_ENABLED:'0',KARETA_OTP_WEBHOOK_URL:'',KARETA_OTP_WEBHOOK_TOKEN:''}});
 assert.equal(proc.status,0,`${s.name}: ${proc.stderr}`);
 const data=JSON.parse(proc.stdout);
 assert.equal(data.transport,s.transport,`${s.name}: unexpected transport`);
 assert.equal(data.approval,s.approval,`${s.name}: unsafe role approval mode`);
 assert.equal(data.invalidPhoneRejected,true,`${s.name}: invalid phone accepted`);
 assert.equal(data.static,false,`${s.name}: static OTP enabled`);
 if(s.env==='staging') {
  assert.equal(data.testFallback,false,`${s.name}: insecure test fallback`);
  if(s.transport==='whatsapp_hermes') {
   assert.equal(data.fourDigits,true);
   assert.equal(data.sixDigits,false);
   assert.equal(data.static0000Accepted,false);
  }
 }
 if(s.transport==='blocked') assert.equal(data.error,'provider_not_configured');
 console.log(`PASS ${s.name}: ${data.transport}`);
}
console.log('PASS: six host/transport safety gates; no database/no OTP delivery');
// Check Cloudflare Tunnel per-client throttling independently of database or OTP delivery.
const peerPHP=`
require getenv('QA_ROOT').'/api/identity/challenge_service.php';
$_SERVER['REMOTE_ADDR']=getenv('QA_PEER');
$_SERVER['HTTP_CF_CONNECTING_IP']=getenv('QA_CF_IP');
$c=new ReflectionClass(KaretaChallengeService::class);
$s=$c->newInstanceWithoutConstructor();
echo $c->getMethod('rateLimitPeer')->invoke($s);`;
for (const [peer,cf,expected] of [
 ['127.0.0.1','198.51.100.34','198.51.100.34'],
 ['::1','2001:db8::42','2001:db8::42'],
 ['127.0.0.1','not-an-ip','127.0.0.1'],
 ['192.0.2.10','198.51.100.34','192.0.2.10'],
]) {
 const p=spawnSync('php',['-r',peerPHP],{encoding:'utf8',env:{...process.env,QA_ROOT:root,QA_PEER:peer,QA_CF_IP:cf}});
 assert.equal(p.status,0,p.stderr);
 assert.equal(p.stdout,expected,`peer guard failed: ${peer}`);
}
console.log('PASS: four Cloudflare peer trust tests; no database/no OTP delivery');

