<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/deployment_provenance.php';

$asset = '188.5.5.6.84.999';
$valid = [
    'schema' => 1,
    'gitSha' => str_repeat('a', 40),
    'gitRef' => 'main',
    'assetVersion' => $asset,
    'builtAt' => '2026-10-01T00:00:00+00:00',
    'workflowRunId' => '123456',
];

$ok = kareta_provenance_validate($valid, $asset);
if (!$ok['ok']) {
    fwrite(STDERR, "valid provenance rejected: " . implode(',', $ok['errors']) . "\n");
    exit(1);
}

$badSha = $valid;
$badSha['gitSha'] = 'not-a-sha';
$result = kareta_provenance_validate($badSha, $asset);
if ($result['ok'] || !in_array('git_sha_invalid', $result['errors'], true)) {
    fwrite(STDERR, "invalid SHA was not rejected\n");
    exit(1);
}

$mismatch = kareta_provenance_validate($valid, '188.5.5.6.84.other');
if ($mismatch['ok'] || !in_array('asset_version_mismatch', $mismatch['errors'], true)) {
    fwrite(STDERR, "asset mismatch was not rejected\n");
    exit(1);
}

echo "DEPLOYMENT_PROVENANCE: PASS\n";
