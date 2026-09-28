'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const apiSource=read('js/next/onboarding/onboarding_api.js');
for(const needle of [
  "verifyCode(phone, code, expectedLength = 6, entryRole = 'client')",
  'slice(0,codeLength)',
  'Введите ${codeLength} цифр кода.',
  'error.retryAfter = retryAfter',
  'Повторный код можно запросить через ${Math.ceil(retryAfter)} сек.'
]) assert(apiSource.includes(needle),needle);
assert(!apiSource.includes("slice(0,6)"));
assert(!apiSource.includes("Введите шесть цифр кода."));

const role=read('js/next/onboarding/pages/role_page.js');
for(const needle of [
  'const otpLength = value =>',
  'const remainingSeconds = timestamp =>',
  'function startResendTimer()',
  'otpResendAt',
  'otpResendAfter',
  'Повторить через ${remaining} сек.',
  'api.verifyCode(flow.phone, code, codeLength,',
  "error?.code === 'challenge_rate_limited'"
]) assert(role.includes(needle),needle);

const challenge=read('api/identity/challenge_service.php');
for(const needle of [
  'KaretaChallengeRateLimitException',
  'function kareta_challenge_retry_after',
  'function kareta_challenge_error_payload',
  "'resendAfter'=>60",
  "'retryAfter'",
  'TIMESTAMPDIFF(SECOND,MAX(created_at),NOW())'
]) assert(challenge.includes(needle),needle);

for(const file of ['api/auth_session.php','api/onboarding_code.php','api/db.php']){
  const source=read(file);
  assert(source.includes('resendAfter'),`${file}: resendAfter`);
  assert(source.includes('kareta_challenge_error_payload'),`${file}: rate payload`);
}
assert(read('api/identity_session.php').includes('kareta_challenge_error_payload'));

const storage=new Map();
let fetchPlan=[];
let captured=[];
const context={
  window:{KaretaRuntimeLog:{add(){}}},
  navigator:{onLine:true},
  sessionStorage:{
    setItem:(key,value)=>storage.set(key,String(value)),
    getItem:key=>storage.get(key)||null,
    removeItem:key=>storage.delete(key)
  },
  AbortController,
  setTimeout,
  clearTimeout,
  console:{error(){},warn(){},log(){}},
  fetch:async(url,options)=>{
    captured.push({url,body:JSON.parse(options.body)});
    const item=fetchPlan.shift();
    return {
      ok:item.status>=200&&item.status<300,
      status:item.status,
      statusText:'',
      headers:{get:name=>name.toLowerCase()==='content-type'?'application/json; charset=utf-8':''},
      text:async()=>JSON.stringify(item.payload)
    };
  }
};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(apiSource,context,{filename:'onboarding_api.js'});

(async()=>{
  fetchPlan.push({status:200,payload:{ok:true,verified:true,existingAccount:false}});
  const verified=await context.window.KaretaOnboardingApi.verifyCode('+77001234567','0000',4);
  assert.strictEqual(verified.verified,true);
  assert.strictEqual(captured.at(-1).body.code,'0000');

  await assert.rejects(
    ()=>context.window.KaretaOnboardingApi.verifyCode('+77001234567','000',4),
    error=>error && error.message==='Введите 4 цифр кода.'
  );

  fetchPlan.push({status:429,payload:{ok:false,error:'challenge_rate_limited',retryAfter:37,requestId:'rate-test'}});
  await assert.rejects(
    ()=>context.window.KaretaOnboardingApi.requestCode('+77007654321'),
    error=>error && error.retryAfter===37 && error.message.includes('через 37 сек.')
  );

  const release='r1885567-otp-length-resend-cooldown';
  for(const file of ['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'])assert(read(file).includes(release),file);
  assert(read('index.php').includes("$cacheEpoch = 'r1885567-otp-length-resend-cooldown';"));
  console.log('R188.5.5.6.7 OTP length and resend cooldown tests OK');
})().catch(error=>{console.error(error);process.exit(1);});
