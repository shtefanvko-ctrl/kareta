'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const config=read('config.php');
const productionLocked=config.includes("$kareta_is_production ? 'webhook' : 'test_static'");
if(productionLocked){
  assert(config.includes("$kareta_is_production ? 'webhook' : 'test_static'"));
  assert(config.includes("$kareta_is_production ? '' : '0000'"));
  assert(config.includes('$kareta_otp_allow_test_fallback = false'));
}else{
  assert(config.includes("'transport' => strtolower((string) kareta_config_value('KARETA_OTP_TRANSPORT', 'otp_transport', 'test_static'))"));
  assert(config.includes("'otp_test_code', '0000'"));
  assert(config.includes("'otp_allow_test_fallback', true"));
}

const challenge=read('api/identity/challenge_service.php');
for(const needle of [
  'function effectiveTransport','test_static','allow_test_fallback','configuredTestCode',
  "random_int(100000,999999)",'password_hash($code,PASSWORD_DEFAULT)',
  "preg_match('/^\\d{6}$/',$code)","preg_match('/^\\d{4,8}$/',$code)",
  "'deliveryMode'=>$transport","'codeLength'=>strlen($code)","'testMode'=>$transport==='test_static'",
  "$result['testCode']=$code"
]) assert(challenge.includes(needle),needle);
assert(challenge.includes("$transport==='webhook' && $allowFallback"));
assert(challenge.includes("$url==='' || !str_starts_with(strtolower($url),'https://')"));

for(const file of ['api/auth_session.php','api/onboarding_code.php','api/db.php']){
  const source=read(file);
  for(const needle of ['deliveryMode','codeLength','testMode','testCode'])assert(source.includes(needle),`${file}: ${needle}`);
}

const role=read('js/next/onboarding/pages/role_page.js');
for(const needle of [
  'otpDeliveryMode','otpCodeLength','otpTestMode','otpTestCode',
  "flow.otpDeliveryMode === 'test_static'",
  'Тестовый режим: SMS не отправляется. Введите код',
  'maxlength="${codeLength}"','Введите ${codeLength} цифр кода.'
]) assert(role.includes(needle),needle);
assert(!role.includes('maxlength="6" placeholder="••••••"'));

const release='r1885566-test-otp-transport-recovery';
for(const file of ['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'])assert(read(file).includes(release),file);
assert(read('index.php').includes("$cacheEpoch = 'r1885566-test-otp-transport-recovery';"));
console.log('R188.5.5.6.6 test OTP transport tests OK');
