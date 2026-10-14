'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const config=read('config.php');
const otp=read('api/identity/challenge_service.php');
const auth=read('api/auth_session.php');
const onb=read('js/next/onboarding/onboarding_api.js');
const request=read('js/next/pages/request.js');
const garage=read('js/next/pages/cabinet.js');
const flow=read('js/next/client/first_vehicle_flow.js');
const alternative=read('js/next/pages/client_request_final.js');

// Staging test flag selects no-SMS challenge mode; turning it off requires webhook.
assert(config.includes("in_array(KARETA_ENVIRONMENT, ['production','staging'], true)"));
assert(config.includes("if (KARETA_ENVIRONMENT === 'staging')"));
assert(config.includes("$kareta_otp_transport = $kareta_otp_temp_static_active ? 'test_static' : 'webhook'"));
assert(config.includes("$kareta_otp_test_code = $kareta_otp_temp_static_active ? '0000' : ''"));
assert(otp.includes("$transport==='test_static'"));
assert(otp.includes("if($transport==='test_static' || $this->developmentMode())return;"));
assert(otp.includes("password_verify($code,(string)$row['code_hash'])"));
assert(auth.includes("new KaretaChallengeService($pdo)"));
assert(onb.includes('codeLength')); // UI uses server-issued code length.

// All client add-car entry points now use the already-existing branded Garage wizard.
assert(!request.includes('<form data-request-add-vehicle-form'));
assert(!request.includes('const vehicleForm=event.target.closest'));
assert(request.includes("sessionStorage.setItem('kareta.firstVehicle.openFromRequest','1')"));
assert(garage.includes("sessionStorage.getItem('kareta.firstVehicle.openFromRequest')"));
assert(garage.includes('if((fromRequest||((directFirstVehicle||wantsIntro)'));
assert(garage.includes('firstVehicleFlow.start({root:flowRoot'));
assert(flow.includes('k-fv-brand-rail') && flow.includes('k-fv-model-rail'));
assert(flow.includes("sessionStorage.setItem('kareta.request.prefill'"));
assert(!alternative.includes('#/onboarding/client-car?step=2&mode=manual'));
assert(alternative.includes("sessionStorage.setItem('kareta.firstVehicle.openFromRequest','1')"));

console.log('PASS: staging OTP + canonical Garage request handoff contract');
