<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(2); }
require_once dirname(__DIR__) . '/config.php';
$otp = defined('KARETA_OTP') && is_array(KARETA_OTP) ? KARETA_OTP : [];
$url = trim((string)($otp['webhook_url'] ?? ''));
$host = strtolower((string)(parse_url($url, PHP_URL_HOST) ?: ''));
$token = trim((string)($otp['webhook_token'] ?? ''));
$placeholderHost = $host === '' || str_ends_with($host, '.example') || in_array($host, ['example.com','www.example.com'], true);
$placeholderToken = $token === '' || preg_match('/(?:replace|example|secret|changeme|token)/i', $token) === 1;
$https = str_starts_with(strtolower($url), 'https://');
$transport = strtolower(trim((string)($otp['transport'] ?? '')));
$ready = $transport === 'webhook' && $https && !$placeholderHost && !$placeholderToken;
$result = [
    'ok' => $ready,
    'environment' => defined('KARETA_ENVIRONMENT') ? KARETA_ENVIRONMENT : 'unknown',
    'privateConfigLoaded' => defined('KARETA_PRIVATE_CONFIG_LOADED') ? KARETA_PRIVATE_CONFIG_LOADED : false,
    'privateConfigSource' => defined('KARETA_PRIVATE_CONFIG_SOURCE') ? KARETA_PRIVATE_CONFIG_SOURCE : 'unknown',
    'transport' => $transport,
    'https' => $https,
    'providerHost' => $host,
    'providerConfigured' => !$placeholderHost,
    'tokenConfigured' => !$placeholderToken,
    'senderConfigured' => trim((string)($otp['sender'] ?? '')) !== '',
];
if (in_array('--network', $argv, true) && !$placeholderHost) {
    $resolved = gethostbyname($host);
    $dnsOk = $resolved !== $host || filter_var($host, FILTER_VALIDATE_IP);
    $result['dnsOk'] = (bool)$dnsOk;
    $result['resolvedIp'] = $dnsOk ? $resolved : '';
    $errno = 0; $errstr = '';
    $socket = @fsockopen('ssl://' . $host, 443, $errno, $errstr, 5.0);
    $result['tlsConnectOk'] = is_resource($socket);
    $result['connectErrno'] = $errno;
    if (is_resource($socket)) fclose($socket);
}
echo json_encode($result, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT), PHP_EOL;
exit($ready ? 0 : 1);
