<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/api/identity/devil_staging_access.php';

$cases = [
    ['allow single explicit tester', 'staging', 42, '42', true],
    ['allow one of several explicit testers', 'staging', 42, '7, 42, 315', true],
    ['deny account not listed', 'staging', 41, '7, 42, 315', false],
    ['deny prod even if listed', 'production', 42, '42', false],
    ['deny development even if listed', 'development', 42, '42', false],
    ['deny test even if listed', 'test', 42, '42', false],
    ['deny no identity', 'staging', null, '42', false],
    ['deny nonpositive account', 'staging', 0, '42', false],
    ['deny empty configuration', 'staging', 42, '', false],
    ['deny null configuration', 'staging', 42, null, false],
    ['deny array configuration', 'staging', 42, [42], false],
    ['deny trailing comma', 'staging', 42, '42,', false],
    ['deny empty entry', 'staging', 42, '42,,7', false],
    ['deny bad characters', 'staging', 42, '42, admin', false],
    ['deny signed numeric', 'staging', 42, '+42', false],
    ['deny malformed leading zero', 'staging', 42, '042', false],
    ['deny numeric overflow in any entry', 'staging', 42, '42,99999999999999999999999999999999999', false],
    ['deny JSON misconfiguration', 'staging', 42, '[42]', false],
];

$failed = [];
foreach ($cases as [$label, $env, $accountId, $allowlist, $expected]) {
    $actual = kareta_devil_staging_allows_account($env, $accountId, $allowlist);
    if ($actual !== $expected) $failed[] = $label;
}
if ($failed) {
    fwrite(STDERR, 'FAIL: ' . implode('; ', $failed) . PHP_EOL);
    exit(1);
}
echo 'PASS: ' . count($cases) . ' DEVIL staging eligibility cases' . PHP_EOL;
