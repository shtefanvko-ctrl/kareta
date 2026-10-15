<?php
declare(strict_types=1);

// Exercises the actual config and challenge service in separate PHP processes.
// No MySQL, live HTTP, account, SMS or production state is accessed.
if (($argv[1] ?? '') === '--probe') {
    require dirname(__DIR__) . '/config.php';
    require dirname(__DIR__) . '/api/identity/challenge_service.php';
    $service = (new ReflectionClass(KaretaChallengeService::class))->newInstanceWithoutConstructor();
    $invoke = static function (string $method, ...$args) use ($service) {
        return (new ReflectionMethod(KaretaChallengeService::class, $method))->invoke($service, ...$args);
    };
    $transport = null;
    $errorCode = '';
    try { $transport = $invoke('effectiveTransport'); }
    catch (Throwable $error) { $errorCode = $error->getMessage(); }
    $testCodeDenied = false;
    try { $invoke('configuredTestCode'); }
    catch (DomainException $error) { $testCodeDenied = $error->getMessage() === 'otp_test_mode_forbidden'; }
    $testDeliveryDenied = false;
    try { $invoke('deliver', '+77000000000', '0000', 'login', 'test_static'); }
    catch (DomainException $error) { $testDeliveryDenied = $error->getMessage() === 'otp_test_mode_forbidden'; }
    echo json_encode([
        'env' => KARETA_ENVIRONMENT,
        'transport' => KARETA_OTP['transport'],
        'testCode' => KARETA_OTP['test_code'],
        'fallback' => KARETA_OTP['allow_test_fallback'],
        'temp' => KARETA_OTP['temporary_static'],
        'serviceTemp' => $invoke('temporaryStaticMode'),
        'effective' => $transport,
        'error' => $errorCode,
        'accept4' => $invoke('validCodeFormat', '0000'),
        'accept6' => $invoke('validCodeFormat', '123456'),
        'testCodeDenied' => $testCodeDenied,
        'testDeliveryDenied' => $testDeliveryDenied,
    ], JSON_THROW_ON_ERROR);
    exit;
}

function otpProbe(string $name, array $config): array {
    $environment = array_merge($_ENV, [
        'KARETA_ENVIRONMENT' => 'production',
        'KARETA_OTP_TRANSPORT' => 'test_static',
        'KARETA_OTP_TEMP_STATIC_ENABLED' => '1',
        'KARETA_OTP_TEMP_STATIC_UNTIL' => '2099-01-01',
        'KARETA_OTP_ALLOW_TEST_FALLBACK' => '1',
        'KARETA_OTP_TEST_CODE' => '0000',
        // Not a real sender: these tests never deliver OTP over the network.
        'KARETA_OTP_WEBHOOK_URL' => 'https://sms.test.invalid/deliver',
        'KARETA_PRIVATE_CONFIG_FILE' => '/nonexistent/otp-test-private.php',
    ], $config);
    $pipes = [];
    $process = proc_open([PHP_BINARY, __FILE__, '--probe'],
        [0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],
        $pipes, dirname(__DIR__), $environment);
    if (!is_resource($process)) throw new RuntimeException($name . ': cannot start PHP probe');
    fclose($pipes[0]);
    $out = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exit = proc_close($process);
    if ($exit !== 0) throw new RuntimeException($name . ': PHP exit=' . $exit . ' ' . $err);
    return json_decode((string)$out, true, 32, JSON_THROW_ON_ERROR);
}
function otpAssert(bool $ok, string $message): void {
    if (!$ok) throw new RuntimeException($message);
}

$prod = otpProbe('prod flags', []);
otpAssert($prod['env']==='production' && $prod['effective']==='webhook',
    'production did not force webhook despite test flags');
otpAssert($prod['transport']==='webhook' && $prod['testCode']==='' && !$prod['fallback'],
    'production test code or fallback remains enabled');
otpAssert(!$prod['temp'] && !$prod['serviceTemp'], 'production commissioning still enabled');
otpAssert(!$prod['accept4'] && $prod['accept6'], 'production accepts a legacy four-digit code');
otpAssert($prod['testCodeDenied'] && $prod['testDeliveryDenied'],
    'production test-code/delivery guard bypassed');

$noProvider = otpProbe('prod provider', [
    'KARETA_OTP_WEBHOOK_URL'=>'https://sms-provider.example/send',
]);
otpAssert($noProvider['effective']===null && $noProvider['error']==='otp_delivery_unavailable',
    'missing production delivery provider did not fail closed');
otpAssert($noProvider['testCodeDenied'] && $noProvider['testDeliveryDenied'],
    'invalid webhook allowed static-code fallback');

$stage = otpProbe('staging on', ['KARETA_ENVIRONMENT'=>'staging']);
otpAssert($stage['transport']==='test_static' && $stage['effective']==='test_static',
    'staging 0000 transport missing');
otpAssert($stage['testCode']==='0000' && $stage['temp'] && $stage['serviceTemp'],
    'staging temporary code missing');
otpAssert($stage['accept4'] && $stage['accept6'] && !$stage['testCodeDenied']
    && !$stage['testDeliveryDenied'], 'staging commissioning compatibility failed');

$disabled = otpProbe('staging off', [
    'KARETA_ENVIRONMENT'=>'staging','KARETA_OTP_TEMP_STATIC_ENABLED'=>'0'
]);
otpAssert($disabled['transport']==='webhook' && $disabled['effective']==='webhook'
    && !$disabled['temp'] && $disabled['testCode']==='', 'staging opt-out ignored');

$expired = otpProbe('staging expired', [
    'KARETA_ENVIRONMENT'=>'staging','KARETA_OTP_TEMP_STATIC_UNTIL'=>'2000-01-01'
]);
otpAssert($expired['transport']==='webhook' && !$expired['temp'],
    'expired staging test OTP was accepted');

$dev = otpProbe('development', ['KARETA_ENVIRONMENT'=>'development']);
otpAssert($dev['effective']==='test_static' && !$dev['temp'], 'development test mode changed');

$unknown = otpProbe('unknown', ['KARETA_ENVIRONMENT'=>'prodction']);
otpAssert($unknown['env']==='production' && $unknown['transport']==='webhook'
    && !$unknown['temp'], 'unknown env must become production');

echo "OTP_ENVIRONMENT_BOUNDARY: PASS production & provider negative paths, staging on/off/expired, development, unknown-env\n";
