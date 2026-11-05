<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/deployment_provenance.php';

$sha = str_repeat('a', 40);
$asset = '188.5.5.6.84.178';
$valid = [
    'schema' => 1,
    'gitSha' => $sha,
    'gitRef' => 'main',
    'assetVersion' => $asset,
    'builtAt' => '2026-10-13T00:00:00+00:00',
    'workflowRunId' => '',
];
$cases = [
    ['valid', $valid, $asset, true, null],
    ['asset_mismatch', $valid, '188.5.5.6.84.999', false, 'asset_version_mismatch'],
    ['invalid_sha', array_merge($valid, ['gitSha' => 'invalid']), $asset, false, 'git_sha_invalid'],
    ['invalid_schema', array_merge($valid, ['schema' => 2]), $asset, false, 'schema_invalid'],
    ['missing_git_ref', array_merge($valid, ['gitRef' => '']), $asset, false, 'git_ref_invalid'],
    ['invalid_built_at', array_merge($valid, ['builtAt' => 'invalid']), $asset, false, 'built_at_invalid'],
];
foreach ($cases as [$name, $data, $expectedAsset, $expectedOk, $expectedError]) {
    $state = kareta_provenance_validate($data, $expectedAsset);
    if ($state['ok'] !== $expectedOk || ($expectedError !== null && !in_array($expectedError, $state['errors'], true))) {
        fwrite(STDERR, "[FAIL] {$name}\n");
        exit(1);
    }
    echo "[PASS] {$name}\n";
}
echo "DEPLOYMENT_PREFLIGHT_CONTRACT: PASS " . count($cases) . " scenarios\n";
