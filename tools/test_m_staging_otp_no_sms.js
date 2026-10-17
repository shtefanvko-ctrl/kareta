'use strict';
// Ensure s.kareta.kz test OTP cannot silently affect s or production.
// Read-only tests: PHP reflection does not contact a provider or write MySQL.
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function probe(host, extraEnv = {}) {
  const script = `
    $_SERVER['HTTP_HOST'] = $argv[1];
    require $argv[2];
    require $argv[3];
    $reflection = new ReflectionClass('KaretaChallengeService');
    $service = $reflection->newInstanceWithoutConstructor();
    $transportMethod = $reflection->getMethod('effectiveTransport');
    $transportMethod->setAccessible(true);
    $formatMethod = $reflection->getMethod('validCodeFormat');
    $formatMethod->setAccessible(true);
    $codeMethod = $reflection->getMethod('configuredTestCode');
    $codeMethod->setAccessible(true);
    $deliveryMethod = $reflection->getMethod('deliver');
    $deliveryMethod->setAccessible(true);
    $error = '';
    $effective = '';
    try { $effective = $transportMethod->invoke($service); }
    catch (Throwable $e) { $error = $e->getMessage(); }
    $configured = '';
    if ($effective === 'test_static') {
      $configured = $codeMethod->invoke($service);
      // Delivery in test_static mode must return before attempting an HTTP SMS request.
      $deliveryMethod->invoke($service, '+77001111111', $configured, 'login', $effective);
    }
    echo json_encode([
      'environment' => KARETA_ENVIRONMENT,
      'transport' => KARETA_OTP['transport'],
      'effective' => $effective,
      'testCode' => KARETA_OTP['test_code'],
      'configuredCode' => $configured,
      'temporaryStatic' => KARETA_OTP['temporary_static'],
      'fallback' => KARETA_OTP['allow_test_fallback'],
      'valid4' => $formatMethod->invoke($service, '0000'),
      'invalid3' => $formatMethod->invoke($service, '123'),
      'error' => $error,
    ]);
  `;
  const env = {
    ...process.env,
    KARETA_ENVIRONMENT: 'staging',
    KARETA_OTP_TRANSPORT: 'webhook',
    KARETA_OTP_TEST_CODE: '123456',
    KARETA_OTP_ALLOW_TEST_FALLBACK: '1',
    KARETA_M_STAGING_SMS_ENABLED: '0',
    KARETA_OTP_TEMP_STATIC_ENABLED: '0',
    ...extraEnv,
  };
  const stdout = cp.execFileSync('php', ['-r', script, host, path.join(root, 'config.php'), path.join(root, 'api/identity/challenge_service.php')], {cwd: root, env, encoding:'utf8'});
  return JSON.parse(stdout);
}

const s = probe('s.kareta.kz');
assert.equal(s.environment, 'staging');
assert.equal(s.transport, 'test_static');
assert.equal(s.effective, 'test_static');
assert.equal(s.testCode, '0000');
assert.equal(s.configuredCode, '0000');
assert.equal(s.temporaryStatic, false, 'Normal OTP rate limits should remain enabled');
assert.equal(s.fallback, false);
assert.equal(s.valid4, true);
assert.equal(s.invalid3, false);
assert.equal(s.error, '');
assert.equal(probe('s.kareta.kz:443').effective, 'test_static');

const switched = probe('s.kareta.kz', {KARETA_M_STAGING_SMS_ENABLED:'1'});
assert.equal(switched.transport, 'webhook');
assert.equal(switched.testCode, '');
assert.equal(switched.fallback, false);
assert.equal(switched.effective, 'webhook');

for (const otherHost of ['m.kareta.kz', 'kareta.kz', 'www.kareta.kz']) {
  const other = probe(otherHost);
  assert.equal(other.transport, 'disabled', `${otherHost}: staging code must not work on a different host`);
  assert.equal(other.testCode, '', `${otherHost}: test code must be absent`);
  assert.equal(other.fallback, false);
}
const production = probe('kareta.kz', {KARETA_ENVIRONMENT:'production', KARETA_OTP_TEMP_STATIC_ENABLED:'0'});
assert.equal(production.transport, 'webhook');
assert.equal(production.testCode, '');
const wrongEnvironment = probe('s.kareta.kz', {KARETA_ENVIRONMENT:'production',KARETA_OTP_TEMP_STATIC_ENABLED:'0'});
assert.equal(wrongEnvironment.transport, 'disabled');
assert.equal(wrongEnvironment.testCode, '');
assert.equal(wrongEnvironment.fallback, false);
assert.equal(wrongEnvironment.error, 'otp_delivery_unavailable');

const ui = fs.readFileSync(path.join(root,'js/next/onboarding/pages/role_page.js'),'utf8');
assert(ui.includes("window.location.hostname === 's.kareta.kz' ? 'Ввести тестовый код'"));
assert(ui.includes('SMS не отправляется на ${maskedPhone}'));
assert(ui.includes('Тестовый режим: SMS не отправляется. Введите код ${esc(testCode)}'));
assert(ui.includes('data-kflow-otp-cell'), 'OTP form still contains input cells');
assert(ui.includes('api.verifyCode(flow.phone, code, codeLength'), 'OTP must be validated on server');
console.log('PASS s.kareta.kz OTP staging-only, SMS off, code 0000, validation and provider-on switch');
